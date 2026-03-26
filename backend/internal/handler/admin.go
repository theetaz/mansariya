package handler

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
)

// AdminStore abstracts admin CRUD operations.
type AdminStore interface {
	CreateRoute(ctx context.Context, route AdminRouteInput) (string, error)
	UpdateRoute(ctx context.Context, id string, route AdminRouteInput) error
	DeleteRoute(ctx context.Context, id string) error
	ValidateRoute(ctx context.Context, id string, validatedBy string) error

	CreateStop(ctx context.Context, stop AdminStopInput) (string, error)
	UpdateStop(ctx context.Context, id string, stop AdminStopInput) error

	SetRouteStops(ctx context.Context, routeID string, stops []AdminRouteStopInput) error

	AddTimetableEntry(ctx context.Context, entry AdminTimetableInput) error
	DeleteTimetableEntries(ctx context.Context, routeID string) error
}

// --- Input types ---

type AdminRouteInput struct {
	ID               string `json:"id"`
	NameEN           string `json:"name_en"`
	NameSI           string `json:"name_si"`
	NameTA           string `json:"name_ta"`
	Operator         string `json:"operator"`
	ServiceType      string `json:"service_type"`
	FareLKR          int    `json:"fare_lkr"`
	FrequencyMinutes int    `json:"frequency_minutes"`
	OperatingHours   string `json:"operating_hours"`
	DataSource       string `json:"data_source"`
}

type AdminStopInput struct {
	ID       string  `json:"id"`
	NameEN   string  `json:"name_en"`
	NameSI   string  `json:"name_si"`
	NameTA   string  `json:"name_ta"`
	Lat      float64 `json:"lat"`
	Lng      float64 `json:"lng"`
	RoadName string  `json:"road_name"`
	Landmark string  `json:"landmark"`
	Terminal bool    `json:"is_terminal"`
}

type AdminRouteStopInput struct {
	StopID             string  `json:"stop_id"`
	StopOrder          int     `json:"stop_order"`
	DistanceFromStartKM float64 `json:"distance_from_start_km"`
	TypicalDurationMin  int    `json:"typical_duration_min"`
	FareFromStartLKR    int    `json:"fare_from_start_lkr"`
}

type AdminTimetableInput struct {
	RouteID       string   `json:"route_id"`
	DepartureTime string   `json:"departure_time"` // "HH:MM"
	Days          []string `json:"days"`
	ServiceType   string   `json:"service_type"`
	Notes         string   `json:"notes"`
}

// --- Handler ---

type AdminHandler struct {
	store  AdminStore
	apiKey string // simple API key auth for now
}

func NewAdminHandler(store AdminStore, apiKey string) *AdminHandler {
	return &AdminHandler{store: store, apiKey: apiKey}
}

// AuthMiddleware checks the X-API-Key header.
func (h *AdminHandler) AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := r.Header.Get("X-API-Key")
		if key == "" || key != h.apiKey {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid API key"})
			return
		}
		next.ServeHTTP(w, r)
	})
}

// --- Route CRUD ---

func (h *AdminHandler) CreateRoute(w http.ResponseWriter, r *http.Request) {
	var input AdminRouteInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	if input.ID == "" || input.NameEN == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "id and name_en required"})
		return
	}

	id, err := h.store.CreateRoute(r.Context(), input)
	if err != nil {
		slog.Error("admin create route", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "create failed"})
		return
	}

	writeJSON(w, http.StatusCreated, map[string]string{"id": id, "status": "created"})
}

func (h *AdminHandler) UpdateRoute(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "routeID")
	var input AdminRouteInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}

	if err := h.store.UpdateRoute(r.Context(), id, input); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "update failed"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"id": id, "status": "updated"})
}

func (h *AdminHandler) DeleteRoute(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "routeID")
	if err := h.store.DeleteRoute(r.Context(), id); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "delete failed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"id": id, "status": "deleted"})
}

func (h *AdminHandler) ValidateRoute(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "routeID")
	var body struct {
		ValidatedBy string `json:"validated_by"`
	}
	json.NewDecoder(r.Body).Decode(&body)
	if body.ValidatedBy == "" {
		body.ValidatedBy = "admin"
	}

	if err := h.store.ValidateRoute(r.Context(), id, body.ValidatedBy); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "validate failed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"id": id, "status": "validated"})
}

// --- Stop CRUD ---

func (h *AdminHandler) CreateStop(w http.ResponseWriter, r *http.Request) {
	var input AdminStopInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	if input.NameEN == "" || input.Lat == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name_en and lat/lng required"})
		return
	}

	id, err := h.store.CreateStop(r.Context(), input)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "create failed"})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"id": id, "status": "created"})
}

func (h *AdminHandler) UpdateStop(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "stopID")
	var input AdminStopInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}

	if err := h.store.UpdateStop(r.Context(), id, input); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "update failed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"id": id, "status": "updated"})
}

// --- Route Stops ---

func (h *AdminHandler) SetRouteStops(w http.ResponseWriter, r *http.Request) {
	routeID := chi.URLParam(r, "routeID")
	var input struct {
		Stops []AdminRouteStopInput `json:"stops"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}

	if err := h.store.SetRouteStops(r.Context(), routeID, input.Stops); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "set stops failed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"route_id": routeID,
		"stops":    len(input.Stops),
		"status":   "updated",
	})
}

// --- Timetable ---

func (h *AdminHandler) SetTimetable(w http.ResponseWriter, r *http.Request) {
	routeID := chi.URLParam(r, "routeID")
	var input struct {
		Entries []AdminTimetableInput `json:"entries"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}

	// Replace existing timetable
	_ = h.store.DeleteTimetableEntries(r.Context(), routeID)

	for _, entry := range input.Entries {
		entry.RouteID = routeID
		if err := h.store.AddTimetableEntry(r.Context(), entry); err != nil {
			slog.Error("admin timetable entry", "error", err)
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"route_id": routeID,
		"entries":  len(input.Entries),
		"status":   "updated",
	})
}

// RegisterAdminTime is unused but shows the intended validation timestamp
var _ = time.Now
