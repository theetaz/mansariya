package handler

import (
	"context"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/masariya/backend/internal/model"
)

// ETACalculator abstracts ETA computation (implemented by service.ETAService).
type ETACalculator interface {
	Calculate(ctx context.Context, routeID string, stopLat, stopLng float64) (*model.ETAResponse, error)
}

type ETAHandler struct {
	calculator ETACalculator
}

func NewETAHandler(calculator ETACalculator) *ETAHandler {
	return &ETAHandler{calculator: calculator}
}

// Handle returns ETA estimates for buses arriving at a stop on a route.
// GET /api/v1/routes/{routeID}/eta?lat=6.9271&lng=79.8612
func (h *ETAHandler) Handle(w http.ResponseWriter, r *http.Request) {
	routeID := chi.URLParam(r, "routeID")
	lat, _ := strconv.ParseFloat(r.URL.Query().Get("lat"), 64)
	lng, _ := strconv.ParseFloat(r.URL.Query().Get("lng"), 64)

	if routeID == "" || (lat == 0 && lng == 0) {
		WriteAPIErr(w, r, ErrValidation("validation_failed", "validation.required", "route_id,lat,lng"))
		return
	}

	result, err := h.calculator.Calculate(r.Context(), routeID, lat, lng)
	if err != nil {
		WriteAPIErr(w, r, ErrInternal(err))
		return
	}

	writeJSON(w, http.StatusOK, result)
}
