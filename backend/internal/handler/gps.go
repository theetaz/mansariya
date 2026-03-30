package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"

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

	if batch.DeviceHash == "" || batch.SessionID == "" || len(batch.Pings) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "device_hash, session_id and pings are required"})
		return
	}

	if err := h.ingester.Ingest(r.Context(), batch); err != nil {
		slog.Error("gps ingest failed", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to process"})
		return
	}

	// Track trip session (non-blocking)
	if h.tripStore != nil {
		go func() {
			if err := h.tripStore.UpsertSession(r.Context(), batch); err != nil {
				slog.Debug("trip session upsert", "error", err)
			}
		}()
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":    "ok",
		"processed": len(batch.Pings),
	})
}
