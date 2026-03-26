package pipeline

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/masariya/backend/internal/model"
	"github.com/redis/go-redis/v9"
)

// Broadcaster publishes fused vehicle positions to Redis Pub/Sub and Hash.
type Broadcaster struct {
	rdb *redis.Client
}

func NewBroadcaster(rdb *redis.Client) *Broadcaster {
	return &Broadcaster{rdb: rdb}
}

// Publish sends a vehicle position update to Redis Pub/Sub for WebSocket broadcast,
// and stores the position in a Hash with TTL for API queries.
func (b *Broadcaster) Publish(ctx context.Context, vehicle model.Vehicle) error {
	data, err := json.Marshal(vehicle)
	if err != nil {
		return fmt.Errorf("marshal vehicle: %w", err)
	}

	pipe := b.rdb.Pipeline()

	// Pub/Sub for real-time WebSocket clients
	pipe.Publish(ctx, "route:"+vehicle.RouteID, string(data))

	// Store latest position in Hash with 5-min TTL
	posKey := "bus:" + vehicle.VirtualID + ":pos"
	pipe.HSet(ctx, posKey, map[string]interface{}{
		"lat":        vehicle.Lat,
		"lng":        vehicle.Lng,
		"speed":      vehicle.SpeedKMH,
		"bearing":    vehicle.Bearing,
		"route_id":   vehicle.RouteID,
		"confidence": vehicle.Confidence,
		"count":      vehicle.ContributorCount,
		"ts":         vehicle.LastUpdate.Unix(),
	})
	pipe.Expire(ctx, posKey, 5*time.Minute)

	// Add to route's active buses sorted set (score = timestamp)
	pipe.ZAdd(ctx, "route:"+vehicle.RouteID+":buses", redis.Z{
		Score:  float64(vehicle.LastUpdate.Unix()),
		Member: vehicle.VirtualID,
	})

	_, err = pipe.Exec(ctx)
	if err != nil {
		return fmt.Errorf("broadcast pipeline: %w", err)
	}

	slog.Debug("broadcast vehicle",
		"id", vehicle.VirtualID,
		"route", vehicle.RouteID,
		"confidence", vehicle.Confidence,
	)
	return nil
}

// CleanStale removes vehicles from route sorted sets that haven't updated in 5 minutes.
func (b *Broadcaster) CleanStale(ctx context.Context) error {
	// This would be called periodically by a background goroutine
	cutoff := float64(time.Now().Add(-5 * time.Minute).Unix())

	// Get all route keys matching pattern
	keys, err := b.rdb.Keys(ctx, "route:*:buses").Result()
	if err != nil {
		return err
	}

	for _, key := range keys {
		b.rdb.ZRemRangeByScore(ctx, key, "-inf", fmt.Sprintf("%f", cutoff))
	}
	return nil
}
