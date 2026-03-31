package pipeline

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/masariya/backend/internal/model"
	"github.com/redis/go-redis/v9"
)

const ConsumerProcessor = "processor"

// Processor is the second pipeline stage: reads map-matched GPS data,
// infers routes, clusters devices into vehicles, and broadcasts positions.
type Processor struct {
	rdb         *redis.Client
	inference   *InferenceEngine
	broadcaster *Broadcaster

	mu      sync.RWMutex
	devices map[string]*DeviceState // session_id → latest state
}

func NewProcessor(rdb *redis.Client, inference *InferenceEngine, broadcaster *Broadcaster) *Processor {
	return &Processor{
		rdb:         rdb,
		inference:   inference,
		broadcaster: broadcaster,
		devices:     make(map[string]*DeviceState),
	}
}

// Run starts the processor consumer loop. Blocks until context is cancelled.
func (p *Processor) Run(ctx context.Context) error {
	slog.Info("processor worker started")

	if err := p.restoreActiveDevices(ctx); err != nil {
		slog.Warn("restore active devices", "error", err)
	}
	p.clusterAndBroadcast(ctx)

	// Background: periodically cluster and broadcast
	go p.clusterLoop(ctx)

	// Background: periodically clean stale devices
	go p.cleanLoop(ctx)

	for {
		select {
		case <-ctx.Done():
			slog.Info("processor worker stopped")
			return ctx.Err()
		default:
		}

		streams, err := p.rdb.XReadGroup(ctx, &redis.XReadGroupArgs{
			Group:    ConsumerGroup,
			Consumer: ConsumerProcessor,
			Streams:  []string{StreamMatchedGPS, ">"},
			Count:    20,
			Block:    2 * time.Second,
		}).Result()
		if err != nil {
			if err == redis.Nil || ctx.Err() != nil {
				continue
			}
			slog.Error("processor xreadgroup", "error", err)
			time.Sleep(time.Second)
			continue
		}

		for _, stream := range streams {
			for _, msg := range stream.Messages {
				p.processMessage(ctx, msg)
				p.rdb.XAck(ctx, StreamMatchedGPS, ConsumerGroup, msg.ID)
			}
		}
	}
}

func (p *Processor) processMessage(ctx context.Context, msg redis.XMessage) {
	data, ok := msg.Values["data"].(string)
	if !ok {
		return
	}

	var trace model.MatchedTrace
	if err := json.Unmarshal([]byte(data), &trace); err != nil {
		slog.Error("processor unmarshal", "error", err)
		return
	}

	if trace.SessionID == "" {
		return
	}

	if trace.EventType == model.GPSEventStopped {
		p.removeSession(ctx, trace.SessionID)
		return
	}

	// Compute position from matched points (use last point as current position)
	if len(trace.Points) == 0 {
		return
	}
	lastPoint := trace.Points[len(trace.Points)-1]

	// Determine route: simulated devices carry route_id in session_id,
	// real devices need inference from spatial matching
	var routeID string
	if strings.HasPrefix(trace.SessionID, "sim_") {
		// Session format: sim_{jobID}_{routeID}_{vehicleID}
		parts := strings.SplitN(trace.SessionID, "_", 4)
		if len(parts) >= 3 {
			routeID = parts[2]
		}
	}
	// User-provided route from trip metadata
	if routeID == "" && trace.RouteID != "" {
		routeID = trace.RouteID
	}
	if routeID == "" {
		result := p.inference.Infer(trace)
		if result != nil {
			routeID = result.RouteID
		}
		// No early return — store device even without route match
	}

	// Build device state
	ds := &DeviceState{
		SessionID:    trace.SessionID,
		DeviceHash:   trace.DeviceHash,
		AdminID:      adminContributorID(trace.SessionID),
		RouteID:      routeID,
		Lat:          lastPoint.Lat,
		Lng:          lastPoint.Lng,
		SpeedKMH:     trace.AvgSpeed,
		Bearing:      trace.AvgBearing,
		Accuracy:     10.0,
		LastSeen:     time.Now(),
		LastBatchSeq: trace.BatchSeq,
		CrowdLevel:   trace.CrowdLevel,
		BusNumber:    trace.BusNumber,
	}

	// Classify the device
	Classify(ds)

	// Update device state
	p.mu.Lock()
	if existing, ok := p.devices[trace.SessionID]; ok && trace.BatchSeq > 0 && existing.LastBatchSeq >= trace.BatchSeq {
		p.mu.Unlock()
		return
	}
	p.devices[trace.SessionID] = ds
	p.mu.Unlock()

	if err := p.broadcaster.UpsertDeviceState(ctx, *ds); err != nil {
		slog.Warn("persist device state", "session_id", trace.SessionID, "error", err)
	}

	devLabel := ds.AdminID
	if len(devLabel) > 8 {
		devLabel = devLabel[:8]
	}
	slog.Debug("device updated",
		"device", devLabel,
		"route", routeID,
		"classification", ds.Classification,
		"quality", ds.QualityStatus,
	)
}

// clusterLoop periodically clusters all active devices and broadcasts vehicle positions.
func (p *Processor) clusterLoop(ctx context.Context) {
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			p.clusterAndBroadcast(ctx)
		}
	}
}

func (p *Processor) clusterAndBroadcast(ctx context.Context) {
	now := time.Now()
	p.mu.RLock()
	devices := make([]DeviceState, 0, len(p.devices))
	for _, d := range p.devices {
		copy := *d
		copy.FreshnessStatus = freshnessStatus(copy.LastSeen, now)
		devices = append(devices, copy)
	}
	p.mu.RUnlock()

	// Always broadcast device states for admin, even when empty
	// (so the admin UI sees devices disappear in real-time)
	defer func() {
		p.mu.RLock()
		allDevices := make([]DeviceState, 0, len(p.devices))
		for _, d := range p.devices {
			allDevices = append(allDevices, *d)
		}
		p.mu.RUnlock()
		p.broadcaster.PublishAllDevices(ctx, allDevices)
	}()

	if len(devices) == 0 {
		return
	}

	activeDevices := make([]DeviceState, 0, len(devices))
	allRoutes := make(map[string]struct{})
	for _, d := range devices {
		if d.RouteID != "" {
			allRoutes[d.RouteID] = struct{}{}
		}
		if isClusterEligible(d.LastSeen, now) {
			activeDevices = append(activeDevices, d)
		}
	}

	vehicles := ClusterVehicles(activeDevices)

	// Promote cluster members: devices in a multi-contributor vehicle
	// get upgraded to "cluster" or "confirmed"
	clusterMembers := make(map[string]string) // sessionID → classification
	for _, v := range vehicles {
		if v.ContributorCount >= 2 {
			for _, contributorID := range v.Contributors {
				clusterMembers[contributorID] = model.ClassificationCluster
			}
		}
		// Confirmed: cluster matched to a known route (routeID != "")
		if v.RouteID != "" && v.ContributorCount >= 1 {
			for _, contributorID := range v.Contributors {
				if _, ok := clusterMembers[contributorID]; !ok || v.ContributorCount >= 2 {
					clusterMembers[contributorID] = model.ClassificationConfirmed
				}
			}
		}
	}

	// Apply cluster promotions to device states
	p.mu.Lock()
	for sessionID, cls := range clusterMembers {
		if d, ok := p.devices[sessionID]; ok {
			if cls == model.ClassificationConfirmed || (cls == model.ClassificationCluster && d.Classification != model.ClassificationConfirmed) {
				d.Classification = cls
				if cls == model.ClassificationCluster {
					d.ClassificationReason = "part of DBSCAN cluster (2+ co-moving devices)"
				} else {
					d.ClassificationReason = "route-matched vehicle"
				}
			}
		}
	}
	p.mu.Unlock()

	// Broadcast vehicles per route (existing behavior)
	routeVehicles := make(map[string][]model.Vehicle)
	for _, v := range vehicles {
		routeVehicles[v.RouteID] = append(routeVehicles[v.RouteID], v)
	}
	for routeID, rvs := range routeVehicles {
		p.broadcaster.ReplaceRouteVehicles(ctx, routeID, rvs)
	}
	for routeID := range allRoutes {
		if _, ok := routeVehicles[routeID]; !ok {
			p.broadcaster.ReplaceRouteVehicles(ctx, routeID, nil)
		}
	}

}

func (p *Processor) removeSession(ctx context.Context, sessionID string) {
	p.mu.Lock()
	d, ok := p.devices[sessionID]
	if ok {
		delete(p.devices, sessionID)
	}
	p.mu.Unlock()

	if !ok {
		return
	}

	if d.RouteID != "" {
		remaining := p.devicesForRoute(d.RouteID)
		if len(remaining) == 0 {
			p.broadcaster.ReplaceRouteVehicles(ctx, d.RouteID, nil)
		}
	}

	if err := p.broadcaster.RemoveDeviceState(ctx, sessionID); err != nil {
		slog.Warn("remove device state", "session_id", sessionID, "error", err)
	}

	p.clusterAndBroadcast(ctx)
}

func adminContributorID(sessionID string) string {
	hash := sha256.Sum256([]byte(sessionID))
	return fmt.Sprintf("c_%x", hash[:6])
}

func (p *Processor) restoreActiveDevices(ctx context.Context) error {
	devices, err := p.broadcaster.LoadActiveDeviceStates(ctx)
	if err != nil {
		return err
	}

	p.mu.Lock()
	for _, device := range devices {
		if device.SessionID == "" {
			continue
		}
		p.devices[device.SessionID] = &DeviceState{}
		*p.devices[device.SessionID] = device
	}
	p.mu.Unlock()

	if len(devices) > 0 {
		slog.Info("restored active devices", "count", len(devices))
	}
	return nil
}

// RemoveSimDevices removes all simulated device states matching a job prefix
// and cleans up their Redis bus keys. Called when a simulation is stopped.
func (p *Processor) RemoveSimDevices(ctx context.Context, jobPrefix string) {
	p.mu.Lock()
	affectedRoutes := make(map[string]bool)
	for sessionID, d := range p.devices {
		if strings.HasPrefix(sessionID, "sim_"+jobPrefix) {
			affectedRoutes[d.RouteID] = true
			delete(p.devices, sessionID)
		}
	}
	p.mu.Unlock()

	// For affected routes: check if any devices remain, otherwise flush all bus keys for that route
	for routeID := range affectedRoutes {
		remaining := p.devicesForRoute(routeID)
		if len(remaining) == 0 {
			// No devices left on this route — clear all Redis bus keys
			p.broadcaster.ReplaceRouteVehicles(ctx, routeID, nil)
		}
	}

	// Re-cluster to update any routes that still have devices
	p.clusterAndBroadcast(ctx)

	slog.Info("cleaned sim devices", "prefix", jobPrefix, "routes_affected", len(affectedRoutes))
}

func (p *Processor) devicesForRoute(routeID string) []DeviceState {
	p.mu.RLock()
	defer p.mu.RUnlock()
	var result []DeviceState
	for _, d := range p.devices {
		if d.RouteID == routeID {
			result = append(result, *d)
		}
	}
	return result
}

// cleanLoop removes stale devices and their bus keys from Redis.
// Runs every 5 seconds, removes devices not seen for 15 seconds.
// This ensures devices disappear promptly when users stop sharing.
func (p *Processor) cleanLoop(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			now := time.Now()
			staleRoutes := make(map[string]bool)
			expiredSessions := make([]string, 0)

			p.mu.Lock()
			for sessionID, d := range p.devices {
				if isExpired(d.LastSeen, now) {
					staleRoutes[d.RouteID] = true
					delete(p.devices, sessionID)
					expiredSessions = append(expiredSessions, sessionID)
				}
			}
			p.mu.Unlock()

			for _, sessionID := range expiredSessions {
				if err := p.broadcaster.RemoveDeviceState(ctx, sessionID); err != nil {
					slog.Warn("remove expired device state", "session_id", sessionID, "error", err)
				}
			}

			if len(staleRoutes) > 0 {
				// For routed devices that were removed, clean up Redis bus keys
				for routeID := range staleRoutes {
					if routeID == "" {
						continue
					}
					remaining := p.devicesForRoute(routeID)
					if len(remaining) == 0 {
						p.broadcaster.ReplaceRouteVehicles(ctx, routeID, nil)
					}
				}
				// Re-cluster and broadcast updated device list (removes stale from admin WS too)
				p.clusterAndBroadcast(ctx)
			}

			p.broadcaster.CleanStale(ctx)
			if err := p.broadcaster.CleanStaleDeviceStates(ctx, now.Add(-deviceExpiryWindow)); err != nil {
				slog.Warn("clean stale device states", "error", err)
			}
		}
	}
}
