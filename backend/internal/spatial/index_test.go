package spatial

import (
	"testing"

	"github.com/paulmach/orb"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func makeTestRoutes() map[string]orb.LineString {
	return map[string]orb.LineString{
		// Route 1: Colombo → Kandy (roughly NE along A1)
		"1": {
			{79.8612, 6.9271}, // Colombo
			{79.9500, 6.9800}, // Kadawatha
			{80.1000, 7.0500}, // Nittambuwa
			{80.3500, 7.1500}, // Warakapola
			{80.6337, 7.2906}, // Kandy
		},
		// Route 2: Colombo → Galle (roughly south along coast)
		"2": {
			{79.8612, 6.9271}, // Colombo
			{79.8700, 6.8500}, // Moratuwa
			{79.9000, 6.7000}, // Kalutara
			{80.0500, 6.3000}, // Ambalangoda
			{80.2210, 6.0535}, // Galle
		},
		// Route 138: Colombo → Kurunegala (NW)
		"138": {
			{79.8612, 6.9271}, // Colombo
			{79.8400, 7.0500}, // Negombo area
			{79.9500, 7.2000}, // Chilaw area
			{80.3500, 7.4500}, // Kurunegala
		},
	}
}

func TestRouteIndex_NewEmpty(t *testing.T) {
	idx := NewRouteIndex()
	assert.Equal(t, 0, idx.Count())
}

func TestRouteIndex_Load(t *testing.T) {
	idx := NewRouteIndex()
	routes := makeTestRoutes()
	idx.Load(routes)
	assert.Equal(t, 3, idx.Count())
}

func TestRouteIndex_Load_SkipsShortLines(t *testing.T) {
	idx := NewRouteIndex()
	routes := map[string]orb.LineString{
		"good":  {{79.86, 6.92}, {79.87, 6.93}},
		"short": {{79.86, 6.92}}, // only 1 point — should be skipped
		"empty": {},               // empty — should be skipped
	}
	idx.Load(routes)
	assert.Equal(t, 1, idx.Count(), "Should skip lines with <2 points")
}

func TestRouteIndex_GetPolyline(t *testing.T) {
	idx := NewRouteIndex()
	idx.Load(makeTestRoutes())

	line, ok := idx.GetPolyline("1")
	require.True(t, ok)
	assert.Len(t, line, 5, "Route 1 should have 5 points")

	_, ok = idx.GetPolyline("nonexistent")
	assert.False(t, ok)
}

func TestRouteIndex_Nearby_Colombo(t *testing.T) {
	idx := NewRouteIndex()
	idx.Load(makeTestRoutes())

	// Query near Colombo — all 3 routes pass through Colombo
	results := idx.Nearby(6.9271, 79.8612, 0.1) // ~10km buffer
	assert.GreaterOrEqual(t, len(results), 3, "All routes pass through Colombo")
}

func TestRouteIndex_Nearby_Kandy(t *testing.T) {
	idx := NewRouteIndex()
	idx.Load(makeTestRoutes())

	// Query near Kandy — only Route 1 goes there
	results := idx.Nearby(7.2906, 80.6337, 0.05) // ~5km buffer
	assert.Contains(t, results, "1", "Route 1 should be near Kandy")
	assert.NotContains(t, results, "2", "Route 2 (Galle) should not be near Kandy")
}

func TestRouteIndex_Nearby_NoResults(t *testing.T) {
	idx := NewRouteIndex()
	idx.Load(makeTestRoutes())

	// Query in the ocean east of Sri Lanka
	results := idx.Nearby(7.0, 83.0, 0.01)
	assert.Empty(t, results, "No routes in the ocean")
}

func TestRouteIndex_NearbyFromTrace(t *testing.T) {
	idx := NewRouteIndex()
	idx.Load(makeTestRoutes())

	// A trace along the Colombo-Kandy corridor
	trace := orb.LineString{
		{79.95, 6.98},  // near Kadawatha
		{80.10, 7.05},  // near Nittambuwa
		{80.35, 7.15},  // near Warakapola
	}
	results := idx.NearbyFromTrace(trace, 0.05)
	assert.Contains(t, results, "1", "Trace along Route 1 corridor should find Route 1")
}

func TestRouteIndex_NearbyFromTrace_Empty(t *testing.T) {
	idx := NewRouteIndex()
	idx.Load(makeTestRoutes())

	results := idx.NearbyFromTrace(orb.LineString{}, 0.05)
	assert.Nil(t, results, "Empty trace should return nil")
}

func TestRouteIndex_Reload(t *testing.T) {
	idx := NewRouteIndex()
	idx.Load(makeTestRoutes())
	assert.Equal(t, 3, idx.Count())

	// Reload with fewer routes
	idx.Load(map[string]orb.LineString{
		"only_one": {{79.86, 6.92}, {79.87, 6.93}},
	})
	assert.Equal(t, 1, idx.Count(), "Reload should replace all routes")
}

func TestRouteIndex_ConcurrentAccess(t *testing.T) {
	idx := NewRouteIndex()
	idx.Load(makeTestRoutes())

	// Concurrent reads should not panic
	done := make(chan bool, 10)
	for i := 0; i < 10; i++ {
		go func() {
			idx.Nearby(6.9271, 79.8612, 0.1)
			idx.GetPolyline("1")
			idx.Count()
			done <- true
		}()
	}
	for i := 0; i < 10; i++ {
		<-done
	}
}
