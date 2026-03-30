package pipeline

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/masariya/backend/internal/model"
	"github.com/masariya/backend/internal/valhalla"
	"github.com/redis/go-redis/v9"
)

const (
	StreamMatchedGPS = "gps:matched"
	ConsumerGroup    = "pipeline"
	ConsumerMapMatch = "mapmatcher"
)

// MapMatcher is a Redis Stream consumer that reads raw GPS batches,
// snaps them to the road network via Valhalla, and writes matched results.
type MapMatcher struct {
	rdb      *redis.Client
	valhalla *valhalla.Client
}

func NewMapMatcher(rdb *redis.Client, vc *valhalla.Client) *MapMatcher {
	return &MapMatcher{rdb: rdb, valhalla: vc}
}

// EnsureConsumerGroup creates the consumer group if it doesn't exist.
func (mm *MapMatcher) EnsureConsumerGroup(ctx context.Context) error {
	err := mm.rdb.XGroupCreateMkStream(ctx, StreamRawGPS, ConsumerGroup, "0").Err()
	if err != nil && err.Error() != "BUSYGROUP Consumer Group name already exists" {
		return fmt.Errorf("create consumer group: %w", err)
	}

	err = mm.rdb.XGroupCreateMkStream(ctx, StreamMatchedGPS, ConsumerGroup, "0").Err()
	if err != nil && err.Error() != "BUSYGROUP Consumer Group name already exists" {
		return fmt.Errorf("create consumer group: %w", err)
	}
	return nil
}

// Run starts the map-matching consumer loop. Blocks until context is cancelled.
func (mm *MapMatcher) Run(ctx context.Context) error {
	slog.Info("mapmatcher worker started")

	for {
		select {
		case <-ctx.Done():
			slog.Info("mapmatcher worker stopped")
			return ctx.Err()
		default:
		}

		streams, err := mm.rdb.XReadGroup(ctx, &redis.XReadGroupArgs{
			Group:    ConsumerGroup,
			Consumer: ConsumerMapMatch,
			Streams:  []string{StreamRawGPS, ">"},
			Count:    10,
			Block:    2 * time.Second,
		}).Result()
		if err != nil {
			if err == redis.Nil || ctx.Err() != nil {
				continue
			}
			slog.Error("mapmatcher xreadgroup", "error", err)
			time.Sleep(time.Second)
			continue
		}

		for _, stream := range streams {
			for _, msg := range stream.Messages {
				if err := mm.processMessage(ctx, msg); err != nil {
					slog.Error("mapmatcher process", "id", msg.ID, "error", err)
				}
				// ACK regardless to avoid reprocessing stuck messages
				mm.rdb.XAck(ctx, StreamRawGPS, ConsumerGroup, msg.ID)
			}
		}
	}
}

func (mm *MapMatcher) processMessage(ctx context.Context, msg redis.XMessage) error {
	data, ok := msg.Values["data"].(string)
	if !ok {
		return fmt.Errorf("missing data field in message %s", msg.ID)
	}

	var batch model.GPSBatch
	if err := json.Unmarshal([]byte(data), &batch); err != nil {
		return fmt.Errorf("unmarshal batch: %w", err)
	}

	if len(batch.Pings) == 0 {
		return nil
	}

	// Convert to Valhalla shape points
	shape := make([]valhalla.ShapePoint, len(batch.Pings))
	for i, p := range batch.Pings {
		shape[i] = valhalla.ShapePoint{
			Lat:  p.Lat,
			Lon:  p.Lng,
			Time: p.Timestamp,
		}
	}

	// Call Valhalla trace_route (fallback to raw GPS if Valhalla unavailable or < 2 points)
	var result *valhalla.TraceRouteResponse
	var err error
	if len(batch.Pings) >= 2 {
		result, err = mm.valhalla.TraceRoute(ctx, shape)
	} else {
		err = fmt.Errorf("single ping, skip valhalla")
	}

	matched := model.MatchedTrace{
		DeviceHash: batch.DeviceHash,
		SessionID:  batch.SessionID,
		RouteID:    batch.RouteID,
		BusNumber:  batch.BusNumber,
		CrowdLevel: batch.CrowdLevel,
	}

	if err != nil {
		// Valhalla unavailable — use raw GPS points as fallback
		slog.Debug("valhalla unavailable, using raw GPS", "error", err)
		for _, p := range batch.Pings {
			matched.Points = append(matched.Points, model.MatchedPoint{
				Lat: p.Lat,
				Lng: p.Lng,
			})
		}
	} else if len(result.Trip.MatchedPoints) > 0 {
		for _, mp := range result.Trip.MatchedPoints {
			matched.Points = append(matched.Points, model.MatchedPoint{
				Lat:    mp.Lat,
				Lng:    mp.Lon,
				EdgeID: int64(mp.EdgeIndex),
			})
		}
	}

	// Compute averages from raw pings
	var totalSpeed, totalBearing float64
	for _, p := range batch.Pings {
		totalSpeed += p.Speed * 3.6 // m/s → km/h
		totalBearing += p.Bearing
	}
	n := float64(len(batch.Pings))
	matched.AvgSpeed = totalSpeed / n
	matched.AvgBearing = totalBearing / n

	// Write to matched stream
	matchedData, err := json.Marshal(matched)
	if err != nil {
		return fmt.Errorf("marshal matched: %w", err)
	}

	_, err = mm.rdb.XAdd(ctx, &redis.XAddArgs{
		Stream: StreamMatchedGPS,
		MaxLen: 100000,
		Approx: true,
		Values: map[string]interface{}{
			"data": string(matchedData),
		},
	}).Result()

	return err
}
