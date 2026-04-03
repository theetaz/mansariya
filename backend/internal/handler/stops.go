package handler

import (
	"net/http"
	"strconv"
)

type StopsHandler struct {
	stopStore StopQuerier
}

func NewStopsHandler(stopStore StopQuerier) *StopsHandler {
	return &StopsHandler{stopStore: stopStore}
}

// Nearby returns stops near a location.
func (h *StopsHandler) Nearby(w http.ResponseWriter, r *http.Request) {
	lat, _ := strconv.ParseFloat(r.URL.Query().Get("lat"), 64)
	lng, _ := strconv.ParseFloat(r.URL.Query().Get("lng"), 64)
	radiusKM, _ := strconv.ParseFloat(r.URL.Query().Get("radius_km"), 64)

	if lat == 0 || lng == 0 {
		WriteAPIErr(w, r, ErrValidation("validation_failed", "validation.required", "lat,lng"))
		return
	}
	if radiusKM == 0 {
		radiusKM = 1
	}

	stops, err := h.stopStore.ListNearby(r.Context(), lat, lng, radiusKM)
	if err != nil {
		WriteAPIErr(w, r, ErrInternal(err))
		return
	}

	writeJSON(w, http.StatusOK, stops)
}
