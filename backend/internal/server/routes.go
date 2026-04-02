package server

import (
	_ "embed"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/masariya/backend/internal/handler"
)

//go:embed openapi.yaml
var openapiSpec []byte

// Deps holds all handler dependencies, injected from main.
type Deps struct {
	GPS        *handler.GPSHandler
	Routes     *handler.RoutesHandler
	Search     *handler.SearchHandler
	Stops      *handler.StopsHandler
	ETA        *handler.ETAHandler
	WS         *handler.WSHandler
	Sync       *handler.SyncHandler
	Journey    *handler.JourneyHandler
	Admin      *handler.AdminHandler
	Buses      *handler.BusesHandler
	Simulation *handler.SimulationHandler
	AdminWS    *handler.AdminWSHandler
	System     *handler.SystemHandler
	Auth       *handler.AuthHandler
	RBAC       *handler.RBACMiddleware
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

	// Health / root
	r.Get("/", healthCheck)
	r.Get("/health", healthCheck)

	// API Documentation
	r.Get("/docs/openapi.yaml", serveOpenAPISpec)
	r.Get("/docs", serveSwaggerUI)

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

	// Auth
	r.Route("/api/v1/auth", func(r chi.Router) {
		// Public endpoints (no auth required)
		r.Post("/login", deps.Auth.Login)
		r.Post("/logout", deps.Auth.Logout)
		r.Post("/refresh", deps.Auth.Refresh)
		r.Post("/invite/accept", deps.Auth.AcceptInvite)
		r.Post("/password-reset/request", deps.Auth.RequestPasswordReset)
		r.Post("/password-reset/confirm", deps.Auth.ConfirmPasswordReset)

		// Authenticated endpoints (JWT required)
		r.Group(func(r chi.Router) {
			r.Use(deps.Auth.JWTMiddleware)
			r.Get("/me", deps.Auth.Me)
			r.Get("/sessions", deps.Auth.ListSessions)
			r.Post("/sessions/revoke", deps.Auth.RevokeSession)
			r.Post("/sessions/revoke-others", deps.Auth.RevokeOtherSessions)
		})
	})

	// WebSocket
	r.Get("/ws/track/{routeID}", deps.WS.HandleTrack)
	r.Get("/ws/admin/devices", deps.AdminWS.HandleDevices)

	// Admin API (JWT + API key auth with per-route permission enforcement)
	r.Route("/api/v1/admin", func(r chi.Router) {
		r.Use(deps.RBAC.Authenticate)

		// Dashboard & system
		r.With(handler.RequirePermission("routes.view")).Get("/routes", deps.Admin.ListRoutes)
		r.With(handler.RequirePermission("routes.view")).Get("/routes/{routeID}", deps.Admin.GetRouteDetail)
		r.With(handler.RequirePermission("routes.view")).Get("/stats", deps.Admin.GetStats)
		r.With(handler.RequirePermission("system.health")).Get("/system/health", deps.System.GetHealth)

		// Route CRUD
		r.With(handler.RequirePermission("routes.create")).Post("/routes", deps.Admin.CreateRoute)
		r.With(handler.RequirePermission("routes.edit")).Put("/routes/{routeID}", deps.Admin.UpdateRoute)
		r.With(handler.RequirePermission("routes.activate")).Put("/routes/{routeID}/status", deps.Admin.SetRouteActive)
		r.With(handler.RequirePermission("routes.delete")).Delete("/routes/{routeID}", deps.Admin.DeleteRoute)
		r.With(handler.RequirePermission("routes.edit")).Post("/routes/{routeID}/validate", deps.Admin.ValidateRoute)

		// Route sub-resources
		r.With(handler.RequirePermission("routes.edit")).Put("/routes/{routeID}/stops", deps.Admin.SetRouteStops)
		r.With(handler.RequirePermission("routes.view")).Get("/routes/{routeID}/patterns", deps.Admin.GetPatterns)
		r.With(handler.RequirePermission("routes.view")).Get("/routes/{routeID}/patterns/{patternID}/stops", deps.Admin.GetPatternStops)
		r.With(handler.RequirePermission("timetables.edit")).Put("/routes/{routeID}/timetable", deps.Admin.SetTimetable)
		r.With(handler.RequirePermission("timetables.view")).Get("/routes/{routeID}/timetable", deps.Admin.GetTimetable)
		r.With(handler.RequirePermission("map.edit_polyline")).Put("/routes/{routeID}/polyline", deps.Admin.UpdatePolyline)

		// Stops
		r.With(handler.RequirePermission("stops.create")).Post("/stops", deps.Admin.CreateStop)
		r.With(handler.RequirePermission("stops.edit")).Put("/stops/{stopID}", deps.Admin.UpdateStop)
		r.With(handler.RequirePermission("stops.delete")).Delete("/stops/{stopID}", deps.Admin.DeleteStop)

		// Simulations
		r.With(handler.RequirePermission("simulations.view")).Get("/simulations", deps.Simulation.List)
		r.With(handler.RequirePermission("simulations.manage")).Post("/simulations", deps.Simulation.Create)
		r.With(handler.RequirePermission("simulations.view")).Get("/simulations/active", deps.Simulation.ActiveStats)
		r.With(handler.RequirePermission("simulations.view")).Get("/simulations/{simID}", deps.Simulation.Get)
		r.With(handler.RequirePermission("simulations.manage")).Put("/simulations/{simID}", deps.Simulation.Update)
		r.With(handler.RequirePermission("simulations.manage")).Delete("/simulations/{simID}", deps.Simulation.Delete)
		r.With(handler.RequirePermission("simulations.manage")).Post("/simulations/{simID}/start", deps.Simulation.StartJob)
		r.With(handler.RequirePermission("simulations.manage")).Post("/simulations/{simID}/pause", deps.Simulation.PauseJob)
		r.With(handler.RequirePermission("simulations.manage")).Post("/simulations/{simID}/resume", deps.Simulation.ResumeJob)
		r.With(handler.RequirePermission("simulations.manage")).Post("/simulations/{simID}/stop", deps.Simulation.StopJob)
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

func serveOpenAPISpec(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/yaml; charset=utf-8")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Write(openapiSpec)
}

func serveSwaggerUI(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write([]byte(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Mansariya API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>
    body { margin: 0; background: #fafafa; }
    .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/docs/openapi.yaml',
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: "BaseLayout"
    });
  </script>
</body>
</html>`))
}
