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
	Metrics *handler.MetricsHandler
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

		// Metrics
		if deps.Metrics != nil {
			r.Get("/metrics", deps.Metrics.Handle)
		}
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
