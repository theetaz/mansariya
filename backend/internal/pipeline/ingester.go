package pipeline

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/masariya/backend/internal/model"
	"github.com/redis/go-redis/v9"
)

const StreamRawGPS = "gps:raw"

// Ingester writes validated GPS batches to the Redis Stream for async processing.
type Ingester struct {
	rdb *redis.Client
}

func NewIngester(rdb *redis.Client) *Ingester {
	return &Ingester{rdb: rdb}
}

// Ingest publishes a GPS batch to the raw GPS stream.
// Returns immediately — processing happens asynchronously via consumer workers.
func (ing *Ingester) Ingest(ctx context.Context, batch model.GPSBatch) error {
	data, err := json.Marshal(batch)
	if err != nil {
		return fmt.Errorf("marshal gps batch: %w", err)
	}

	_, err = ing.rdb.XAdd(ctx, &redis.XAddArgs{
		Stream: StreamRawGPS,
		MaxLen: 100000, // cap stream length to prevent unbounded growth
		Approx: true,
		Values: map[string]interface{}{
			"data": string(data),
		},
	}).Result()
	if err != nil {
		return fmt.Errorf("xadd gps:raw: %w", err)
	}

	slog.Debug("ingested gps batch",
		"device", batch.DeviceHash,
		"pings", len(batch.Pings),
	)
	return nil
}
