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
	GPS    *handler.GPSHandler
	Routes *handler.RoutesHandler
	Search *handler.SearchHandler
	Stops  *handler.StopsHandler
	ETA    *handler.ETAHandler
	WS     *handler.WSHandler
	Sync   *handler.SyncHandler
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

		// Search
		r.Get("/search", deps.Search.Handle)

		// Stops
		r.Get("/stops/nearby", deps.Stops.Nearby)
	})

	// WebSocket
	r.Get("/ws/track/{routeID}", deps.WS.HandleTrack)

	return r
}

func healthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "ok",
		"service": "masariya",
	})
}
