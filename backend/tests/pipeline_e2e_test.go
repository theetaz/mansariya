package tests

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/masariya/backend/internal/model"
	"github.com/masariya/backend/internal/pipeline"
	"github.com/masariya/backend/internal/spatial"
	"github.com/masariya/backend/internal/testutil"
	"github.com/masariya/backend/internal/valhalla"
	"github.com/paulmach/orb"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func redisAddr() string {
	addr := os.Getenv("REDIS_ADDR")
	if addr == "" {
		addr = "localhost:6379"
	}
	return addr
}

func skipIfNoRedis(t *testing.T) *redis.Client {
	t.Helper()
	rdb := redis.NewClient(&redis.Options{Addr: redisAddr()})
	if err := rdb.Ping(context.Background()).Err(); err != nil {
		t.Skipf("Redis not available: %v", err)
	}
	return rdb
}

// Route 1: Colombo → Kandy
var route1 = orb.LineString{
	{79.8612, 6.9271},
	{79.9500, 6.9800},
	{80.1000, 7.0500},
	{80.3500, 7.1500},
	{80.6337, 7.2906},
}

// mockValhallaServer returns a Valhalla that echoes back the input points as matched points.
func mockValhallaServer(t *testing.T) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/trace_route" {
			http.NotFound(w, r)
			return
		}

		var req valhalla.TraceRouteRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		// Echo input points as matched points (simulates perfect map-matching)
		resp := valhalla.TraceRouteResponse{}
		for _, sp := range req.Shape {
			resp.Trip.MatchedPoints = append(resp.Trip.MatchedPoints, valhalla.MatchedPointResult{
				Lat:  sp.Lat,
				Lon:  sp.Lon,
				Type: "matched",
			})
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
}

func TestPipeline_EndToEnd(t *testing.T) {
	rdb := skipIfNoRedis(t)
	defer rdb.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	// Clean Redis
	rdb.Del(ctx, pipeline.StreamRawGPS)
	rdb.Del(ctx, pipeline.StreamMatchedGPS)

	// 1. Set up route index
	routeIndex := spatial.NewRouteIndex()
	routeIndex.Load(map[string]orb.LineString{"1": route1})

	// 2. Start mock Valhalla
	mockValhalla := mockValhallaServer(t)
	defer mockValhalla.Close()

	vc := valhalla.NewClient(mockValhalla.URL)

	// 3. Set up pipeline components
	ingester := pipeline.NewIngester(rdb)
	mapMatcher := pipeline.NewMapMatcher(rdb, vc)
	broadcaster := pipeline.NewBroadcaster(rdb)
	inferenceEngine := pipeline.NewInferenceEngine(routeIndex)
	processor := pipeline.NewProcessor(rdb, inferenceEngine, broadcaster)

	// 4. Create consumer groups
	err := mapMatcher.EnsureConsumerGroup(ctx)
	require.NoError(t, err)

	// 5. Start pipeline workers
	workerCtx, workerCancel := context.WithCancel(ctx)
	defer workerCancel()

	go mapMatcher.Run(workerCtx)
	go processor.Run(workerCtx)

	// 6. Subscribe to Pub/Sub to catch the broadcast
	pubsub := rdb.PSubscribe(ctx, "route:*")
	defer pubsub.Close()

	// 7. Generate and ingest a synthetic GPS batch along Route 1
	cfg := testutil.DefaultGPSConfig()
	cfg.NoiseDeg = 0.0001 // very low noise for reliable matching
	cfg.PointCount = 5
	batch := testutil.GenerateGPSBatch(route1, "e2e_test_device", cfg)

	err = ingester.Ingest(ctx, batch)
	require.NoError(t, err)

	// 8. Wait for the pipeline to process and broadcast
	// The pipeline: gps:raw → mapmatcher → gps:matched → processor → pub/sub
	ch := pubsub.Channel()
	select {
	case msg := <-ch:
		// Verify we received a vehicle position on Route 1
		assert.Contains(t, msg.Channel, "route:")

		var vehicle model.Vehicle
		err := json.Unmarshal([]byte(msg.Payload), &vehicle)
		require.NoError(t, err)

		assert.NotEmpty(t, vehicle.RouteID, "Should detect a route")
		assert.InDelta(t, 7.0, vehicle.Lat, 0.5, "Lat should be in Sri Lanka")
		assert.InDelta(t, 80.0, vehicle.Lng, 1.0, "Lng should be in Sri Lanka")
		assert.Equal(t, 1, vehicle.ContributorCount)
		assert.Equal(t, model.ConfidenceLow, vehicle.Confidence)
		assert.NotEmpty(t, vehicle.VirtualID)

		t.Logf("E2E success: bus %s on route %s at (%.4f, %.4f) confidence=%s",
			vehicle.VirtualID, vehicle.RouteID, vehicle.Lat, vehicle.Lng, vehicle.Confidence)

	case <-time.After(10 * time.Second):
		t.Fatal("Timeout: no bus position received on Pub/Sub within 10 seconds")
	}
}

func TestPipeline_MultipleDevicesClustered(t *testing.T) {
	rdb := skipIfNoRedis(t)
	defer rdb.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	rdb.Del(ctx, pipeline.StreamRawGPS)
	rdb.Del(ctx, pipeline.StreamMatchedGPS)

	routeIndex := spatial.NewRouteIndex()
	routeIndex.Load(map[string]orb.LineString{"1": route1})

	mockValhalla := mockValhallaServer(t)
	defer mockValhalla.Close()

	vc := valhalla.NewClient(mockValhalla.URL)
	ingester := pipeline.NewIngester(rdb)
	mapMatcher := pipeline.NewMapMatcher(rdb, vc)
	broadcaster := pipeline.NewBroadcaster(rdb)
	inferenceEngine := pipeline.NewInferenceEngine(routeIndex)
	processor := pipeline.NewProcessor(rdb, inferenceEngine, broadcaster)

	err := mapMatcher.EnsureConsumerGroup(ctx)
	require.NoError(t, err)

	workerCtx, workerCancel := context.WithCancel(ctx)
	defer workerCancel()

	go mapMatcher.Run(workerCtx)
	go processor.Run(workerCtx)

	pubsub := rdb.PSubscribe(ctx, "route:*")
	defer pubsub.Close()

	// Ingest 3 batches from different devices (same bus)
	cfg := testutil.DefaultGPSConfig()
	cfg.NoiseDeg = 0.0001
	cfg.PointCount = 5

	for i := 0; i < 3; i++ {
		batch := testutil.GenerateGPSBatch(route1, randomDeviceHash(), cfg)
		err := ingester.Ingest(ctx, batch)
		require.NoError(t, err)
	}

	// Wait for at least one broadcast
	ch := pubsub.Channel()
	received := false
	timeout := time.After(10 * time.Second)

	for !received {
		select {
		case msg := <-ch:
			var vehicle model.Vehicle
			if err := json.Unmarshal([]byte(msg.Payload), &vehicle); err == nil {
				if vehicle.RouteID == "1" {
					received = true
					t.Logf("Received: route=%s contributors=%d confidence=%s",
						vehicle.RouteID, vehicle.ContributorCount, vehicle.Confidence)
				}
			}
		case <-timeout:
			t.Fatal("Timeout waiting for clustered bus position")
		}
	}
}

func randomDeviceHash() string {
	return "dev_" + time.Now().Format("150405.000000000")
}
