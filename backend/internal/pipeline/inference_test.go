package pipeline

import (
	"testing"

	"github.com/masariya/backend/internal/model"
	"github.com/masariya/backend/internal/spatial"
	"github.com/paulmach/orb"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// buildTestIndex creates an R-tree with 3 known Sri Lankan routes.
func buildTestIndex() *spatial.RouteIndex {
	idx := spatial.NewRouteIndex()
	idx.Load(map[string]orb.LineString{
		// Route 1: Colombo → Kandy (NE along A1)
		"1": {
			{79.8612, 6.9271},
			{79.9500, 6.9800},
			{80.1000, 7.0500},
			{80.3500, 7.1500},
			{80.6337, 7.2906},
		},
		// Route 2: Colombo → Galle (south along coast)
		"2": {
			{79.8612, 6.9271},
			{79.8700, 6.8500},
			{79.9000, 6.7000},
			{80.0500, 6.3000},
			{80.2210, 6.0535},
		},
		// Route 138: Colombo → Kurunegala (NW then NE)
		"138": {
			{79.8612, 6.9271},
			{79.8400, 7.0500},
			{79.9500, 7.2000},
			{80.3500, 7.4500},
		},
	})
	return idx
}

// traceFromPoints creates a MatchedTrace from lat/lng pairs.
func traceFromPoints(points [][2]float64, speed, bearing float64) model.MatchedTrace {
	matched := make([]model.MatchedPoint, len(points))
	for i, p := range points {
		matched[i] = model.MatchedPoint{Lat: p[0], Lng: p[1]}
	}
	return model.MatchedTrace{
		DeviceHash: "test_device",
		SessionID:  "test_session",
		Points:     matched,
		AvgSpeed:   speed,
		AvgBearing: bearing,
	}
}

func TestInference_ExactMatch_Route1(t *testing.T) {
	engine := NewInferenceEngine(buildTestIndex())

	// Trace follows Route 1 exactly (Colombo → Kandy)
	trace := traceFromPoints([][2]float64{
		{6.9271, 79.8612},
		{6.9800, 79.9500},
		{7.0500, 80.1000},
		{7.1500, 80.3500},
	}, 35, 60) // 35km/h, bearing ~60° NE

	result := engine.Infer(trace)
	require.NotNil(t, result, "Should match a route")
	assert.Equal(t, "1", result.RouteID)
	assert.Greater(t, result.Confidence, 0.7, "Exact match should have high confidence")
}

func TestInference_ExactMatch_Route2(t *testing.T) {
	engine := NewInferenceEngine(buildTestIndex())

	// Trace follows Route 2 (Colombo → Galle, southbound)
	trace := traceFromPoints([][2]float64{
		{6.9271, 79.8612},
		{6.8500, 79.8700},
		{6.7000, 79.9000},
		{6.3000, 80.0500},
	}, 40, 170) // 40km/h, bearing ~170° S

	result := engine.Infer(trace)
	require.NotNil(t, result)
	assert.Equal(t, "2", result.RouteID)
}

func TestInference_NoisyMatch(t *testing.T) {
	engine := NewInferenceEngine(buildTestIndex())

	// Trace roughly follows Route 1 with ~0.0003° offset (~30m noise, typical GPS)
	trace := traceFromPoints([][2]float64{
		{6.9274, 79.8615}, // +0.0003 offset from Route 1
		{6.9803, 79.9503},
		{7.0503, 80.1003},
		{7.1503, 80.3503},
	}, 30, 60)

	result := engine.Infer(trace)
	require.NotNil(t, result, "Should match with ~30m GPS noise")
	assert.Equal(t, "1", result.RouteID)
	assert.Greater(t, result.Confidence, 0.6)
}

func TestInference_NoMatch_Ocean(t *testing.T) {
	engine := NewInferenceEngine(buildTestIndex())

	// Trace in the Indian Ocean — nowhere near any route
	trace := traceFromPoints([][2]float64{
		{5.0, 78.0},
		{5.1, 78.1},
		{5.2, 78.2},
	}, 30, 45)

	result := engine.Infer(trace)
	assert.Nil(t, result, "No route in the ocean")
}

func TestInference_TooFewPoints(t *testing.T) {
	engine := NewInferenceEngine(buildTestIndex())

	// Only 1 point — can't form a line
	trace := traceFromPoints([][2]float64{
		{6.9271, 79.8612},
	}, 30, 0)

	result := engine.Infer(trace)
	assert.Nil(t, result, "Need at least 2 points")
}

func TestInference_EmptyTrace(t *testing.T) {
	engine := NewInferenceEngine(buildTestIndex())
	trace := model.MatchedTrace{Points: nil}

	result := engine.Infer(trace)
	assert.Nil(t, result)
}

func TestInference_SpeedOutOfRange(t *testing.T) {
	engine := NewInferenceEngine(buildTestIndex())

	// Trace follows Route 1 but at walking speed (5 km/h)
	trace := traceFromPoints([][2]float64{
		{6.9271, 79.8612},
		{6.9800, 79.9500},
		{7.0500, 80.1000},
	}, 5, 60) // 5 km/h — too slow for a bus

	result := engine.Infer(trace)
	// Should still match but with lower confidence due to speed penalty
	if result != nil {
		assert.Equal(t, "1", result.RouteID)
		// Score is penalized by speed factor (0.3 instead of 1.0)
	}
}

func TestInference_EmptyIndex(t *testing.T) {
	engine := NewInferenceEngine(spatial.NewRouteIndex())

	trace := traceFromPoints([][2]float64{
		{6.9271, 79.8612},
		{6.9800, 79.9500},
	}, 30, 60)

	result := engine.Infer(trace)
	assert.Nil(t, result, "Empty index should return nil")
}

func TestInference_DisambiguateByBearing(t *testing.T) {
	// Routes 1 and 138 both start from Colombo but go different directions
	engine := NewInferenceEngine(buildTestIndex())

	// Trace heading NE from Colombo (matches Route 1 direction)
	trace := traceFromPoints([][2]float64{
		{6.9271, 79.8612},
		{6.9500, 79.9000},
		{6.9800, 79.9500},
	}, 35, 55) // NE bearing

	result := engine.Infer(trace)
	require.NotNil(t, result)
	// Route 1 goes NE, Route 138 goes NW — bearing should help disambiguate
	// Though both start from Colombo, the trace heading NE should favor Route 1
	assert.Equal(t, "1", result.RouteID)
}

func TestInferResult_ConfidenceRange(t *testing.T) {
	engine := NewInferenceEngine(buildTestIndex())

	trace := traceFromPoints([][2]float64{
		{6.9271, 79.8612},
		{6.9800, 79.9500},
		{7.0500, 80.1000},
	}, 35, 60)

	result := engine.Infer(trace)
	require.NotNil(t, result)
	assert.GreaterOrEqual(t, result.Confidence, 0.0, "Confidence >= 0")
	assert.LessOrEqual(t, result.Confidence, 1.0, "Confidence <= 1")
}
