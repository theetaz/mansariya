package server

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/masariya/backend/internal/handler"
)

// Deps holds all handler dependencies, injected from main.
type Deps struct {
	GPS     *handler.GPSHandler
	Routes  *handler.RoutesHandler
	Search  *handler.SearchHandler
	Stops   *handler.StopsHandler
	ETA     *handler.ETAHandler
	WS      *handler.WSHandler
	Sync    *handler.SyncHandler
	Journey *handler.JourneyHandler
	Admin   *handler.AdminHandler
	Buses   *handler.BusesHandler
}

func NewRouter(deps *Deps) *chi.Mux {
	r := chi.NewRouter()

	// Global middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(Logger)
	r.Use(CORS)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Heartbeat("/ping"))

	// Health check
	r.Get("/health", healthCheck)

	// API v1
	r.Route("/api/v1", func(r chi.Router) {
		// GPS ingestion
		r.Post("/gps/batch", deps.GPS.HandleBatch)

		// Routes
		r.Get("/routes", deps.Routes.List)
		r.Get("/routes/sync", deps.Sync.HandleSync)
		r.Get("/routes/{routeID}", deps.Routes.Get)
		r.Get("/routes/{routeID}/eta", deps.ETA.Handle)
		r.Get("/routes/{routeID}/stops", deps.Journey.HandleRouteStops)
		r.Get("/routes/{routeID}/polyline", deps.Routes.GetPolyline)

		// Search
		r.Get("/search", deps.Search.Handle)

		// Journey planning
		r.Get("/journey", deps.Journey.HandleSearch)

		// Stops
		r.Get("/stops/nearby", deps.Stops.Nearby)
		r.Get("/stops/search", deps.Journey.HandleStopSearch)

		// Live buses
		r.Get("/buses/active", deps.Buses.Active)
		r.Get("/buses/nearby", deps.Buses.Nearby)
	})

	// WebSocket
	r.Get("/ws/track/{routeID}", deps.WS.HandleTrack)

	// Admin API (API key protected)
	r.Route("/api/v1/admin", func(r chi.Router) {
		r.Use(deps.Admin.AuthMiddleware)

		// Routes
		r.Post("/routes", deps.Admin.CreateRoute)
		r.Put("/routes/{routeID}", deps.Admin.UpdateRoute)
		r.Delete("/routes/{routeID}", deps.Admin.DeleteRoute)
		r.Post("/routes/{routeID}/validate", deps.Admin.ValidateRoute)
		r.Put("/routes/{routeID}/stops", deps.Admin.SetRouteStops)
		r.Put("/routes/{routeID}/timetable", deps.Admin.SetTimetable)

		// Stops
		r.Post("/stops", deps.Admin.CreateStop)
		r.Put("/stops/{stopID}", deps.Admin.UpdateStop)
	})

	return r
}

func healthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "ok",
		"service": "masariya",
	})
}
