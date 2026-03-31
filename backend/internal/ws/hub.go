package ws

import (
	"context"
	"encoding/json"
	"log/slog"
	"sync"
	"time"

	"nhooyr.io/websocket"
)

// Conn wraps a WebSocket connection with its subscribed route.
type Conn struct {
	ws      *websocket.Conn
	routeID string
	ctx     context.Context
	cancel  context.CancelFunc
}

// Hub manages WebSocket connections grouped by route ID.
// When a bus position update arrives for a route, it broadcasts to all subscribers.
type Hub struct {
	mu         sync.RWMutex
	conns      map[string]map[*Conn]struct{} // routeID → set of connections
	adminConns map[*Conn]struct{}            // admin device stream connections
}

func NewHub() *Hub {
	return &Hub{
		conns:      make(map[string]map[*Conn]struct{}),
		adminConns: make(map[*Conn]struct{}),
	}
}

// Subscribe registers a WebSocket connection for a route.
func (h *Hub) Subscribe(ctx context.Context, ws *websocket.Conn, routeID string) *Conn {
	connCtx, cancel := context.WithCancel(ctx)
	conn := &Conn{
		ws:      ws,
		routeID: routeID,
		ctx:     connCtx,
		cancel:  cancel,
	}

	h.mu.Lock()
	if h.conns[routeID] == nil {
		h.conns[routeID] = make(map[*Conn]struct{})
	}
	h.conns[routeID][conn] = struct{}{}
	h.mu.Unlock()

	slog.Info("ws subscribe", "route_id", routeID, "total", h.CountForRoute(routeID))
	return conn
}

// Unsubscribe removes a connection.
func (h *Hub) Unsubscribe(conn *Conn) {
	conn.cancel()

	h.mu.Lock()
	if subs, ok := h.conns[conn.routeID]; ok {
		delete(subs, conn)
		if len(subs) == 0 {
			delete(h.conns, conn.routeID)
		}
	}
	h.mu.Unlock()

	slog.Info("ws unsubscribe", "route_id", conn.routeID)
}

// Broadcast sends a message to all connections subscribed to a route.
func (h *Hub) Broadcast(routeID string, data any) {
	msg, err := json.Marshal(data)
	if err != nil {
		slog.Error("ws broadcast marshal", "error", err)
		return
	}

	h.mu.RLock()
	subs := h.conns[routeID]
	conns := make([]*Conn, 0, len(subs))
	for conn := range subs {
		conns = append(conns, conn)
	}
	h.mu.RUnlock()

	for _, conn := range conns {
		go func(c *Conn) {
			ctx, cancel := context.WithTimeout(c.ctx, 5*time.Second)
			defer cancel()

			if err := c.ws.Write(ctx, websocket.MessageText, msg); err != nil {
				slog.Debug("ws write failed, removing", "route_id", c.routeID, "error", err)
				h.Unsubscribe(c)
			}
		}(conn)
	}
}

// CountForRoute returns the number of connections for a route.
func (h *Hub) CountForRoute(routeID string) int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.conns[routeID])
}

// TotalConns returns total active WebSocket connections.
func (h *Hub) TotalConns() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	total := 0
	for _, subs := range h.conns {
		total += len(subs)
	}
	return total
}

// SubscribedRoutes returns all route IDs with active subscribers.
func (h *Hub) SubscribedRoutes() []string {
	h.mu.RLock()
	defer h.mu.RUnlock()
	routes := make([]string, 0, len(h.conns))
	for id := range h.conns {
		routes = append(routes, id)
	}
	return routes
}

// SubscribeAdmin registers a WebSocket connection for the admin device stream.
func (h *Hub) SubscribeAdmin(ctx context.Context, ws *websocket.Conn) *Conn {
	connCtx, cancel := context.WithCancel(ctx)
	conn := &Conn{
		ws:      ws,
		routeID: "__admin__",
		ctx:     connCtx,
		cancel:  cancel,
	}

	h.mu.Lock()
	h.adminConns[conn] = struct{}{}
	h.mu.Unlock()

	slog.Info("ws admin subscribe", "total_admin", h.AdminConnCount())
	return conn
}

// UnsubscribeAdmin removes an admin connection.
func (h *Hub) UnsubscribeAdmin(conn *Conn) {
	conn.cancel()

	h.mu.Lock()
	delete(h.adminConns, conn)
	h.mu.Unlock()

	slog.Info("ws admin unsubscribe")
}

// BroadcastAdmin sends a message to all admin device stream connections.
func (h *Hub) BroadcastAdmin(data any) {
	msg, err := json.Marshal(data)
	if err != nil {
		slog.Error("ws admin broadcast marshal", "error", err)
		return
	}

	h.mu.RLock()
	conns := make([]*Conn, 0, len(h.adminConns))
	for conn := range h.adminConns {
		conns = append(conns, conn)
	}
	h.mu.RUnlock()

	for _, conn := range conns {
		go func(c *Conn) {
			ctx, cancel := context.WithTimeout(c.ctx, 5*time.Second)
			defer cancel()

			if err := c.ws.Write(ctx, websocket.MessageText, msg); err != nil {
				slog.Debug("ws admin write failed, removing", "error", err)
				h.UnsubscribeAdmin(c)
			}
		}(conn)
	}
}

// AdminConnCount returns the number of admin connections.
func (h *Hub) AdminConnCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.adminConns)
}
