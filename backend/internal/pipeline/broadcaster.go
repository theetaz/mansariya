package pipeline

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"sort"
	"time"

	"github.com/masariya/backend/internal/model"
	"github.com/redis/go-redis/v9"
)

// Broadcaster publishes fused vehicle positions to Redis Pub/Sub and Hash.
type Broadcaster struct {
	rdb *redis.Client
}

const (
	devicesSnapshotKey = "devices:snapshot:latest"
	devicesActiveKey   = "devices:active"
	deviceStatePrefix  = "device:"
	deviceStateSuffix  = ":state"
)

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
		"crowd":      vehicle.CrowdLevel,
		"bus_no":     vehicle.BusNumber,
	})
	pipe.Expire(ctx, posKey, 20*time.Second)

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

// ReplaceRouteVehicles atomically replaces all virtual vehicles for a route.
// Removes old bus keys that are no longer in the current clustering result,
// then publishes and stores the current set.
func (b *Broadcaster) ReplaceRouteVehicles(ctx context.Context, routeID string, vehicles []model.Vehicle) {
	busesKey := "route:" + routeID + ":buses"

	// Get all existing virtual IDs for this route
	oldMembers, _ := b.rdb.ZRange(ctx, busesKey, 0, -1).Result()

	// Build set of current virtual IDs
	currentIDs := make(map[string]bool)
	for _, v := range vehicles {
		currentIDs[v.VirtualID] = true
	}

	// Delete old bus position keys that are no longer current
	pipe := b.rdb.Pipeline()
	for _, old := range oldMembers {
		if !currentIDs[old] {
			pipe.Del(ctx, "bus:"+old+":pos")
			pipe.ZRem(ctx, busesKey, old)
		}
	}
	pipe.Exec(ctx)

	// Publish current vehicles
	for _, v := range vehicles {
		if err := b.Publish(ctx, v); err != nil {
			slog.Error("broadcast failed", "vehicle", v.VirtualID, "error", err)
		}
	}
}

// CleanStale removes vehicles from route sorted sets that haven't updated in 30 seconds.
func (b *Broadcaster) CleanStale(ctx context.Context) error {
	cutoff := float64(time.Now().Add(-20 * time.Second).Unix())

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

func (b *Broadcaster) UpsertDeviceState(ctx context.Context, device DeviceState) error {
	data, err := json.Marshal(device)
	if err != nil {
		return fmt.Errorf("marshal device state: %w", err)
	}

	pipe := b.rdb.Pipeline()
	pipe.Set(ctx, deviceStateKey(device.SessionID), string(data), deviceExpiryWindow)
	pipe.ZAdd(ctx, devicesActiveKey, redis.Z{
		Score:  float64(device.LastSeen.Unix()),
		Member: device.SessionID,
	})
	_, err = pipe.Exec(ctx)
	if err != nil {
		return fmt.Errorf("upsert device state: %w", err)
	}
	return nil
}

func (b *Broadcaster) RemoveDeviceState(ctx context.Context, sessionID string) error {
	pipe := b.rdb.Pipeline()
	pipe.Del(ctx, deviceStateKey(sessionID))
	pipe.ZRem(ctx, devicesActiveKey, sessionID)
	_, err := pipe.Exec(ctx)
	if err != nil {
		return fmt.Errorf("remove device state: %w", err)
	}
	return nil
}

func (b *Broadcaster) CleanStaleDeviceStates(ctx context.Context, cutoff time.Time) error {
	if err := b.rdb.ZRemRangeByScore(ctx, devicesActiveKey, "-inf", fmt.Sprintf("%f", float64(cutoff.Unix()))).Err(); err != nil {
		return fmt.Errorf("clean device zset: %w", err)
	}
	return nil
}

func (b *Broadcaster) LoadActiveDeviceStates(ctx context.Context) ([]DeviceState, error) {
	ids, err := b.rdb.ZRange(ctx, devicesActiveKey, 0, -1).Result()
	if err != nil {
		return nil, fmt.Errorf("load active device ids: %w", err)
	}

	devices := make([]DeviceState, 0, len(ids))
	for _, id := range ids {
		raw, err := b.rdb.Get(ctx, deviceStateKey(id)).Result()
		if err != nil {
			if err == redis.Nil {
				continue
			}
			return nil, fmt.Errorf("load device state %s: %w", id, err)
		}

		var device DeviceState
		if err := json.Unmarshal([]byte(raw), &device); err != nil {
			return nil, fmt.Errorf("unmarshal device state %s: %w", id, err)
		}
		devices = append(devices, device)
	}

	return devices, nil
}

func (b *Broadcaster) CurrentDevicesSnapshot(ctx context.Context) (model.DevicesUpdate, error) {
	raw, err := b.rdb.Get(ctx, devicesSnapshotKey).Result()
	if err != nil {
		if err == redis.Nil {
			return model.DevicesUpdate{Type: "devices_update"}, nil
		}
		return model.DevicesUpdate{}, fmt.Errorf("get devices snapshot: %w", err)
	}

	var snapshot model.DevicesUpdate
	if err := json.Unmarshal([]byte(raw), &snapshot); err != nil {
		return model.DevicesUpdate{}, fmt.Errorf("unmarshal devices snapshot: %w", err)
	}
	return snapshot, nil
}

// PublishAllDevices publishes all device states to the "devices:all" Pub/Sub channel
// for the admin WebSocket endpoint.
func (b *Broadcaster) PublishAllDevices(ctx context.Context, devices []DeviceState) {
	update := devicesUpdate(devices)

	data, err := json.Marshal(update)
	if err != nil {
		slog.Error("marshal devices update", "error", err)
		return
	}

	pipe := b.rdb.Pipeline()
	pipe.Set(ctx, devicesSnapshotKey, string(data), deviceExpiryWindow)
	pipe.Publish(ctx, "devices:all", string(data))
	if _, err := pipe.Exec(ctx); err != nil {
		slog.Error("publish devices update", "error", err)
	}
}

func devicesUpdate(devices []DeviceState) model.DevicesUpdate {
	now := time.Now()
	sort.Slice(devices, func(i, j int) bool {
		return devices[i].LastSeen.After(devices[j].LastSeen)
	})

	var counts model.DeviceCounts
	counts.Total = len(devices)

	infos := make([]model.DeviceInfo, len(devices))
	for i, d := range devices {
		freshness := freshnessStatus(d.LastSeen, now)
		infos[i] = model.DeviceInfo{
			ContributorID:        d.AdminID,
			Classification:       d.Classification,
			ClassificationReason: d.ClassificationReason,
			QualityStatus:        d.QualityStatus,
			FreshnessStatus:      freshness,
			Lat:                  d.Lat,
			Lng:                  d.Lng,
			SpeedKMH:             d.SpeedKMH,
			Bearing:              d.Bearing,
			Accuracy:             d.Accuracy,
			RouteID:              d.RouteID,
			BusNumber:            d.BusNumber,
			CrowdLevel:           d.CrowdLevel,
			HasMetadata:          d.HasMetadata,
			LastSeen:             d.LastSeen,
		}

		switch d.Classification {
		case "noise":
			counts.Noise++
		case "potential":
			counts.Potential++
		case "cluster":
			counts.Cluster++
		case "confirmed":
			counts.Confirmed++
		}

		switch freshness {
		case model.FreshnessActive:
			counts.Active++
		case model.FreshnessSuspect:
			counts.Suspect++
		case model.FreshnessDisconnected:
			counts.Disconnected++
		}
	}

	return model.DevicesUpdate{
		Type:            "devices_update",
		SnapshotVersion: now.UnixNano(),
		Devices:         infos,
		Counts:          counts,
	}
}

func deviceStateKey(sessionID string) string {
	return deviceStatePrefix + sessionID + deviceStateSuffix
}
