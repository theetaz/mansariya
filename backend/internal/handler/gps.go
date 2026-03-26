package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/masariya/backend/internal/model"
)

type GPSHandler struct {
	ingester GPSIngester
}

func NewGPSHandler(ingester GPSIngester) *GPSHandler {
	return &GPSHandler{ingester: ingester}
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

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":    "ok",
		"processed": len(batch.Pings),
	})
}
