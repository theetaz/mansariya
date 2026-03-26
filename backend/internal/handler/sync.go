package handler

import (
	"context"
	"net/http"

	"github.com/masariya/backend/internal/model"
)

// RouteSyncer abstracts the bulk route export for mobile offline sync.
type RouteSyncer interface {
	GetAllForSync(ctx context.Context) ([]model.Route, error)
}

type SyncHandler struct {
	syncer RouteSyncer
}

func NewSyncHandler(syncer RouteSyncer) *SyncHandler {
	return &SyncHandler{syncer: syncer}
}

// HandleSync returns all active routes as JSON for mobile offline caching.
// Mobile calls this on first launch and weekly thereafter.
// GET /api/v1/routes/sync
func (h *SyncHandler) HandleSync(w http.ResponseWriter, r *http.Request) {
	routes, err := h.syncer.GetAllForSync(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "sync failed"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"routes": routes,
		"count":  len(routes),
	})
}
