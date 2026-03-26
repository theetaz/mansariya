package service

import (
	"testing"

	"github.com/masariya/backend/internal/spatial"
	"github.com/paulmach/orb"
	"github.com/stretchr/testify/assert"
)

var testRoute = orb.LineString{
	{79.8612, 6.9271}, // Colombo
	{79.9500, 6.9800}, // Kadawatha
	{80.1000, 7.0500}, // Nittambuwa
	{80.3500, 7.1500}, // Warakapola
	{80.6337, 7.2906}, // Kandy
}

func TestNearestSegmentIndex(t *testing.T) {
	tests := []struct {
		name    string
		lat     float64
		lng     float64
		wantIdx int
	}{
		{"At Colombo", 6.9271, 79.8612, 0},
		{"At Kandy", 7.2906, 80.6337, 4},
		{"Near Nittambuwa", 7.0500, 80.1000, 2},
		{"Between Kadawatha and Nittambuwa", 7.01, 80.02, 1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			idx := nearestSegmentIndex(testRoute, tt.lat, tt.lng)
			assert.Equal(t, tt.wantIdx, idx)
		})
	}
}

func TestDistanceAlongRoute(t *testing.T) {
	// Bus at Colombo (idx 0), stop at Kandy (idx 4)
	dist := distanceAlongRoute(testRoute, 6.9271, 79.8612, 7.2906, 80.6337)
	assert.Greater(t, dist, 50.0, "Colombo→Kandy should be >50km along route")
	assert.Less(t, dist, 150.0, "Colombo→Kandy should be <150km along route")
}

func TestDistanceAlongRoute_BusPastStop(t *testing.T) {
	// Bus at Kandy (idx 4), stop at Colombo (idx 0) → already passed
	dist := distanceAlongRoute(testRoute, 7.2906, 80.6337, 6.9271, 79.8612)
	assert.Less(t, dist, 0.0, "Bus past stop should return negative")
}

func TestDistanceAlongRoute_SamePoint(t *testing.T) {
	dist := distanceAlongRoute(testRoute, 6.9271, 79.8612, 6.9271, 79.8612)
	assert.InDelta(t, 0.0, dist, 1.0, "Same point should be ~0 km")
}

func TestETAService_NewEmpty(t *testing.T) {
	idx := spatial.NewRouteIndex()
	svc := NewETAService(nil, idx)
	assert.NotNil(t, svc)
}
