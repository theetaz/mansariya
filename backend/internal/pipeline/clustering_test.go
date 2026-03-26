package pipeline

import (
	"testing"
	"time"

	"github.com/masariya/backend/internal/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestClusterVehicles_Empty(t *testing.T) {
	vehicles := ClusterVehicles(nil)
	assert.Nil(t, vehicles)
}

func TestClusterVehicles_SingleDevice(t *testing.T) {
	now := time.Now()
	devices := []DeviceState{
		{DeviceHash: "dev1", RouteID: "138", Lat: 6.9271, Lng: 79.8612, SpeedKMH: 30, Bearing: 45, Accuracy: 10, LastSeen: now},
	}

	vehicles := ClusterVehicles(devices)
	require.Len(t, vehicles, 1)

	v := vehicles[0]
	assert.Equal(t, "138", v.RouteID)
	assert.Equal(t, 6.9271, v.Lat)
	assert.Equal(t, 79.8612, v.Lng)
	assert.Equal(t, 30.0, v.SpeedKMH)
	assert.Equal(t, 1, v.ContributorCount)
	assert.Equal(t, model.ConfidenceLow, v.Confidence)
}

func TestClusterVehicles_TwoDevicesSameBus(t *testing.T) {
	now := time.Now()
	devices := []DeviceState{
		{DeviceHash: "dev1", RouteID: "138", Lat: 6.92710, Lng: 79.86120, SpeedKMH: 30, Bearing: 45, Accuracy: 10, LastSeen: now},
		{DeviceHash: "dev2", RouteID: "138", Lat: 6.92715, Lng: 79.86125, SpeedKMH: 32, Bearing: 46, Accuracy: 8, LastSeen: now},
	}

	vehicles := ClusterVehicles(devices)
	require.Len(t, vehicles, 1)

	v := vehicles[0]
	assert.Equal(t, "138", v.RouteID)
	assert.Equal(t, 2, v.ContributorCount)
	assert.Equal(t, model.ConfidenceGood, v.Confidence)
	// Fused position should be weighted average
	assert.InDelta(t, 6.927, v.Lat, 0.001)
	assert.InDelta(t, 79.861, v.Lng, 0.001)
}

func TestClusterVehicles_ThreeDevicesVerified(t *testing.T) {
	now := time.Now()
	devices := []DeviceState{
		{DeviceHash: "dev1", RouteID: "1", Lat: 6.92710, Lng: 79.86120, SpeedKMH: 30, Bearing: 45, Accuracy: 10, LastSeen: now},
		{DeviceHash: "dev2", RouteID: "1", Lat: 6.92712, Lng: 79.86122, SpeedKMH: 31, Bearing: 45, Accuracy: 8, LastSeen: now},
		{DeviceHash: "dev3", RouteID: "1", Lat: 6.92714, Lng: 79.86124, SpeedKMH: 29, Bearing: 44, Accuracy: 12, LastSeen: now},
	}

	vehicles := ClusterVehicles(devices)
	require.Len(t, vehicles, 1)
	assert.Equal(t, 3, vehicles[0].ContributorCount)
	assert.Equal(t, model.ConfidenceVerified, vehicles[0].Confidence)
}

func TestClusterVehicles_DifferentRoutes(t *testing.T) {
	now := time.Now()
	devices := []DeviceState{
		{DeviceHash: "dev1", RouteID: "1", Lat: 6.927, Lng: 79.861, SpeedKMH: 30, LastSeen: now},
		{DeviceHash: "dev2", RouteID: "138", Lat: 6.927, Lng: 79.861, SpeedKMH: 30, LastSeen: now},
	}

	vehicles := ClusterVehicles(devices)
	require.Len(t, vehicles, 2, "Same location but different routes = 2 vehicles")

	routeIDs := map[string]bool{}
	for _, v := range vehicles {
		routeIDs[v.RouteID] = true
	}
	assert.True(t, routeIDs["1"])
	assert.True(t, routeIDs["138"])
}

func TestClusterVehicles_TwoBusesSameRoute(t *testing.T) {
	now := time.Now()
	devices := []DeviceState{
		// Bus 1 near Colombo
		{DeviceHash: "dev1", RouteID: "1", Lat: 6.92710, Lng: 79.86120, SpeedKMH: 30, Accuracy: 10, LastSeen: now},
		{DeviceHash: "dev2", RouteID: "1", Lat: 6.92715, Lng: 79.86125, SpeedKMH: 31, Accuracy: 8, LastSeen: now},
		// Bus 2 near Kadawatha (~5km away, ~10m apart internally)
		{DeviceHash: "dev3", RouteID: "1", Lat: 6.98000, Lng: 79.95000, SpeedKMH: 28, Accuracy: 10, LastSeen: now},
		{DeviceHash: "dev4", RouteID: "1", Lat: 6.98005, Lng: 79.95005, SpeedKMH: 29, Accuracy: 12, LastSeen: now},
	}

	vehicles := ClusterVehicles(devices)
	require.Len(t, vehicles, 2, "Two buses 5km apart on same route = 2 vehicles")

	for _, v := range vehicles {
		assert.Equal(t, "1", v.RouteID)
		assert.Equal(t, 2, v.ContributorCount)
		assert.Equal(t, model.ConfidenceGood, v.Confidence)
	}
}

func TestClusterVehicles_WeightedFusion(t *testing.T) {
	now := time.Now()
	devices := []DeviceState{
		// High accuracy device (weight = 1/5 = 0.2)
		{DeviceHash: "accurate", RouteID: "1", Lat: 6.92700, Lng: 79.86100, SpeedKMH: 30, Accuracy: 5, LastSeen: now},
		// Low accuracy device (weight = 1/20 = 0.05) — ~15m apart
		{DeviceHash: "inaccurate", RouteID: "1", Lat: 6.92710, Lng: 79.86110, SpeedKMH: 32, Accuracy: 20, LastSeen: now},
	}

	vehicles := ClusterVehicles(devices)
	require.Len(t, vehicles, 1)

	v := vehicles[0]
	// Fused position should be closer to the accurate device (higher weight)
	assert.InDelta(t, 6.9270, v.Lat, 0.0005) // closer to accurate (6.92700)
}

func TestClusterVehicles_VirtualIDConsistency(t *testing.T) {
	now := time.Now()
	devices := []DeviceState{
		{DeviceHash: "dev1", RouteID: "1", Lat: 6.927, Lng: 79.861, SpeedKMH: 30, Accuracy: 10, LastSeen: now},
	}

	v1 := ClusterVehicles(devices)
	v2 := ClusterVehicles(devices)

	require.Len(t, v1, 1)
	require.Len(t, v2, 1)
	assert.Equal(t, v1[0].VirtualID, v2[0].VirtualID, "Same input should produce same virtual ID")
}

func TestClusterVehicles_VirtualIDHasRoutePrefix(t *testing.T) {
	now := time.Now()
	devices := []DeviceState{
		{DeviceHash: "dev1", RouteID: "138", Lat: 6.927, Lng: 79.861, SpeedKMH: 30, LastSeen: now},
	}

	vehicles := ClusterVehicles(devices)
	require.Len(t, vehicles, 1)
	assert.Contains(t, vehicles[0].VirtualID, "v_138", "Virtual ID should contain route ID")
}

func TestClusterVehicles_LastUpdatePropagated(t *testing.T) {
	t1 := time.Date(2026, 3, 26, 10, 0, 0, 0, time.UTC)
	t2 := time.Date(2026, 3, 26, 10, 0, 5, 0, time.UTC) // 5s later

	devices := []DeviceState{
		{DeviceHash: "dev1", RouteID: "1", Lat: 6.92710, Lng: 79.86120, SpeedKMH: 30, Accuracy: 10, LastSeen: t1},
		{DeviceHash: "dev2", RouteID: "1", Lat: 6.92715, Lng: 79.86125, SpeedKMH: 31, Accuracy: 8, LastSeen: t2},
	}

	vehicles := ClusterVehicles(devices)
	require.Len(t, vehicles, 1)
	assert.Equal(t, t2, vehicles[0].LastUpdate, "Should use the most recent timestamp")
}
