package handler

import (
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/masariya/backend/internal/ws"
	"github.com/redis/go-redis/v9"
	"nhooyr.io/websocket"
)

type WSHandler struct {
	hub *ws.Hub
	rdb *redis.Client
}

func NewWSHandler(hub *ws.Hub, rdb *redis.Client) *WSHandler {
	return &WSHandler{hub: hub, rdb: rdb}
}

// HandleTrack upgrades to WebSocket and streams live bus positions for a route.
func (h *WSHandler) HandleTrack(w http.ResponseWriter, r *http.Request) {
	routeID := chi.URLParam(r, "routeID")
	if routeID == "" {
		http.Error(w, "route_id required", http.StatusBadRequest)
		return
	}

	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		OriginPatterns: []string{"*"},
	})
	if err != nil {
		slog.Error("ws accept", "error", err)
		return
	}

	// Subscribe this connection to the route
	sub := h.hub.Subscribe(r.Context(), conn, routeID)
	defer h.hub.Unsubscribe(sub)

	// Also subscribe to Redis Pub/Sub for this route and forward to WS hub
	// The hub.Broadcast is called by the pipeline broadcaster via Redis Pub/Sub
	// This goroutine just keeps the connection alive by reading (and discarding) client messages
	for {
		_, _, err := conn.Read(r.Context())
		if err != nil {
			slog.Debug("ws read closed", "route_id", routeID, "error", err)
			return
		}
	}
}
