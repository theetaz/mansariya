package handler

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/masariya/backend/internal/model"
)

type GPSHandler struct {
	ingester  GPSIngester
	tripStore TripSessionStore
}

func NewGPSHandler(ingester GPSIngester, tripStore TripSessionStore) *GPSHandler {
	return &GPSHandler{ingester: ingester, tripStore: tripStore}
}

// HandleBatch receives GPS batches from mobile clients and pushes to Redis Stream.
// Returns immediately — processing is async.
func (h *GPSHandler) HandleBatch(w http.ResponseWriter, r *http.Request) {
	var batch model.GPSBatch
	if err := json.NewDecoder(r.Body).Decode(&batch); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if batch.EventType == "" {
		batch.EventType = model.GPSEventPing
	}

	if batch.DeviceHash == "" || batch.SessionID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "device_hash and session_id are required"})
		return
	}

	if batch.EventType != model.GPSEventPing && batch.EventType != model.GPSEventStarted && batch.EventType != model.GPSEventStopped {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid event_type"})
		return
	}

	if batch.EventType != model.GPSEventStopped && len(batch.Pings) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "pings are required unless event_type is stopped"})
		return
	}

	if batch.BatchSeq < 0 || batch.IdentityVersion < 0 || batch.SessionStartedAt < 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid lifecycle metadata"})
		return
	}

	for _, ping := range batch.Pings {
		if ping.Lat < -90 || ping.Lat > 90 || ping.Lng < -180 || ping.Lng > 180 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid coordinates"})
			return
		}
		if ping.Accuracy < 0 || ping.Accuracy > 1000 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid accuracy"})
			return
		}
		if ping.Speed < 0 || ping.Speed > 100 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid speed"})
			return
		}
		if ping.Bearing < 0 || ping.Bearing > 360 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid bearing"})
			return
		}
		if ping.Timestamp <= 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid timestamp"})
			return
		}
	}

	if err := h.ingester.Ingest(r.Context(), batch); err != nil {
		slog.Error("gps ingest failed", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to process"})
		return
	}

	// Track trip session (non-blocking)
	if h.tripStore != nil && len(batch.Pings) > 0 {
		tripBatch := batch
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()

			if err := h.tripStore.UpsertSession(ctx, tripBatch); err != nil {
				slog.Debug("trip session upsert", "error", err)
			}
		}()
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":    "ok",
		"processed": len(batch.Pings),
	})
}
