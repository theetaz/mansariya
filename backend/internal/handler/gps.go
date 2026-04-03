package handler

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/masariya/backend/internal/model"
)

// ContributorRegistrar handles auto-registration of contributors.
type ContributorRegistrar interface {
	UpsertContributor(ctx context.Context, contributorID string) error
	LinkDeviceHash(ctx context.Context, deviceHash, contributorID string) error
	TrackActivity(ctx context.Context, contributorID string, pingCount int) error
	TrackRouteContribution(ctx context.Context, contributorID, routeID string, pingCount int) error
}

type GPSHandler struct {
	ingester     GPSIngester
	tripStore    TripSessionStore
	contributors ContributorRegistrar
}

func NewGPSHandler(ingester GPSIngester, tripStore TripSessionStore, contributors ContributorRegistrar) *GPSHandler {
	return &GPSHandler{ingester: ingester, tripStore: tripStore, contributors: contributors}
}

// HandleBatch receives GPS batches from mobile clients and pushes to Redis Stream.
// Returns immediately — processing is async.
func (h *GPSHandler) HandleBatch(w http.ResponseWriter, r *http.Request) {
	var batch model.GPSBatch
	if err := json.NewDecoder(r.Body).Decode(&batch); err != nil {
		WriteAPIErr(w, r, ErrValidation("invalid_body", "validation.invalid_body", ""))
		return
	}

	if batch.EventType == "" {
		batch.EventType = model.GPSEventPing
	}

	if batch.DeviceHash == "" || batch.SessionID == "" {
		WriteAPIErr(w, r, ErrValidation("validation_failed", "validation.required", "device_hash,session_id"))
		return
	}

	if batch.EventType != model.GPSEventPing && batch.EventType != model.GPSEventStarted && batch.EventType != model.GPSEventStopped {
		WriteAPIErr(w, r, ErrValidation("invalid_event_type", "validation.invalid_format", "event_type"))
		return
	}

	if batch.EventType != model.GPSEventStopped && len(batch.Pings) == 0 {
		WriteAPIErr(w, r, ErrValidation("validation_failed", "validation.required", "pings"))
		return
	}

	if batch.BatchSeq < 0 || batch.IdentityVersion < 0 || batch.SessionStartedAt < 0 {
		WriteAPIErr(w, r, ErrValidation("invalid_metadata", "validation.invalid_format", ""))
		return
	}

	for _, ping := range batch.Pings {
		if ping.Lat < -90 || ping.Lat > 90 || ping.Lng < -180 || ping.Lng > 180 {
			WriteAPIErr(w, r, ErrValidation("invalid_coordinates", "validation.invalid_format", "lat,lng"))
			return
		}
		if ping.Accuracy < 0 || ping.Accuracy > 1000 {
			WriteAPIErr(w, r, ErrValidation("invalid_accuracy", "validation.invalid_format", "accuracy"))
			return
		}
		if ping.Speed < 0 || ping.Speed > 100 {
			WriteAPIErr(w, r, ErrValidation("invalid_speed", "validation.invalid_format", "speed"))
			return
		}
		if ping.Bearing < 0 || ping.Bearing > 360 {
			WriteAPIErr(w, r, ErrValidation("invalid_bearing", "validation.invalid_format", "bearing"))
			return
		}
		if ping.Timestamp <= 0 {
			WriteAPIErr(w, r, ErrValidation("invalid_timestamp", "validation.invalid_format", "timestamp"))
			return
		}
	}

	if err := h.ingester.Ingest(r.Context(), batch); err != nil {
		WriteAPIErr(w, r, ErrInternal(err))
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

	// Auto-register contributor and track telemetry (non-blocking)
	if h.contributors != nil && batch.ContributorID != "" {
		cBatch := batch
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()

			if err := h.contributors.UpsertContributor(ctx, cBatch.ContributorID); err != nil {
				slog.Debug("contributor upsert", "error", err)
			}
			if err := h.contributors.LinkDeviceHash(ctx, cBatch.DeviceHash, cBatch.ContributorID); err != nil {
				slog.Debug("device hash link", "error", err)
			}
			if err := h.contributors.TrackActivity(ctx, cBatch.ContributorID, len(cBatch.Pings)); err != nil {
				slog.Debug("track activity", "error", err)
			}
			if err := h.contributors.TrackRouteContribution(ctx, cBatch.ContributorID, cBatch.RouteID, len(cBatch.Pings)); err != nil {
				slog.Debug("track route contribution", "error", err)
			}
		}()
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":    "ok",
		"processed": len(batch.Pings),
	})
}
