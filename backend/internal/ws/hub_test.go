package ws

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"nhooyr.io/websocket"
)

// helper to create a real WebSocket connection pair via httptest
func newTestWSConn(t *testing.T) (*websocket.Conn, *httptest.Server) {
	t.Helper()
	var serverConn *websocket.Conn
	ready := make(chan struct{})

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c, err := websocket.Accept(w, r, nil)
		if err != nil {
			t.Fatalf("ws accept: %v", err)
		}
		serverConn = c
		close(ready)
		// Keep connection alive until test ends
		select {}
	}))

	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http")
	clientConn, _, err := websocket.Dial(context.Background(), wsURL, nil)
	require.NoError(t, err)

	<-ready
	_ = serverConn // server side managed by hub

	return clientConn, srv
}

func TestHub_NewEmpty(t *testing.T) {
	hub := NewHub()
	assert.Equal(t, 0, hub.TotalConns())
	assert.Empty(t, hub.SubscribedRoutes())
}

func TestHub_SubscribeUnsubscribe(t *testing.T) {
	hub := NewHub()

	// Create a mock websocket.Conn — for subscribe/unsubscribe we just need the struct
	// We use a real httptest server for proper WebSocket testing
	ctx := context.Background()

	// Use a nil ws conn for basic subscribe/unsubscribe counting tests
	// (Broadcast is tested separately with real connections)
	conn := &Conn{
		ws:      nil, // won't be written to in this test
		routeID: "138",
		ctx:     ctx,
		cancel:  func() {},
	}

	hub.mu.Lock()
	if hub.conns["138"] == nil {
		hub.conns["138"] = make(map[*Conn]struct{})
	}
	hub.conns["138"][conn] = struct{}{}
	hub.mu.Unlock()

	assert.Equal(t, 1, hub.CountForRoute("138"))
	assert.Equal(t, 1, hub.TotalConns())
	assert.Contains(t, hub.SubscribedRoutes(), "138")

	hub.Unsubscribe(conn)

	assert.Equal(t, 0, hub.CountForRoute("138"))
	assert.Equal(t, 0, hub.TotalConns())
}

func TestHub_MultipleRoutes(t *testing.T) {
	hub := NewHub()
	ctx := context.Background()

	addConn := func(routeID string) *Conn {
		conn := &Conn{ws: nil, routeID: routeID, ctx: ctx, cancel: func() {}}
		hub.mu.Lock()
		if hub.conns[routeID] == nil {
			hub.conns[routeID] = make(map[*Conn]struct{})
		}
		hub.conns[routeID][conn] = struct{}{}
		hub.mu.Unlock()
		return conn
	}

	addConn("1")
	addConn("1")
	addConn("138")

	assert.Equal(t, 2, hub.CountForRoute("1"))
	assert.Equal(t, 1, hub.CountForRoute("138"))
	assert.Equal(t, 0, hub.CountForRoute("2"))
	assert.Equal(t, 3, hub.TotalConns())

	routes := hub.SubscribedRoutes()
	assert.Len(t, routes, 2)
}

func TestHub_UnsubscribeCleansEmptyRoute(t *testing.T) {
	hub := NewHub()
	ctx := context.Background()

	conn := &Conn{ws: nil, routeID: "138", ctx: ctx, cancel: func() {}}
	hub.mu.Lock()
	hub.conns["138"] = map[*Conn]struct{}{conn: {}}
	hub.mu.Unlock()

	assert.Len(t, hub.SubscribedRoutes(), 1)

	hub.Unsubscribe(conn)

	// Route entry should be removed when last conn leaves
	assert.Empty(t, hub.SubscribedRoutes())
}

func TestHub_CountForNonexistentRoute(t *testing.T) {
	hub := NewHub()
	assert.Equal(t, 0, hub.CountForRoute("nonexistent"))
}

func TestHub_ConcurrentAccess(t *testing.T) {
	hub := NewHub()
	ctx := context.Background()

	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			routeID := "route_" + string(rune('A'+id%5))
			conn := &Conn{ws: nil, routeID: routeID, ctx: ctx, cancel: func() {}}

			hub.mu.Lock()
			if hub.conns[routeID] == nil {
				hub.conns[routeID] = make(map[*Conn]struct{})
			}
			hub.conns[routeID][conn] = struct{}{}
			hub.mu.Unlock()

			hub.CountForRoute(routeID)
			hub.TotalConns()
			hub.SubscribedRoutes()

			time.Sleep(time.Millisecond)
			hub.Unsubscribe(conn)
		}(i)
	}
	wg.Wait()

	assert.Equal(t, 0, hub.TotalConns())
}

func TestHub_Subscribe_WithRealContext(t *testing.T) {
	hub := NewHub()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Create a minimal test — Subscribe creates a Conn and tracks it
	// We can't use a real websocket.Conn without a full HTTP server,
	// but we can test the Subscribe method's bookkeeping
	conn := hub.Subscribe(ctx, nil, "138")

	assert.Equal(t, 1, hub.CountForRoute("138"))
	assert.Equal(t, "138", conn.routeID)

	hub.Unsubscribe(conn)
	assert.Equal(t, 0, hub.CountForRoute("138"))
}

func TestHub_BroadcastNoSubscribers(t *testing.T) {
	hub := NewHub()
	// Should not panic
	hub.Broadcast("nonexistent_route", map[string]string{"test": "data"})
}
