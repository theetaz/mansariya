package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

type ETAHandler struct {
	// Will depend on trip store, route store, and active vehicle data from Redis
}

func NewETAHandler() *ETAHandler {
	return &ETAHandler{}
}

// Handle returns ETA estimates for buses arriving at a stop on a route.
func (h *ETAHandler) Handle(w http.ResponseWriter, r *http.Request) {
	routeID := chi.URLParam(r, "routeID")
	stopID := r.URL.Query().Get("stop_id")

	if routeID == "" || stopID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "route_id and stop_id required"})
		return
	}

	// TODO: Implement ETA calculation
	// 1. Get active buses on this route from Redis
	// 2. For each bus, compute distance remaining to target stop along route polyline
	// 3. Use historical speed data (or current speed) to estimate time
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"route_id": routeID,
		"stop_id":  stopID,
		"buses":    []interface{}{},
		"message":  "ETA calculation not yet implemented",
	})
}
