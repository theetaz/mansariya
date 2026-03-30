package handler

import (
	"context"
	"fmt"
	"net/http"
	"strconv"

	"github.com/masariya/backend/internal/model"
	"github.com/masariya/backend/internal/spatial"
	"github.com/redis/go-redis/v9"
)

type BusesHandler struct {
	rdb   *redis.Client
}

func NewBusesHandler(rdb *redis.Client) *BusesHandler {
	return &BusesHandler{rdb: rdb}
}

// Active returns all live bus positions from Redis.
// GET /api/v1/buses/active
func (h *BusesHandler) Active(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	keys, err := h.rdb.Keys(ctx, "bus:*:pos").Result()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "redis error"})
		return
	}

	buses := make([]model.Vehicle, 0, len(keys))
	for _, key := range keys {
		bus := parseBusFromRedis(ctx, h.rdb, key)
		if bus != nil {
			buses = append(buses, *bus)
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"buses": buses,
		"count": len(buses),
	})
}

// Nearby returns live buses near a location.
// GET /api/v1/buses/nearby?lat=6.9271&lng=79.8612&radius_km=10
func (h *BusesHandler) Nearby(w http.ResponseWriter, r *http.Request) {
	lat, _ := strconv.ParseFloat(r.URL.Query().Get("lat"), 64)
	lng, _ := strconv.ParseFloat(r.URL.Query().Get("lng"), 64)
	radiusKM, _ := strconv.ParseFloat(r.URL.Query().Get("radius_km"), 64)

	if lat == 0 || lng == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "lat and lng required"})
		return
	}
	if radiusKM == 0 {
		radiusKM = 10
	}

	ctx := r.Context()
	keys, err := h.rdb.Keys(ctx, "bus:*:pos").Result()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "redis error"})
		return
	}

	buses := make([]model.Vehicle, 0)
	for _, key := range keys {
		bus := parseBusFromRedis(ctx, h.rdb, key)
		if bus == nil {
			continue
		}
		dist := spatial.Haversine(lat, lng, bus.Lat, bus.Lng)
		if dist <= radiusKM {
			buses = append(buses, *bus)
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"buses":     buses,
		"count":     len(buses),
		"radius_km": radiusKM,
	})
}

func parseBusFromRedis(ctx context.Context, rdb *redis.Client, key string) *model.Vehicle {
	pos, err := rdb.HGetAll(ctx, key).Result()
	if err != nil || len(pos) == 0 {
		return nil
	}

	var bus model.Vehicle
	fmt.Sscanf(pos["lat"], "%f", &bus.Lat)
	fmt.Sscanf(pos["lng"], "%f", &bus.Lng)
	fmt.Sscanf(pos["speed"], "%f", &bus.SpeedKMH)
	fmt.Sscanf(pos["bearing"], "%f", &bus.Bearing)
	fmt.Sscanf(pos["count"], "%d", &bus.ContributorCount)
	bus.RouteID = pos["route_id"]
	bus.Confidence = pos["confidence"]
	bus.BusNumber = pos["bus_no"]
	fmt.Sscanf(pos["crowd"], "%d", &bus.CrowdLevel)

	// Extract virtual_id from key: "bus:v_xxx:pos" → "v_xxx"
	if len(key) > 8 {
		bus.VirtualID = key[4 : len(key)-4]
	}

	if bus.Lat == 0 || bus.RouteID == "" {
		return nil
	}
	return &bus
}
