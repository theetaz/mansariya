package handler

import (
	"context"
	"net/http"
	"runtime"
	"time"

	"github.com/redis/go-redis/v9"
)

// MetricsHandler exposes system health and performance metrics.
type MetricsHandler struct {
	rdb       *redis.Client
	startTime time.Time
}

func NewMetricsHandler(rdb *redis.Client) *MetricsHandler {
	return &MetricsHandler{rdb: rdb, startTime: time.Now()}
}

// Handle returns system metrics as JSON.
// GET /api/v1/metrics
func (h *MetricsHandler) Handle(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Runtime stats
	var mem runtime.MemStats
	runtime.ReadMemStats(&mem)

	// Redis stats
	redisInfo := h.getRedisStats(ctx)

	// Active buses count
	busCount := h.getActiveBusCount(ctx)

	// Stream lengths
	rawLen := h.getStreamLen(ctx, "gps:raw")
	matchedLen := h.getStreamLen(ctx, "gps:matched")

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"uptime_seconds":    int(time.Since(h.startTime).Seconds()),
		"uptime_human":      time.Since(h.startTime).Round(time.Second).String(),
		"goroutines":        runtime.NumGoroutine(),
		"memory_alloc_mb":   float64(mem.Alloc) / 1024 / 1024,
		"memory_sys_mb":     float64(mem.Sys) / 1024 / 1024,
		"gc_runs":           mem.NumGC,
		"active_buses":      busCount,
		"stream_gps_raw":    rawLen,
		"stream_gps_matched": matchedLen,
		"redis_connected":   redisInfo["connected"],
		"redis_used_memory": redisInfo["used_memory"],
	})
}

func (h *MetricsHandler) getRedisStats(ctx context.Context) map[string]interface{} {
	info := map[string]interface{}{
		"connected":   false,
		"used_memory": "unknown",
	}

	if err := h.rdb.Ping(ctx).Err(); err == nil {
		info["connected"] = true
	}

	mem, err := h.rdb.Info(ctx, "memory").Result()
	if err == nil && len(mem) > 0 {
		info["used_memory"] = mem
	}

	return info
}

func (h *MetricsHandler) getActiveBusCount(ctx context.Context) int64 {
	keys, err := h.rdb.Keys(ctx, "bus:*:pos").Result()
	if err != nil {
		return 0
	}
	return int64(len(keys))
}

func (h *MetricsHandler) getStreamLen(ctx context.Context, stream string) int64 {
	length, err := h.rdb.XLen(ctx, stream).Result()
	if err != nil {
		return -1
	}
	return length
}
