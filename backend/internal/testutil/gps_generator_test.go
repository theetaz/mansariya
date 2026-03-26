package testutil

import (
	"testing"

	"github.com/paulmach/orb"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var testRoute = orb.LineString{
	{79.8612, 6.9271},
	{79.9500, 6.9800},
	{80.1000, 7.0500},
	{80.3500, 7.1500},
	{80.6337, 7.2906},
}

func TestGenerateGPSBatch(t *testing.T) {
	cfg := DefaultGPSConfig()
	batch := GenerateGPSBatch(testRoute, "testdevice1234", cfg)

	assert.Equal(t, "testdevice1234", batch.DeviceHash)
	assert.NotEmpty(t, batch.SessionID)
	require.Len(t, batch.Pings, cfg.PointCount)

	// Pings should be near the route (within noise tolerance)
	for _, p := range batch.Pings {
		assert.InDelta(t, 7.0, p.Lat, 0.5, "Lat should be near Sri Lanka")
		assert.InDelta(t, 80.0, p.Lng, 1.0, "Lng should be near Sri Lanka")
		assert.Greater(t, p.Accuracy, 0.0)
		assert.Greater(t, p.Speed, 0.0)
		assert.NotZero(t, p.Timestamp)
	}

	// Timestamps should be sequential
	for i := 1; i < len(batch.Pings); i++ {
		assert.Greater(t, batch.Pings[i].Timestamp, batch.Pings[i-1].Timestamp)
	}
}

func TestGenerateGPSBatch_CustomConfig(t *testing.T) {
	cfg := GPSTraceConfig{
		NoiseDeg:    0.0001,
		SpeedKMH:    50,
		IntervalSec: 3,
		PointCount:  5,
	}
	batch := GenerateGPSBatch(testRoute, "dev123", cfg)
	assert.Len(t, batch.Pings, 5)
}

func TestGenerateGPSBatch_EmptyRoute(t *testing.T) {
	cfg := DefaultGPSConfig()
	batch := GenerateGPSBatch(orb.LineString{}, "dev", cfg)
	assert.Empty(t, batch.Pings)
}

func TestGenerateMultiDeviceBatches(t *testing.T) {
	cfg := DefaultGPSConfig()
	batches := GenerateMultiDeviceBatches(testRoute, 3, cfg)

	require.Len(t, batches, 3)

	// Each batch should have a different device hash
	hashes := map[string]bool{}
	for _, b := range batches {
		assert.NotEmpty(t, b.DeviceHash)
		hashes[b.DeviceHash] = true
		assert.Len(t, b.Pings, cfg.PointCount)
	}
	assert.Len(t, hashes, 3, "Each device should have unique hash")
}

func TestSampleAlongLine(t *testing.T) {
	points := sampleAlongLine(testRoute, 5)
	require.Len(t, points, 5)

	// First point should be near route start
	assert.InDelta(t, testRoute[0][0], points[0][0], 0.01)
	assert.InDelta(t, testRoute[0][1], points[0][1], 0.01)
}

func TestSampleAlongLine_TwoPoints(t *testing.T) {
	points := sampleAlongLine(testRoute, 2)
	require.Len(t, points, 2)
}

func TestSampleAlongLine_OnePoint(t *testing.T) {
	points := sampleAlongLine(testRoute, 1)
	require.Len(t, points, 1)
}

func TestSampleAlongLine_Empty(t *testing.T) {
	points := sampleAlongLine(orb.LineString{}, 5)
	assert.Nil(t, points)
}
