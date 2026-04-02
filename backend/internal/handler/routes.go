package handler

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
)

type RoutesHandler struct {
	routeStore RouteQuerier
	stopStore  StopQuerier
}

func NewRoutesHandler(routeStore RouteQuerier, stopStore StopQuerier) *RoutesHandler {
	return &RoutesHandler{routeStore: routeStore, stopStore: stopStore}
}

// List returns routes near a location.
func (h *RoutesHandler) List(w http.ResponseWriter, r *http.Request) {
	lat, _ := strconv.ParseFloat(r.URL.Query().Get("lat"), 64)
	lng, _ := strconv.ParseFloat(r.URL.Query().Get("lng"), 64)
	radiusKM, _ := strconv.ParseFloat(r.URL.Query().Get("radius_km"), 64)

	if lat == 0 || lng == 0 {
		WriteAPIErr(w, r, ErrValidation("validation_failed", "validation.required", "lat,lng"))
		return
	}
	if radiusKM == 0 {
		radiusKM = 5
	}

	routes, err := h.routeStore.ListNearby(r.Context(), lat, lng, radiusKM)
	if err != nil {
		WriteAPIErr(w, r, ErrInternal(err))
		return
	}

	writeJSON(w, http.StatusOK, routes)
}

// GetPolyline returns the road-snapped route geometry as coordinates.
func (h *RoutesHandler) GetPolyline(w http.ResponseWriter, r *http.Request) {
	routeID := chi.URLParam(r, "routeID")
	coords, err := h.routeStore.GetPolyline(r.Context(), routeID)
	if err != nil {
		WriteAPIErr(w, r, ErrNotFound("not_found.route"))
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"route_id":    routeID,
		"coordinates": coords,
		"points":      len(coords),
	})
}

// Get returns a single route with its stops.
func (h *RoutesHandler) Get(w http.ResponseWriter, r *http.Request) {
	routeID := chi.URLParam(r, "routeID")

	route, err := h.routeStore.GetByID(r.Context(), routeID)
	if err != nil {
		WriteAPIErr(w, r, ErrNotFound("not_found.route"))
		return
	}

	stops, err := h.stopStore.GetByRoute(r.Context(), routeID)
	if err != nil {
		stops = nil // non-fatal
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"route": route,
		"stops": stops,
	})
}
