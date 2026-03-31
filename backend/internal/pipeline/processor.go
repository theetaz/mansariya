package pipeline

import (
	"context"
	"encoding/json"
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
	devices map[string]*DeviceState // device_hash → latest state
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
		DeviceHash: trace.DeviceHash,
		RouteID:    routeID,
		Lat:        lastPoint.Lat,
		Lng:        lastPoint.Lng,
		SpeedKMH:   trace.AvgSpeed,
		Bearing:    trace.AvgBearing,
		Accuracy:   10.0,
		LastSeen:   time.Now(),
		CrowdLevel: trace.CrowdLevel,
		BusNumber:  trace.BusNumber,
	}

	// Classify the device
	Classify(ds)

	// Update device state
	p.mu.Lock()
	p.devices[trace.DeviceHash] = ds
	p.mu.Unlock()

	devLabel := trace.DeviceHash
	if len(devLabel) > 8 {
		devLabel = devLabel[:8]
	}
	slog.Debug("device updated",
		"device", devLabel,
		"route", routeID,
		"classification", ds.Classification,
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
	p.mu.RLock()
	devices := make([]DeviceState, 0, len(p.devices))
	for _, d := range p.devices {
		devices = append(devices, *d)
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

	vehicles := ClusterVehicles(devices)

	// Promote cluster members: devices in a multi-contributor vehicle
	// get upgraded to "cluster" or "confirmed"
	clusterMembers := make(map[string]string) // deviceHash → classification
	for _, v := range vehicles {
		if v.ContributorCount >= 2 {
			for _, d := range devices {
				if d.RouteID == v.RouteID {
					clusterMembers[d.DeviceHash] = "cluster"
				}
			}
		}
		// Confirmed: cluster matched to a known route (routeID != "")
		if v.RouteID != "" && v.ContributorCount >= 1 {
			for _, d := range devices {
				if d.RouteID == v.RouteID {
					if _, ok := clusterMembers[d.DeviceHash]; !ok || v.ContributorCount >= 2 {
						clusterMembers[d.DeviceHash] = "confirmed"
					}
				}
			}
		}
	}

	// Apply cluster promotions to device states
	p.mu.Lock()
	for hash, cls := range clusterMembers {
		if d, ok := p.devices[hash]; ok {
			if cls == "confirmed" || (cls == "cluster" && d.Classification != "confirmed") {
				d.Classification = cls
				if cls == "cluster" {
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

}

// RemoveSimDevices removes all simulated device states matching a job prefix
// and cleans up their Redis bus keys. Called when a simulation is stopped.
func (p *Processor) RemoveSimDevices(ctx context.Context, jobPrefix string) {
	p.mu.Lock()
	affectedRoutes := make(map[string]bool)
	for hash, d := range p.devices {
		if strings.HasPrefix(hash, "sim_"+jobPrefix) {
			affectedRoutes[d.RouteID] = true
			delete(p.devices, hash)
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
			cutoff := time.Now().Add(-20 * time.Second)
			staleRoutes := make(map[string]bool)

			p.mu.Lock()
			for hash, d := range p.devices {
				if d.LastSeen.Before(cutoff) {
					staleRoutes[d.RouteID] = true
					delete(p.devices, hash)
				}
			}
			p.mu.Unlock()

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
		}
	}
}
