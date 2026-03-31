package pipeline

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/masariya/backend/internal/model"
	"github.com/masariya/backend/internal/valhalla"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMapMatcher_ProcessMessage_FallsBackWhenMatchedPointsAreEmpty(t *testing.T) {
	rdb := skipIfNoRedis(t)
	defer rdb.Close()

	ctx := context.Background()
	rdb.Del(ctx, StreamMatchedGPS)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodPost, r.Method)
		assert.Equal(t, "/trace_route", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"trip":{"matched_points":[]}}`))
	}))
	defer server.Close()

	mm := NewMapMatcher(rdb, valhalla.NewClient(server.URL))

	batch := model.GPSBatch{
		DeviceHash: "dev_123",
		SessionID:  "sess_123",
		EventType:  model.GPSEventPing,
		Pings: []model.GPSPing{
			{Lat: 52.5200, Lng: 13.4050, Timestamp: 1000, Accuracy: 10, Speed: 10, Bearing: 90},
			{Lat: 52.5205, Lng: 13.4055, Timestamp: 1005, Accuracy: 10, Speed: 11, Bearing: 92},
		},
	}
	data, err := json.Marshal(batch)
	require.NoError(t, err)

	err = mm.processMessage(ctx, redis.XMessage{Values: map[string]any{"data": string(data)}})
	require.NoError(t, err)

	msgs, err := rdb.XRange(ctx, StreamMatchedGPS, "-", "+").Result()
	require.NoError(t, err)
	require.Len(t, msgs, 1)

	raw, ok := msgs[0].Values["data"].(string)
	require.True(t, ok)

	var matched model.MatchedTrace
	require.NoError(t, json.Unmarshal([]byte(raw), &matched))
	require.Len(t, matched.Points, 2)
	assert.InDelta(t, batch.Pings[0].Lat, matched.Points[0].Lat, 0.000001)
	assert.InDelta(t, batch.Pings[1].Lng, matched.Points[1].Lng, 0.000001)
}

func TestMapMatcher_ProcessMessage_PassesStoppedEventWithoutPoints(t *testing.T) {
	rdb := skipIfNoRedis(t)
	defer rdb.Close()

	ctx := context.Background()
	rdb.Del(ctx, StreamMatchedGPS)

	mm := NewMapMatcher(rdb, valhalla.NewClient("http://example.invalid"))

	batch := model.GPSBatch{
		DeviceHash: "dev_123",
		SessionID:  "sess_123",
		EventType:  model.GPSEventStopped,
	}
	data, err := json.Marshal(batch)
	require.NoError(t, err)

	err = mm.processMessage(ctx, redis.XMessage{Values: map[string]any{"data": string(data)}})
	require.NoError(t, err)

	msgs, err := rdb.XRange(ctx, StreamMatchedGPS, "-", "+").Result()
	require.NoError(t, err)
	require.Len(t, msgs, 1)

	raw, ok := msgs[0].Values["data"].(string)
	require.True(t, ok)

	var matched model.MatchedTrace
	require.NoError(t, json.Unmarshal([]byte(raw), &matched))
	assert.Equal(t, model.GPSEventStopped, matched.EventType)
	assert.Empty(t, matched.Points)
}
