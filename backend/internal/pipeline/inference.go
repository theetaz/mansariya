package pipeline

import (
	"github.com/masariya/backend/internal/model"
	"github.com/masariya/backend/internal/spatial"
	"github.com/paulmach/orb"
)

const (
	// Route inference thresholds
	maxHausdorffDeg  = 0.005  // ~500m — reject routes further than this
	coverageBuffer   = 0.0003 // ~30m buffer for coverage calculation
	confidenceThresh = 0.6    // minimum score to assign a route
)

// InferenceEngine matches GPS traces against known route polylines.
type InferenceEngine struct {
	index *spatial.RouteIndex
}

func NewInferenceEngine(index *spatial.RouteIndex) *InferenceEngine {
	return &InferenceEngine{index: index}
}

// InferResult contains the route inference outcome.
type InferResult struct {
	RouteID    string
	Confidence float64
}

// Infer determines which bus route a matched trace most likely belongs to.
// Returns the best matching route and confidence score.
func (ie *InferenceEngine) Infer(trace model.MatchedTrace) *InferResult {
	if len(trace.Points) < 2 {
		return nil
	}

	// Convert matched points to an orb.LineString
	line := make(orb.LineString, len(trace.Points))
	for i, p := range trace.Points {
		line[i] = orb.Point{p.Lng, p.Lat}
	}

	// Use R-tree to find candidate routes near this trace
	// Buffer of ~5km in degrees
	candidates := ie.index.NearbyFromTrace(line, 0.05)
	if len(candidates) == 0 {
		return nil
	}

	var bestRouteID string
	var bestScore float64

	for _, routeID := range candidates {
		routeLine, ok := ie.index.GetPolyline(routeID)
		if !ok || len(routeLine) < 2 {
			continue
		}

		// 1. Hausdorff distance — how far does the trace deviate from the route?
		hausdorff := spatial.Hausdorff(line, routeLine)
		if hausdorff > maxHausdorffDeg {
			continue
		}

		// 2. Coverage — what fraction of the trace overlaps the route?
		coverage := spatial.Coverage(line, routeLine, coverageBuffer)

		// 3. Direction consistency
		bearingScore := scoreBearing(trace.AvgBearing, routeLine)

		// 4. Speed consistency — buses typically 10-70 km/h
		speedScore := 1.0
		if trace.AvgSpeed < 10 || trace.AvgSpeed > 70 {
			speedScore = 0.3
		}

		// Combined weighted score
		score := coverage*0.5 +
			(1-clamp(hausdorff/maxHausdorffDeg, 0, 1))*0.25 +
			bearingScore*0.15 +
			speedScore*0.1

		if score > bestScore {
			bestScore = score
			bestRouteID = routeID
		}
	}

	if bestScore < confidenceThresh || bestRouteID == "" {
		return nil
	}

	return &InferResult{
		RouteID:    bestRouteID,
		Confidence: bestScore,
	}
}

// scoreBearing checks if the trace direction matches the route direction.
func scoreBearing(traceBearing float64, routeLine orb.LineString) float64 {
	if len(routeLine) < 2 {
		return 0
	}

	// Compute route bearing from first to last point
	first := routeLine[0]
	last := routeLine[len(routeLine)-1]
	routeBearing := spatial.Bearing(first.Lat(), first.Lon(), last.Lat(), last.Lon())

	diff := spatial.BearingDifference(traceBearing, routeBearing)

	if diff < 30 {
		return 1.0 // same direction
	}
	if diff > 150 {
		return 0.5 // opposite direction (return trip)
	}
	return 0.0 // perpendicular — probably wrong route
}

func clamp(val, min, max float64) float64 {
	if val < min {
		return min
	}
	if val > max {
		return max
	}
	return val
}
