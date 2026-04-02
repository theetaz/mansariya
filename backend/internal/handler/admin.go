package handler

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// AdminStore abstracts admin CRUD operations.
type AdminStore interface {
	CreateRoute(ctx context.Context, route AdminRouteInput) (string, error)
	UpdateRoute(ctx context.Context, id string, route AdminRouteInput) error
	DeleteRoute(ctx context.Context, id string) error
	SetRouteActive(ctx context.Context, id string, isActive bool) error
	ValidateRoute(ctx context.Context, id string, validatedBy string) error

	CreateStop(ctx context.Context, stop AdminStopInput) (string, error)
	UpdateStop(ctx context.Context, id string, stop AdminStopInput) error

	SetRouteStops(ctx context.Context, routeID string, stops []AdminRouteStopInput) error

	AddTimetableEntry(ctx context.Context, entry AdminTimetableInput) error
	DeleteTimetableEntries(ctx context.Context, routeID string) error

	ListRoutesWithStats(ctx context.Context) ([]AdminRouteWithStats, error)
	GetDashboardStats(ctx context.Context) (*DashboardStats, error)
	UpdateRoutePolyline(ctx context.Context, routeID string, coordinates [][]float64, confidence float64) error

	GetRouteDetail(ctx context.Context, routeID string) (*AdminRouteDetail, error)
	GetTimetableEntries(ctx context.Context, routeID string) ([]AdminTimetable, error)
	DeleteStop(ctx context.Context, id string) error
	ListRoutesFiltered(ctx context.Context, filter AdminRouteFilter) (*AdminRouteListResponse, error)

	GetRoutePatterns(ctx context.Context, routeID string) ([]AdminRoutePattern, error)
	GetPatternStops(ctx context.Context, patternID string) ([]AdminEnrichedStop, error)
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
	StopID              string  `json:"stop_id"`
	StopOrder           int     `json:"stop_order"`
	DistanceFromStartKM float64 `json:"distance_from_start_km"`
	TypicalDurationMin  int     `json:"typical_duration_min"`
	FareFromStartLKR    int     `json:"fare_from_start_lkr"`
}

type AdminTimetableInput struct {
	RouteID       string   `json:"route_id"`
	DepartureTime string   `json:"departure_time"` // "HH:MM"
	Days          []string `json:"days"`
	ServiceType   string   `json:"service_type"`
	Notes         string   `json:"notes"`
}

// --- Response types ---

type AdminRouteWithStats struct {
	ID               string `json:"id"`
	NameEN           string `json:"name_en"`
	NameSI           string `json:"name_si"`
	NameTA           string `json:"name_ta"`
	Operator         string `json:"operator"`
	ServiceType      string `json:"service_type"`
	FareLKR          int    `json:"fare_lkr"`
	FrequencyMinutes int    `json:"frequency_minutes"`
	OperatingHours   string `json:"operating_hours"`
	IsActive         bool   `json:"is_active"`
	StopCount        int    `json:"stop_count"`
	PatternCount     int    `json:"pattern_count"`
	HasPolyline      bool   `json:"has_polyline"`
	OriginStopName   string `json:"origin_stop_name"`
	DestStopName     string `json:"destination_stop_name"`
}

type AdminRoutePattern struct {
	ID          string `json:"id"`
	RouteID     string `json:"route_id"`
	Headsign    string `json:"headsign"`
	Direction   int    `json:"direction"`
	IsPrimary   bool   `json:"is_primary"`
	StopCount   int    `json:"stop_count"`
	Source      string `json:"source"`
	HasPolyline bool   `json:"has_polyline"`
}

type DashboardStats struct {
	TotalRoutes         int `json:"total_routes"`
	TotalStops          int `json:"total_stops"`
	ActiveRoutes        int `json:"active_routes"`
	RoutesWithStops     int `json:"routes_with_stops"`
	RoutesWithPolyline  int `json:"routes_with_polyline"`
	RoutesWithTimetable int `json:"routes_with_timetable"`
}

type AdminRouteDetail struct {
	Route     AdminRouteDetailInfo `json:"route"`
	Stops     []AdminEnrichedStop  `json:"stops"`
	Patterns  []AdminRoutePattern  `json:"patterns"`
	Timetable []AdminTimetable     `json:"timetable"`
	Polyline  [][]float64          `json:"polyline"`
}

type AdminRouteDetailInfo struct {
	ID             string  `json:"id"`
	NameEN         string  `json:"name_en"`
	NameSI         string  `json:"name_si"`
	NameTA         string  `json:"name_ta"`
	Operator       string  `json:"operator"`
	ServiceType    string  `json:"service_type"`
	FareLKR        int     `json:"fare_lkr"`
	FrequencyMin   int     `json:"frequency_minutes"`
	OperatingHours string  `json:"operating_hours"`
	IsActive       bool    `json:"is_active"`
	Source         string  `json:"source"`
	DataSource     string  `json:"data_source"`
	ValidatedBy    string  `json:"validated_by,omitempty"`
	ValidatedAt    *string `json:"validated_at,omitempty"`
	CreatedAt      string  `json:"created_at"`
	UpdatedAt      string  `json:"updated_at"`
}

type AdminEnrichedStop struct {
	StopID            string  `json:"stop_id"`
	StopOrder         int     `json:"stop_order"`
	NameEN            string  `json:"name_en"`
	NameSI            string  `json:"name_si"`
	NameTA            string  `json:"name_ta"`
	Lat               float64 `json:"lat"`
	Lng               float64 `json:"lng"`
	DistanceFromStart float64 `json:"distance_from_start_km"`
	DurationMin       int     `json:"typical_duration_min"`
	FareFromStart     int     `json:"fare_from_start_lkr"`
	IsTerminal        bool    `json:"is_terminal"`
}

type AdminTimetable struct {
	ID            int      `json:"id"`
	RouteID       string   `json:"route_id"`
	DepartureTime string   `json:"departure_time"`
	Days          []string `json:"days"`
	ServiceType   string   `json:"service_type"`
	Notes         string   `json:"notes"`
}

type AdminRouteFilter struct {
	Query       string `json:"q"`
	Operator    string `json:"operator"`
	ServiceType string `json:"service_type"`
	Page        int    `json:"page"`
	PerPage     int    `json:"per_page"`
}

type AdminRouteListResponse struct {
	Routes     []AdminRouteWithStats `json:"routes"`
	Count      int                   `json:"count"`
	Page       int                   `json:"page"`
	PerPage    int                   `json:"per_page"`
	TotalPages int                   `json:"total_pages"`
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
		WriteAPIErr(w, r, ErrValidation("invalid_body", "validation.invalid_body", ""))
		return
	}
	if input.ID == "" || input.NameEN == "" {
		WriteAPIErr(w, r, ErrValidation("validation_failed", "validation.required", ""))
		return
	}

	id, err := h.store.CreateRoute(r.Context(), input)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			WriteAPIErr(w, r, ErrConflict("route_id_exists", "conflict.route_id", "id"))
			return
		}

		WriteAPIErr(w, r, ErrInternal(err))
		return
	}

	writeJSON(w, http.StatusCreated, map[string]string{"id": id, "status": "created"})
}

func (h *AdminHandler) UpdateRoute(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "routeID")
	var input AdminRouteInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		WriteAPIErr(w, r, ErrValidation("invalid_body", "validation.invalid_body", ""))
		return
	}

	if err := h.store.UpdateRoute(r.Context(), id, input); err != nil {
		WriteAPIErr(w, r, ErrInternal(err))
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"id": id, "status": "updated"})
}

func (h *AdminHandler) DeleteRoute(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "routeID")
	if err := h.store.DeleteRoute(r.Context(), id); err != nil {
		WriteAPIErr(w, r, ErrInternal(err))
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"id": id, "status": "deleted"})
}

func (h *AdminHandler) SetRouteActive(w http.ResponseWriter, r *http.Request) {
	routeID := chi.URLParam(r, "routeID")
	var input struct {
		IsActive *bool `json:"is_active"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		WriteAPIErr(w, r, ErrValidation("invalid_body", "validation.invalid_body", ""))
		return
	}
	if input.IsActive == nil {
		WriteAPIErr(w, r, ErrValidation("validation_failed", "validation.required", "is_active"))
		return
	}

	if err := h.store.SetRouteActive(r.Context(), routeID, *input.IsActive); err != nil {
		WriteAPIErr(w, r, ErrInternal(err))
		return
	}

	status := "inactive"
	if *input.IsActive {
		status = "active"
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"id":        routeID,
		"is_active": *input.IsActive,
		"status":    status,
	})
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
		WriteAPIErr(w, r, ErrInternal(err))
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"id": id, "status": "validated"})
}

// --- Stop CRUD ---

func (h *AdminHandler) CreateStop(w http.ResponseWriter, r *http.Request) {
	var input AdminStopInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		WriteAPIErr(w, r, ErrValidation("invalid_body", "validation.invalid_body", ""))
		return
	}
	if input.NameEN == "" || input.Lat == 0 {
		WriteAPIErr(w, r, ErrValidation("validation_failed", "validation.required", ""))
		return
	}

	id, err := h.store.CreateStop(r.Context(), input)
	if err != nil {
		WriteAPIErr(w, r, ErrInternal(err))
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"id": id, "status": "created"})
}

func (h *AdminHandler) UpdateStop(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "stopID")
	var input AdminStopInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		WriteAPIErr(w, r, ErrValidation("invalid_body", "validation.invalid_body", ""))
		return
	}

	if err := h.store.UpdateStop(r.Context(), id, input); err != nil {
		WriteAPIErr(w, r, ErrInternal(err))
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
		WriteAPIErr(w, r, ErrValidation("invalid_body", "validation.invalid_body", ""))
		return
	}

	if err := h.store.SetRouteStops(r.Context(), routeID, input.Stops); err != nil {
		WriteAPIErr(w, r, ErrInternal(err))
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
		WriteAPIErr(w, r, ErrValidation("invalid_body", "validation.invalid_body", ""))
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

// --- Route Detail ---

func (h *AdminHandler) GetRouteDetail(w http.ResponseWriter, r *http.Request) {
	routeID := chi.URLParam(r, "routeID")
	detail, err := h.store.GetRouteDetail(r.Context(), routeID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			WriteAPIErr(w, r, ErrNotFound("not_found.route"))
			return
		}
		WriteAPIErr(w, r, ErrInternal(err))
		return
	}
	writeJSON(w, http.StatusOK, detail)
}

func (h *AdminHandler) GetTimetable(w http.ResponseWriter, r *http.Request) {
	routeID := chi.URLParam(r, "routeID")
	entries, err := h.store.GetTimetableEntries(r.Context(), routeID)
	if err != nil {
		WriteAPIErr(w, r, ErrInternal(err))
		return
	}
	writeJSON(w, http.StatusOK, entries)
}

func (h *AdminHandler) DeleteStop(w http.ResponseWriter, r *http.Request) {
	stopID := chi.URLParam(r, "stopID")
	if err := h.store.DeleteStop(r.Context(), stopID); err != nil {
		WriteAPIErr(w, r, ErrInternal(err))
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// --- Dashboard ---

func (h *AdminHandler) ListRoutes(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	perPage, _ := strconv.Atoi(r.URL.Query().Get("per_page"))
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 50
	}

	filter := AdminRouteFilter{
		Query:       r.URL.Query().Get("q"),
		Operator:    r.URL.Query().Get("operator"),
		ServiceType: r.URL.Query().Get("service_type"),
		Page:        page,
		PerPage:     perPage,
	}

	result, err := h.store.ListRoutesFiltered(r.Context(), filter)
	if err != nil {
		WriteAPIErr(w, r, ErrInternal(err))
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *AdminHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	stats, err := h.store.GetDashboardStats(r.Context())
	if err != nil {
		WriteAPIErr(w, r, ErrInternal(err))
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

func (h *AdminHandler) UpdatePolyline(w http.ResponseWriter, r *http.Request) {
	routeID := chi.URLParam(r, "routeID")

	var input struct {
		Coordinates [][]float64 `json:"coordinates"`
		Confidence  float64     `json:"confidence"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		WriteAPIErr(w, r, ErrValidation("invalid_body", "validation.invalid_body", ""))
		return
	}
	if len(input.Coordinates) < 2 {
		WriteAPIErr(w, r, ErrValidation("validation_failed", "validation.invalid_format", "coordinates"))
		return
	}

	confidence := input.Confidence
	if confidence <= 0 {
		confidence = 0.8
	}

	if err := h.store.UpdateRoutePolyline(r.Context(), routeID, input.Coordinates, confidence); err != nil {
		WriteAPIErr(w, r, ErrInternal(err))
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"route_id": routeID,
		"points":   len(input.Coordinates),
		"status":   "updated",
	})
}

// --- Patterns ---

func (h *AdminHandler) GetPatterns(w http.ResponseWriter, r *http.Request) {
	routeID := chi.URLParam(r, "routeID")
	patterns, err := h.store.GetRoutePatterns(r.Context(), routeID)
	if err != nil {
		WriteAPIErr(w, r, ErrInternal(err))
		return
	}
	writeJSON(w, http.StatusOK, patterns)
}

func (h *AdminHandler) GetPatternStops(w http.ResponseWriter, r *http.Request) {
	patternID := chi.URLParam(r, "patternID")
	stops, err := h.store.GetPatternStops(r.Context(), patternID)
	if err != nil {
		WriteAPIErr(w, r, ErrInternal(err))
		return
	}
	writeJSON(w, http.StatusOK, stops)
}

// RegisterAdminTime is unused but shows the intended validation timestamp
var _ = time.Now
