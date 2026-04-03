package handler

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/masariya/backend/internal/ws"
	"nhooyr.io/websocket"
)

// AdminWSHandler handles the admin device stream WebSocket endpoint.
type AdminWSHandler struct {
	hub       *ws.Hub
	snapshots DeviceSnapshotProvider
	apiKey    string
	auth      WSTokenValidator
}

// WSTokenValidator validates JWT tokens for WebSocket connections.
type WSTokenValidator interface {
	ValidateWSToken(token string) error
}

func NewAdminWSHandler(hub *ws.Hub, snapshots DeviceSnapshotProvider, apiKey string, auth WSTokenValidator) *AdminWSHandler {
	return &AdminWSHandler{hub: hub, snapshots: snapshots, apiKey: apiKey, auth: auth}
}

// HandleDevices upgrades to WebSocket and streams all device positions to admin.
// Auth via JWT token query param or X-API-Key (WS can't send custom headers from browser).
func (h *AdminWSHandler) HandleDevices(w http.ResponseWriter, r *http.Request) {
	authorized := false

	// Try JWT token first (query param)
	if token := r.URL.Query().Get("token"); token != "" && h.auth != nil {
		if err := h.auth.ValidateWSToken(token); err == nil {
			authorized = true
		}
	}

	// Fall back to API key
	if !authorized {
		key := r.URL.Query().Get("api_key")
		if key == "" {
			key = r.Header.Get("X-API-Key")
		}
		if key != "" && key == h.apiKey {
			authorized = true
		}
	}

	if !authorized {
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

	if h.snapshots != nil {
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		snapshot, err := h.snapshots.CurrentDevicesSnapshot(ctx)
		cancel()
		if err != nil {
			slog.Warn("admin ws snapshot", "error", err)
		} else {
			ctx, cancel = context.WithTimeout(r.Context(), 5*time.Second)
			if err := conn.Write(ctx, websocket.MessageText, mustJSON(snapshot)); err != nil {
				cancel()
				slog.Debug("admin ws initial snapshot write failed", "error", err)
				return
			}
			cancel()
		}
	}

	// Keep connection alive by reading client messages (heartbeats/pings)
	for {
		_, _, err := conn.Read(r.Context())
		if err != nil {
			slog.Debug("admin ws closed", "error", err)
			return
		}
	}
}

func mustJSON(v any) []byte {
	data, _ := json.Marshal(v)
	return data
}
