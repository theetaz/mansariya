package handler

import (
	"log/slog"
	"net/http"

	"github.com/masariya/backend/internal/ws"
	"nhooyr.io/websocket"
)

// AdminWSHandler handles the admin device stream WebSocket endpoint.
type AdminWSHandler struct {
	hub    *ws.Hub
	apiKey string
}

func NewAdminWSHandler(hub *ws.Hub, apiKey string) *AdminWSHandler {
	return &AdminWSHandler{hub: hub, apiKey: apiKey}
}

// HandleDevices upgrades to WebSocket and streams all device positions to admin.
// Auth via X-API-Key query param (WebSocket can't send custom headers from browser).
func (h *AdminWSHandler) HandleDevices(w http.ResponseWriter, r *http.Request) {
	// Check API key from query param (WS connections can't use headers from JS)
	key := r.URL.Query().Get("api_key")
	if key == "" {
		key = r.Header.Get("X-API-Key")
	}
	if key == "" || key != h.apiKey {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		OriginPatterns: []string{"*"},
	})
	if err != nil {
		slog.Error("admin ws accept", "error", err)
		return
	}

	sub := h.hub.SubscribeAdmin(r.Context(), conn)
	defer h.hub.UnsubscribeAdmin(sub)

	// Keep connection alive by reading client messages (heartbeats/pings)
	for {
		_, _, err := conn.Read(r.Context())
		if err != nil {
			slog.Debug("admin ws closed", "error", err)
			return
		}
	}
}
