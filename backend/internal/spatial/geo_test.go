package spatial

import (
	"math"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHaversine(t *testing.T) {
	tests := []struct {
		name     string
		lat1     float64
		lng1     float64
		lat2     float64
		lng2     float64
		wantKM   float64
		tolerance float64
	}{
		{
			name:     "Colombo to Kandy (~94 km great circle)",
			lat1:     6.9271, lng1: 79.8612,
			lat2:     7.2906, lng2: 80.6337,
			wantKM:   94.0,
			tolerance: 5.0,
		},
		{
			name:     "Colombo to Galle (~120 km)",
			lat1:     6.9271, lng1: 79.8612,
			lat2:     6.0535, lng2: 80.2210,
			wantKM:   103.0,
			tolerance: 5.0,
		},
		{
			name:     "Same point is zero distance",
			lat1:     6.9271, lng1: 79.8612,
			lat2:     6.9271, lng2: 79.8612,
			wantKM:   0.0,
			tolerance: 0.001,
		},
		{
			name:     "Short distance within Colombo (~2 km)",
			lat1:     6.9271, lng1: 79.8612, // Colombo Fort
			lat2:     6.9110, lng2: 79.8440, // Kollupitiya
			wantKM:   2.5,
			tolerance: 1.0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Haversine(tt.lat1, tt.lng1, tt.lat2, tt.lng2)
			assert.InDelta(t, tt.wantKM, got, tt.tolerance,
				"Haversine(%v,%v → %v,%v) = %v, want ~%v",
				tt.lat1, tt.lng1, tt.lat2, tt.lng2, got, tt.wantKM)
		})
	}
}

func TestHaversine_Symmetry(t *testing.T) {
	// Distance A→B should equal B→A
	d1 := Haversine(6.9271, 79.8612, 7.2906, 80.6337)
	d2 := Haversine(7.2906, 80.6337, 6.9271, 79.8612)
	assert.InDelta(t, d1, d2, 0.001, "Haversine should be symmetric")
}

func TestHaversine_NonNegative(t *testing.T) {
	got := Haversine(6.9271, 79.8612, 7.2906, 80.6337)
	assert.GreaterOrEqual(t, got, 0.0, "Distance must be non-negative")
}

func TestBearing(t *testing.T) {
	tests := []struct {
		name     string
		lat1     float64
		lng1     float64
		lat2     float64
		lng2     float64
		wantDeg  float64
		tolerance float64
	}{
		{
			name:     "Due north",
			lat1:     6.0, lng1: 80.0,
			lat2:     7.0, lng2: 80.0,
			wantDeg:  0.0,
			tolerance: 1.0,
		},
		{
			name:     "Due east",
			lat1:     6.0, lng1: 80.0,
			lat2:     6.0, lng2: 81.0,
			wantDeg:  90.0,
			tolerance: 2.0,
		},
		{
			name:     "Due south",
			lat1:     7.0, lng1: 80.0,
			lat2:     6.0, lng2: 80.0,
			wantDeg:  180.0,
			tolerance: 1.0,
		},
		{
			name:     "Due west",
			lat1:     6.0, lng1: 81.0,
			lat2:     6.0, lng2: 80.0,
			wantDeg:  270.0,
			tolerance: 2.0,
		},
		{
			name:     "Colombo to Kandy (roughly northeast ~50°)",
			lat1:     6.9271, lng1: 79.8612,
			lat2:     7.2906, lng2: 80.6337,
			wantDeg:  65.0,
			tolerance: 10.0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Bearing(tt.lat1, tt.lng1, tt.lat2, tt.lng2)
			assert.InDelta(t, tt.wantDeg, got, tt.tolerance)
			assert.GreaterOrEqual(t, got, 0.0, "Bearing must be >= 0")
			assert.Less(t, got, 360.0, "Bearing must be < 360")
		})
	}
}

func TestBearingDifference(t *testing.T) {
	tests := []struct {
		name string
		b1   float64
		b2   float64
		want float64
	}{
		{"Same bearing", 90, 90, 0},
		{"Opposite bearings", 0, 180, 180},
		{"Wrap around 360/0", 350, 10, 20},
		{"Wrap around 10/350", 10, 350, 20},
		{"90 degrees apart", 0, 90, 90},
		{"270 vs 90", 270, 90, 180},
		{"Small difference", 45, 50, 5},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := BearingDifference(tt.b1, tt.b2)
			assert.InDelta(t, tt.want, got, 0.01)
		})
	}
}

func TestBearingDifference_Symmetry(t *testing.T) {
	d1 := BearingDifference(30, 60)
	d2 := BearingDifference(60, 30)
	assert.Equal(t, d1, d2, "BearingDifference should be symmetric")
}

func TestBearingDifference_Range(t *testing.T) {
	// Result should always be 0-180
	for b1 := 0.0; b1 < 360; b1 += 15 {
		for b2 := 0.0; b2 < 360; b2 += 15 {
			got := BearingDifference(b1, b2)
			require.GreaterOrEqual(t, got, 0.0)
			require.LessOrEqual(t, got, 180.0)
		}
	}
}

func TestPointToSegmentDistance(t *testing.T) {
	tests := []struct {
		name      string
		pLat      float64
		pLng      float64
		aLat      float64
		aLng      float64
		bLat      float64
		bLng      float64
		maxDistKM float64
	}{
		{
			name: "Point on the segment endpoint A",
			pLat: 6.0, pLng: 80.0,
			aLat: 6.0, aLng: 80.0,
			bLat: 7.0, bLng: 80.0,
			maxDistKM: 0.1,
		},
		{
			name: "Point on the segment endpoint B",
			pLat: 7.0, pLng: 80.0,
			aLat: 6.0, aLng: 80.0,
			bLat: 7.0, bLng: 80.0,
			maxDistKM: 0.1,
		},
		{
			name: "Point near the midpoint",
			pLat: 6.5, pLng: 80.001, // slightly off the N-S line
			aLat: 6.0, aLng: 80.0,
			bLat: 7.0, bLng: 80.0,
			maxDistKM: 0.2,
		},
		{
			name: "Point far from segment",
			pLat: 6.5, pLng: 81.0, // ~100km east
			aLat: 6.0, aLng: 80.0,
			bLat: 7.0, bLng: 80.0,
			maxDistKM: 120.0, // should be roughly the perpendicular distance
		},
		{
			name: "Zero-length segment (A==B)",
			pLat: 6.5, pLng: 80.5,
			aLat: 6.0, aLng: 80.0,
			bLat: 6.0, bLng: 80.0,
			maxDistKM: 80.0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := PointToSegmentDistance(tt.pLat, tt.pLng, tt.aLat, tt.aLng, tt.bLat, tt.bLng)
			assert.GreaterOrEqual(t, got, 0.0, "Distance must be non-negative")
			assert.LessOrEqual(t, got, tt.maxDistKM, "Distance %v exceeds max %v", got, tt.maxDistKM)
		})
	}
}

func TestPointToSegmentDistance_NonNegative(t *testing.T) {
	got := PointToSegmentDistance(6.5, 80.5, 6.0, 80.0, 7.0, 81.0)
	assert.False(t, math.IsNaN(got), "Distance must not be NaN")
	assert.GreaterOrEqual(t, got, 0.0)
}
