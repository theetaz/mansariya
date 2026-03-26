package handler

import (
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/masariya/backend/internal/ws"
	"nhooyr.io/websocket"
)

type WSHandler struct {
	hub *ws.Hub
}

func NewWSHandler(hub *ws.Hub) *WSHandler {
	return &WSHandler{hub: hub}
}

// HandleTrack upgrades to WebSocket and streams live bus positions for a route.
// The Pub/Sub → Hub bridge runs in main.go; this handler just manages the connection lifecycle.
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

	// Subscribe to hub — broadcasts from Pub/Sub bridge will be forwarded
	sub := h.hub.Subscribe(r.Context(), conn, routeID)
	defer h.hub.Unsubscribe(sub)

	// Keep connection alive by reading client messages (heartbeats/pings)
	for {
		_, _, err := conn.Read(r.Context())
		if err != nil {
			slog.Debug("ws closed", "route_id", routeID, "error", err)
			return
		}
	}
}
