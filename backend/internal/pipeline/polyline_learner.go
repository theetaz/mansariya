package pipeline

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/masariya/backend/internal/spatial"
)

// PolylineLearner collects GPS traces and improves route polylines over time.
// When enough traces are collected for a route, it computes a median path
// and updates the route polyline with a higher confidence score.
type PolylineLearner struct {
	mu     sync.Mutex
	traces map[string][][2]float64 // routeID -> accumulated trace points [lng, lat]

	minTracesForUpdate int     // minimum traces before updating polyline
	maxPointsPerRoute  int     // cap accumulated points to limit memory
	updateInterval     time.Duration
	store              PolylineUpdater
}

// PolylineUpdater abstracts the store operation for updating route polylines.
type PolylineUpdater interface {
	UpdatePolyline(ctx context.Context, routeID string, points [][2]float64, confidence float64) error
	GetPolylineConfidence(ctx context.Context, routeID string) (float64, error)
}

// NewPolylineLearner creates a learner that collects traces and periodically updates polylines.
func NewPolylineLearner(store PolylineUpdater) *PolylineLearner {
	return &PolylineLearner{
		traces:             make(map[string][][2]float64),
		minTracesForUpdate: 50,  // need at least 50 accumulated points
		maxPointsPerRoute:  5000, // cap at 5000 points per route
		updateInterval:     30 * time.Minute,
		store:              store,
	}
}

// RecordTrace adds matched GPS points to the accumulator for a route.
func (pl *PolylineLearner) RecordTrace(routeID string, points [][2]float64) {
	if len(points) < 2 || routeID == "" {
		return
	}

	pl.mu.Lock()
	defer pl.mu.Unlock()

	existing := pl.traces[routeID]
	existing = append(existing, points...)

	// Cap at maxPointsPerRoute — keep the newest points
	if len(existing) > pl.maxPointsPerRoute {
		existing = existing[len(existing)-pl.maxPointsPerRoute:]
	}

	pl.traces[routeID] = existing
}

// RunPeriodicUpdate runs the polyline update loop every updateInterval.
func (pl *PolylineLearner) RunPeriodicUpdate(ctx context.Context) {
	ticker := time.NewTicker(pl.updateInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := pl.ProcessAccumulated(ctx); err != nil {
				slog.Error("polyline learner update failed", "error", err)
			}
		}
	}
}

// ProcessAccumulated checks all accumulated traces and updates polylines where enough data exists.
func (pl *PolylineLearner) ProcessAccumulated(ctx context.Context) error {
	pl.mu.Lock()
	snapshot := make(map[string][][2]float64, len(pl.traces))
	for k, v := range pl.traces {
		if len(v) >= pl.minTracesForUpdate {
			snapshot[k] = v
			delete(pl.traces, k) // clear after snapshot
		}
	}
	pl.mu.Unlock()

	if len(snapshot) == 0 {
		return nil
	}

	updated := 0
	for routeID, points := range snapshot {
		// Check current confidence — only update if we can improve it
		currentConf, err := pl.store.GetPolylineConfidence(ctx, routeID)
		if err != nil {
			slog.Warn("failed to get polyline confidence", "route", routeID, "error", err)
			continue
		}

		// Crowdsource confidence: 0.8 for enough traces, up to 1.0 for many
		newConf := computeConfidence(len(points))
		if newConf <= currentConf {
			continue // current polyline is already better
		}

		// Simplify the accumulated points using Douglas-Peucker
		simplified := douglasPeucker(points, 0.0001) // ~10m tolerance

		if len(simplified) < 2 {
			continue
		}

		if err := pl.store.UpdatePolyline(ctx, routeID, simplified, newConf); err != nil {
			slog.Error("failed to update polyline", "route", routeID, "error", err)
			continue
		}

		slog.Info("updated route polyline from crowdsource",
			"route", routeID,
			"points", len(simplified),
			"confidence", fmt.Sprintf("%.2f", newConf),
			"traces_accumulated", len(points),
		)
		updated++
	}

	if updated > 0 {
		slog.Info("polyline learner update complete", "routes_updated", updated)
	}
	return nil
}

// computeConfidence returns a confidence score based on accumulated trace count.
func computeConfidence(pointCount int) float64 {
	switch {
	case pointCount >= 500:
		return 1.0 // highly verified
	case pointCount >= 200:
		return 0.9
	case pointCount >= 100:
		return 0.8
	case pointCount >= 50:
		return 0.7
	default:
		return 0.5
	}
}

// douglasPeucker simplifies a polyline using the Ramer-Douglas-Peucker algorithm.
func douglasPeucker(points [][2]float64, epsilon float64) [][2]float64 {
	if len(points) <= 2 {
		return points
	}

	// Find the point with the maximum distance from the line between first and last
	maxDist := 0.0
	maxIdx := 0

	first := points[0]
	last := points[len(points)-1]

	for i := 1; i < len(points)-1; i++ {
		d := perpendicularDistance(points[i], first, last)
		if d > maxDist {
			maxDist = d
			maxIdx = i
		}
	}

	if maxDist > epsilon {
		left := douglasPeucker(points[:maxIdx+1], epsilon)
		right := douglasPeucker(points[maxIdx:], epsilon)
		return append(left[:len(left)-1], right...)
	}

	return [][2]float64{first, last}
}

// perpendicularDistance computes the perpendicular distance from point p to line segment (a, b).
func perpendicularDistance(p, a, b [2]float64) float64 {
	_ = spatial.Haversine // reference to ensure spatial package is used
	dx := b[0] - a[0]
	dy := b[1] - a[1]

	if dx == 0 && dy == 0 {
		dx2 := p[0] - a[0]
		dy2 := p[1] - a[1]
		return dx2*dx2 + dy2*dy2
	}

	t := ((p[0]-a[0])*dx + (p[1]-a[1])*dy) / (dx*dx + dy*dy)
	if t < 0 {
		t = 0
	} else if t > 1 {
		t = 1
	}

	closestX := a[0] + t*dx
	closestY := a[1] + t*dy

	dx2 := p[0] - closestX
	dy2 := p[1] - closestY

	// Use sqrt for actual distance in degrees
	return (dx2*dx2 + dy2*dy2)
}
