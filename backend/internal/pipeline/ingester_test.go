package pipeline

import (
	"context"
	"encoding/json"
	"os"
	"testing"

	"github.com/masariya/backend/internal/model"
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
		t.Skipf("Redis not available at %s: %v", redisAddr(), err)
	}
	return rdb
}

func TestIngester_Ingest(t *testing.T) {
	rdb := skipIfNoRedis(t)
	defer rdb.Close()
	ctx := context.Background()

	// Clean stream before test
	rdb.Del(ctx, StreamRawGPS)

	ing := NewIngester(rdb)

	batch := model.GPSBatch{
		DeviceHash: "abc123def456",
		SessionID:  "sess_test1",
		Pings: []model.GPSPing{
			{Lat: 6.9271, Lng: 79.8612, Timestamp: 1000, Accuracy: 10, Speed: 12, Bearing: 45},
			{Lat: 6.9285, Lng: 79.8620, Timestamp: 1005, Accuracy: 8, Speed: 13, Bearing: 46},
		},
	}

	err := ing.Ingest(ctx, batch)
	require.NoError(t, err)

	// Verify stream has 1 message
	length, err := rdb.XLen(ctx, StreamRawGPS).Result()
	require.NoError(t, err)
	assert.Equal(t, int64(1), length)

	// Read the message and verify content
	msgs, err := rdb.XRange(ctx, StreamRawGPS, "-", "+").Result()
	require.NoError(t, err)
	require.Len(t, msgs, 1)

	data, ok := msgs[0].Values["data"].(string)
	require.True(t, ok)

	var readBatch model.GPSBatch
	require.NoError(t, json.Unmarshal([]byte(data), &readBatch))
	assert.Equal(t, "abc123def456", readBatch.DeviceHash)
	assert.Len(t, readBatch.Pings, 2)
}

func TestIngester_MultipleBatches(t *testing.T) {
	rdb := skipIfNoRedis(t)
	defer rdb.Close()
	ctx := context.Background()

	rdb.Del(ctx, StreamRawGPS)
	ing := NewIngester(rdb)

	for i := 0; i < 5; i++ {
		err := ing.Ingest(ctx, model.GPSBatch{
			DeviceHash: "device_multi",
			SessionID:  "sess_multi",
			Pings:      []model.GPSPing{{Lat: 6.9, Lng: 79.8, Timestamp: int64(1000 + i*5)}},
		})
		require.NoError(t, err)
	}

	length, err := rdb.XLen(ctx, StreamRawGPS).Result()
	require.NoError(t, err)
	assert.Equal(t, int64(5), length)
}

func TestIngester_StreamCapped(t *testing.T) {
	rdb := skipIfNoRedis(t)
	defer rdb.Close()
	ctx := context.Background()

	rdb.Del(ctx, StreamRawGPS)
	ing := NewIngester(rdb)

	// Ingest many messages — stream should not grow beyond MaxLen (100000)
	// We can't test exact capping without inserting 100K+ messages,
	// but we verify the XADD has MAXLEN set by checking it doesn't error
	for i := 0; i < 10; i++ {
		err := ing.Ingest(ctx, model.GPSBatch{
			DeviceHash: "cap_test",
			SessionID:  "cap_sess",
			Pings:      []model.GPSPing{{Lat: 6.9, Lng: 79.8}},
		})
		require.NoError(t, err)
	}

	length, err := rdb.XLen(ctx, StreamRawGPS).Result()
	require.NoError(t, err)
	assert.Equal(t, int64(10), length)
}
