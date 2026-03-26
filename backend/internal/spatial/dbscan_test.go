package spatial

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDBSCAN_SinglePoint(t *testing.T) {
	points := []DBSCANPoint{
		{Lat: 6.92, Lng: 79.86, Speed: 30, Accuracy: 10, ID: "dev1"},
	}
	clusters := DBSCAN(points, 0.05, 5.0, 1)
	require.Len(t, clusters, 1, "Single point should produce 1 cluster")
	assert.Len(t, clusters[0].Points, 1)
}

func TestDBSCAN_Empty(t *testing.T) {
	clusters := DBSCAN(nil, 0.05, 5.0, 1)
	assert.Nil(t, clusters, "Empty input should return nil")
}

func TestDBSCAN_TwoClusters_FarApart(t *testing.T) {
	points := []DBSCANPoint{
		// Cluster 1: near Colombo Fort (~10m apart)
		{Lat: 6.92710, Lng: 79.86120, Speed: 30, Accuracy: 10, ID: "dev1"},
		{Lat: 6.92715, Lng: 79.86125, Speed: 31, Accuracy: 12, ID: "dev2"},
		// Cluster 2: near Kandy (~94km away, ~10m apart)
		{Lat: 7.29060, Lng: 80.63370, Speed: 25, Accuracy: 8, ID: "dev3"},
		{Lat: 7.29065, Lng: 80.63375, Speed: 26, Accuracy: 10, ID: "dev4"},
	}
	clusters := DBSCAN(points, 0.05, 5.0, 1)
	require.Len(t, clusters, 2, "Two far-apart groups should produce 2 clusters")

	// Each cluster should have 2 points
	sizes := []int{len(clusters[0].Points), len(clusters[1].Points)}
	assert.Contains(t, sizes, 2)
}

func TestDBSCAN_ThreeDevicesSameBus(t *testing.T) {
	// 3 devices within 20m of each other, similar speed
	points := []DBSCANPoint{
		{Lat: 6.9271, Lng: 79.8612, Speed: 35, Accuracy: 8, ID: "dev1"},
		{Lat: 6.9272, Lng: 79.8613, Speed: 34, Accuracy: 10, ID: "dev2"},
		{Lat: 6.92715, Lng: 79.86125, Speed: 36, Accuracy: 12, ID: "dev3"},
	}
	clusters := DBSCAN(points, 0.05, 5.0, 1)
	require.Len(t, clusters, 1, "3 co-located devices should be 1 cluster")
	assert.Len(t, clusters[0].Points, 3)
}

func TestDBSCAN_SpeedFilter_SplitsClusters(t *testing.T) {
	// 2 devices at same location but very different speeds
	// (car vs bus at same intersection)
	points := []DBSCANPoint{
		{Lat: 6.9271, Lng: 79.8612, Speed: 30, Accuracy: 10, ID: "bus_passenger"},
		{Lat: 6.9272, Lng: 79.8613, Speed: 80, Accuracy: 10, ID: "car_driver"},
	}
	clusters := DBSCAN(points, 0.05, 5.0, 1)
	require.Len(t, clusters, 2, "Same location but 50km/h speed difference should split into 2 clusters")
}

func TestDBSCAN_SpeedFilter_KeepsTogether(t *testing.T) {
	// 2 devices at same location, similar speeds (within 5km/h tolerance)
	points := []DBSCANPoint{
		{Lat: 6.9271, Lng: 79.8612, Speed: 30, Accuracy: 10, ID: "dev1"},
		{Lat: 6.9272, Lng: 79.8613, Speed: 33, Accuracy: 10, ID: "dev2"},
	}
	clusters := DBSCAN(points, 0.05, 5.0, 1)
	require.Len(t, clusters, 1, "Same location, similar speed should be 1 cluster")
	assert.Len(t, clusters[0].Points, 2)
}

func TestDBSCAN_BusScenario_TwoBusesSameRoute(t *testing.T) {
	// 2 groups 500m apart on the same road (two different buses)
	points := []DBSCANPoint{
		// Bus 1
		{Lat: 6.9271, Lng: 79.8612, Speed: 30, Accuracy: 10, ID: "bus1_dev1"},
		{Lat: 6.9272, Lng: 79.8613, Speed: 31, Accuracy: 12, ID: "bus1_dev2"},
		// Bus 2 (~500m ahead)
		{Lat: 6.9320, Lng: 79.8650, Speed: 28, Accuracy: 8, ID: "bus2_dev1"},
		{Lat: 6.9321, Lng: 79.8651, Speed: 29, Accuracy: 10, ID: "bus2_dev2"},
	}
	clusters := DBSCAN(points, 0.05, 5.0, 1) // eps=50m
	require.Len(t, clusters, 2, "Two buses 500m apart should be 2 clusters")
}

func TestDBSCAN_NoiseBecomesCluster(t *testing.T) {
	// In our bus tracking, noise points become their own clusters
	// (a lone passenger is still a valid bus position)
	// With minPts=2, a point needs 2+ OTHER neighbors to be a core point.
	// 3 close points form a cluster, 1 far point becomes noise → gets own cluster.
	points := []DBSCANPoint{
		{Lat: 6.92710, Lng: 79.86120, Speed: 30, Accuracy: 10, ID: "close1"},
		{Lat: 6.92715, Lng: 79.86125, Speed: 31, Accuracy: 12, ID: "close2"},
		{Lat: 6.92712, Lng: 79.86122, Speed: 30, Accuracy: 8, ID: "close3"},
		{Lat: 7.0000, Lng: 80.0000, Speed: 40, Accuracy: 15, ID: "loner"}, // far from others
	}
	clusters := DBSCAN(points, 0.05, 5.0, 2) // minPts=2 means loner is noise
	require.Len(t, clusters, 2, "3 close + 1 far should produce 2 clusters")

	// Find the loner cluster
	for _, c := range clusters {
		if len(c.Points) == 1 {
			assert.Equal(t, "loner", c.Points[0].ID)
		}
	}
}

func TestDBSCAN_PreservesIDs(t *testing.T) {
	points := []DBSCANPoint{
		{Lat: 6.92, Lng: 79.86, Speed: 30, Accuracy: 10, ID: "alpha"},
		{Lat: 6.92, Lng: 79.86, Speed: 31, Accuracy: 10, ID: "beta"},
	}
	clusters := DBSCAN(points, 0.05, 5.0, 1)
	require.Len(t, clusters, 1)

	ids := make(map[string]bool)
	for _, p := range clusters[0].Points {
		ids[p.ID] = true
	}
	assert.True(t, ids["alpha"], "Should preserve point IDs")
	assert.True(t, ids["beta"], "Should preserve point IDs")
}
