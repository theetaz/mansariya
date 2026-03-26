package handler

import (
	"context"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/masariya/backend/internal/model"
)

// JourneySearcher abstracts journey search (implemented by store.JourneyStore).
type JourneySearcher interface {
	FindStopsByName(ctx context.Context, query string, limit int) ([]model.Stop, error)
	FindJourneys(ctx context.Context, fromStopID, toStopID string) ([]model.JourneyResult, error)
	GetRouteStops(ctx context.Context, routeID string) ([]model.EnrichedRouteStop, error)
}

type JourneyHandler struct {
	store JourneySearcher
}

func NewJourneyHandler(store JourneySearcher) *JourneyHandler {
	return &JourneyHandler{store: store}
}

// HandleSearch finds routes connecting two stops.
// GET /api/v1/journey?from=kadawatha&to=kegalle
func (h *JourneyHandler) HandleSearch(w http.ResponseWriter, r *http.Request) {
	from := r.URL.Query().Get("from")
	to := r.URL.Query().Get("to")

	if from == "" || to == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "from and to parameters required (stop names)",
		})
		return
	}

	ctx := r.Context()

	// Find matching stops for origin
	fromStops, err := h.store.FindStopsByName(ctx, from, 1)
	if err != nil || len(fromStops) == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{
			"error": "origin stop not found: " + from,
		})
		return
	}

	// Find matching stops for destination
	toStops, err := h.store.FindStopsByName(ctx, to, 1)
	if err != nil || len(toStops) == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{
			"error": "destination stop not found: " + to,
		})
		return
	}

	origin := fromStops[0]
	destination := toStops[0]

	// Find routes connecting them
	journeys, err := h.store.FindJourneys(ctx, origin.ID, destination.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "journey search failed",
		})
		return
	}

	writeJSON(w, http.StatusOK, model.JourneyResponse{
		Origin:      origin,
		Destination: destination,
		Journeys:    journeys,
	})
}

// HandleStopSearch finds stops by name (for autocomplete).
// GET /api/v1/stops/search?q=kadaw
func (h *JourneyHandler) HandleStopSearch(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "q parameter required",
		})
		return
	}

	stops, err := h.store.FindStopsByName(r.Context(), query, 10)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "stop search failed",
		})
		return
	}

	writeJSON(w, http.StatusOK, stops)
}

// HandleRouteStops returns enriched stops for a route (with timing, fares).
// GET /api/v1/routes/{routeID}/stops
func (h *JourneyHandler) HandleRouteStops(w http.ResponseWriter, r *http.Request) {
	routeID := chi.URLParam(r, "routeID")

	stops, err := h.store.GetRouteStops(r.Context(), routeID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "failed to get route stops",
		})
		return
	}

	writeJSON(w, http.StatusOK, stops)
}
