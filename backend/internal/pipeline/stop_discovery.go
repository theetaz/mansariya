package pipeline

import (
	"context"
	"crypto/rand"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/masariya/backend/internal/model"
	"github.com/masariya/backend/internal/spatial"
	"github.com/paulmach/orb"
)

const (
	// dwellSpeedThresholdKMH is the max speed to consider a device as dwelling.
	dwellSpeedThresholdKMH = 5.0

	// dwellMinDurationSec is the minimum dwell time to record a dwell point.
	dwellMinDurationSec = 20.0

	// stopClusterEpsKM is the DBSCAN epsilon for stop discovery (30m radius).
	stopClusterEpsKM = 0.03

	// stopClusterMinPts is the minimum independent observations to form a stop candidate.
	stopClusterMinPts = 3

	// existingStopRadiusKM is the distance within which a cluster is considered
	// a duplicate of an already-known stop.
	existingStopRadiusKM = 0.05 // 50 meters

	// clusteringIntervalMin is how often periodic clustering runs.
	clusteringIntervalMin = 5
)

// DiscoveredStopStore is the interface the StopDiscovery component uses to
// persist discovered stop candidates. Implemented by store.DiscoveredStopStore.
type DiscoveredStopStore interface {
	Upsert(ctx context.Context, ds model.DiscoveredStop) error
	FindNearby(ctx context.Context, lat, lng, radiusMeters float64) ([]model.DiscoveredStop, error)
}

// dwellPoint represents a single observation of a device dwelling at a location.
type dwellPoint struct {
	Lat       float64
	Lng       float64
	DeviceHash string
	Timestamp time.Time
}

// deviceDwellState tracks whether a device is currently dwelling and for how long.
type deviceDwellState struct {
	Lat       float64
	Lng       float64
	RouteID   string
	StartTime time.Time
	Recorded  bool // true if this dwell was already recorded as a dwellPoint
}

// StopDiscovery detects dwell points from GPS data and clusters them into
// bus stop candidates. When buses repeatedly stop at the same location
// (speed < 5 km/h for > 20s), those dwell points are accumulated per route
// and periodically clustered via DBSCAN to discover new stops.
type StopDiscovery struct {
	store         DiscoveredStopStore
	existingStops []model.Stop

	mu            sync.Mutex
	dwellsByRoute map[string][]dwellPoint       // route_id → accumulated dwell points
	deviceStates  map[string]*deviceDwellState   // device_hash → current dwell state
}

// NewStopDiscovery creates a StopDiscovery with a store for persistence and
// a list of existing stops to avoid duplicating known locations.
func NewStopDiscovery(store DiscoveredStopStore, existingStops []model.Stop) *StopDiscovery {
	return &StopDiscovery{
		store:         store,
		existingStops: existingStops,
		dwellsByRoute: make(map[string][]dwellPoint),
		deviceStates:  make(map[string]*deviceDwellState),
	}
}

// RecordDwell is called for each GPS update. It tracks device dwell state and,
// when a device has been dwelling long enough, records the dwell point.
func (sd *StopDiscovery) RecordDwell(deviceHash string, lat, lng float64, speedKMH float64, routeID string) {
	sd.mu.Lock()
	defer sd.mu.Unlock()

	now := time.Now()
	state, exists := sd.deviceStates[deviceHash]

	if speedKMH >= dwellSpeedThresholdKMH {
		// Device is moving — reset dwell state.
		if exists {
			delete(sd.deviceStates, deviceHash)
		}
		return
	}

	// Device speed is below threshold.
	if !exists {
		// Start tracking a new dwell.
		sd.deviceStates[deviceHash] = &deviceDwellState{
			Lat:       lat,
			Lng:       lng,
			RouteID:   routeID,
			StartTime: now,
			Recorded:  false,
		}
		return
	}

	// Check if the device has moved significantly (>50m) — if so, restart dwell.
	dist := spatial.Haversine(state.Lat, state.Lng, lat, lng)
	if dist > existingStopRadiusKM {
		sd.deviceStates[deviceHash] = &deviceDwellState{
			Lat:       lat,
			Lng:       lng,
			RouteID:   routeID,
			StartTime: now,
			Recorded:  false,
		}
		return
	}

	// Still dwelling at the same location. Check duration.
	dwellDuration := now.Sub(state.StartTime).Seconds()
	if dwellDuration >= dwellMinDurationSec && !state.Recorded {
		dp := dwellPoint{
			Lat:        lat,
			Lng:        lng,
			DeviceHash: deviceHash,
			Timestamp:  now,
		}
		sd.dwellsByRoute[routeID] = append(sd.dwellsByRoute[routeID], dp)
		state.Recorded = true

		slog.Debug("dwell point recorded",
			"device", deviceHash[:min(8, len(deviceHash))],
			"route", routeID,
			"dwell_seconds", dwellDuration,
		)
	}
}

// RunClustering clusters accumulated dwell points per route using DBSCAN,
// identifies new stop candidates, and persists them via the store.
// This method is safe for periodic invocation (e.g., every 5 minutes).
func (sd *StopDiscovery) RunClustering(ctx context.Context) error {
	sd.mu.Lock()
	// Snapshot and reset the buffer.
	snapshot := sd.dwellsByRoute
	sd.dwellsByRoute = make(map[string][]dwellPoint)
	sd.mu.Unlock()

	if len(snapshot) == 0 {
		return nil
	}

	var totalCandidates int

	for routeID, dwells := range snapshot {
		if len(dwells) < stopClusterMinPts {
			continue
		}

		// Build DBSCAN input. Speed is not relevant for stop clustering,
		// so we set all speeds to 0 and use a large speedEps.
		points := make([]spatial.DBSCANPoint, len(dwells))
		for i, d := range dwells {
			points[i] = spatial.DBSCANPoint{
				Lat:   d.Lat,
				Lng:   d.Lng,
				Speed: 0,
				ID:    d.DeviceHash,
			}
		}

		clusters := spatial.DBSCAN(points, stopClusterEpsKM, 1000.0, stopClusterMinPts)

		for _, cluster := range clusters {
			if len(cluster.Points) < stopClusterMinPts {
				continue
			}

			// Compute centroid (simple average — points are close enough that
			// spherical distortion is negligible at 30m scale).
			var sumLat, sumLng float64
			for _, p := range cluster.Points {
				sumLat += p.Lat
				sumLng += p.Lng
			}
			centroidLat := sumLat / float64(len(cluster.Points))
			centroidLng := sumLng / float64(len(cluster.Points))

			// Check if within 50m of an existing known stop — skip if so.
			if sd.nearExistingStop(centroidLat, centroidLng) {
				slog.Debug("cluster near existing stop, skipping",
					"route", routeID,
					"lat", centroidLat,
					"lng", centroidLng,
				)
				continue
			}

			// Create a candidate discovered stop.
			id, err := generateID()
			if err != nil {
				return fmt.Errorf("generate stop id: %w", err)
			}

			now := time.Now()
			ds := model.DiscoveredStop{
				ID:               id,
				Location:         orb.Point{centroidLng, centroidLat},
				ObservationCount: len(cluster.Points),
				AvgDwellSeconds:  0, // We don't track per-dwell duration in the cluster points
				NearestRouteIDs:  []string{routeID},
				Status:           "candidate",
				FirstSeen:        now,
				LastSeen:         now,
			}

			if err := sd.store.Upsert(ctx, ds); err != nil {
				slog.Error("failed to upsert discovered stop",
					"error", err,
					"route", routeID,
					"lat", centroidLat,
					"lng", centroidLng,
				)
				continue
			}

			totalCandidates++
			slog.Info("discovered stop candidate",
				"id", id,
				"route", routeID,
				"lat", centroidLat,
				"lng", centroidLng,
				"observations", len(cluster.Points),
			)
		}
	}

	if totalCandidates > 0 {
		slog.Info("stop discovery clustering complete", "candidates", totalCandidates)
	}

	return nil
}

// RunPeriodicClustering starts a background loop that calls RunClustering every
// clusteringIntervalMin minutes. Blocks until the context is cancelled.
func (sd *StopDiscovery) RunPeriodicClustering(ctx context.Context) {
	ticker := time.NewTicker(clusteringIntervalMin * time.Minute)
	defer ticker.Stop()

	slog.Info("stop discovery periodic clustering started",
		"interval_min", clusteringIntervalMin,
	)

	for {
		select {
		case <-ctx.Done():
			slog.Info("stop discovery periodic clustering stopped")
			return
		case <-ticker.C:
			if err := sd.RunClustering(ctx); err != nil {
				slog.Error("stop discovery clustering error", "error", err)
			}
		}
	}
}

// nearExistingStop returns true if the given point is within existingStopRadiusKM
// of any known stop.
func (sd *StopDiscovery) nearExistingStop(lat, lng float64) bool {
	for _, stop := range sd.existingStops {
		// orb.Point is [lng, lat]
		dist := spatial.Haversine(lat, lng, stop.Location[1], stop.Location[0])
		if dist <= existingStopRadiusKM {
			return true
		}
	}
	return false
}

// generateID creates a random hex ID suitable for discovered stop records.
func generateID() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("read random bytes: %w", err)
	}
	return fmt.Sprintf("ds_%x", b), nil
}
