package handler

import (
	"net/http"
	"strconv"

	"github.com/masariya/backend/internal/store"
)

type StopsHandler struct {
	stopStore *store.StopStore
}

func NewStopsHandler(stopStore *store.StopStore) *StopsHandler {
	return &StopsHandler{stopStore: stopStore}
}

// Nearby returns stops near a location.
func (h *StopsHandler) Nearby(w http.ResponseWriter, r *http.Request) {
	lat, _ := strconv.ParseFloat(r.URL.Query().Get("lat"), 64)
	lng, _ := strconv.ParseFloat(r.URL.Query().Get("lng"), 64)
	radiusKM, _ := strconv.ParseFloat(r.URL.Query().Get("radius_km"), 64)

	if lat == 0 || lng == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "lat and lng are required"})
		return
	}
	if radiusKM == 0 {
		radiusKM = 1
	}

	stops, err := h.stopStore.ListNearby(r.Context(), lat, lng, radiusKM)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "query failed"})
		return
	}

	writeJSON(w, http.StatusOK, stops)
}
