package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/masariya/backend/internal/model"
	"github.com/paulmach/orb"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockRouteStore implements RouteQuerier for testing.
type mockRouteStore struct {
	routes     map[string]*model.Route
	nearby     []model.Route
	searchRes  []model.Route
	err        error
	searchErr  error
	nearbyErr  error
}

func (m *mockRouteStore) GetAll(_ context.Context) (map[string]orb.LineString, error) {
	return nil, nil
}

func (m *mockRouteStore) GetByID(_ context.Context, id string) (*model.Route, error) {
	if m.err != nil {
		return nil, m.err
	}
	r, ok := m.routes[id]
	if !ok {
		return nil, fmt.Errorf("not found")
	}
	return r, nil
}

func (m *mockRouteStore) ListNearby(_ context.Context, _, _, _ float64) ([]model.Route, error) {
	if m.nearbyErr != nil {
		return nil, m.nearbyErr
	}
	return m.nearby, nil
}

func (m *mockRouteStore) Search(_ context.Context, _ string, _ int) ([]model.Route, error) {
	if m.searchErr != nil {
		return nil, m.searchErr
	}
	return m.searchRes, nil
}

func (m *mockRouteStore) GetPolyline(_ context.Context, _ string) ([][]float64, error) {
	return nil, nil
}

// mockStopStore implements StopQuerier for testing.
type mockStopStore struct {
	stops     []model.Stop
	nearby    []model.Stop
	err       error
	nearbyErr error
}

func (m *mockStopStore) GetByRoute(_ context.Context, _ string) ([]model.Stop, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.stops, nil
}

func (m *mockStopStore) ListNearby(_ context.Context, _, _, _ float64) ([]model.Stop, error) {
	if m.nearbyErr != nil {
		return nil, m.nearbyErr
	}
	return m.nearby, nil
}

func TestRoutesHandler_List(t *testing.T) {
	rs := &mockRouteStore{
		nearby: []model.Route{
			{ID: "138", NameEN: "Colombo - Kurunegala", NameSI: "කොළඹ - කුරුණෑගල", NameTA: "கொழும்பு"},
		},
	}
	h := NewRoutesHandler(rs, &mockStopStore{})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/routes?lat=6.9271&lng=79.8612", nil)
	w := httptest.NewRecorder()

	h.List(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var routes []model.Route
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &routes))
	require.Len(t, routes, 1)
	assert.Equal(t, "138", routes[0].ID)
}

func TestRoutesHandler_List_MissingParams(t *testing.T) {
	h := NewRoutesHandler(&mockRouteStore{}, &mockStopStore{})

	tests := []struct {
		name string
		url  string
	}{
		{"no params", "/api/v1/routes"},
		{"only lat", "/api/v1/routes?lat=6.9"},
		{"only lng", "/api/v1/routes?lng=79.8"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, tt.url, nil)
			w := httptest.NewRecorder()
			h.List(w, req)
			assert.Equal(t, http.StatusBadRequest, w.Code)
		})
	}
}

func TestRoutesHandler_List_DBError(t *testing.T) {
	rs := &mockRouteStore{nearbyErr: fmt.Errorf("db down")}
	h := NewRoutesHandler(rs, &mockStopStore{})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/routes?lat=6.9&lng=79.8", nil)
	w := httptest.NewRecorder()

	h.List(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestRoutesHandler_Get(t *testing.T) {
	rs := &mockRouteStore{
		routes: map[string]*model.Route{
			"1": {ID: "1", NameEN: "Colombo - Kandy", NameSI: "කොළඹ - මහනුවර", NameTA: "கொழும்பு - கண்டி"},
		},
	}
	ss := &mockStopStore{
		stops: []model.Stop{
			{ID: "s1", NameEN: "Colombo Fort"},
			{ID: "s2", NameEN: "Kadawatha"},
		},
	}
	h := NewRoutesHandler(rs, ss)

	// Chi requires route context for URL params
	req := httptest.NewRequest(http.MethodGet, "/api/v1/routes/1", nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("routeID", "1")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	w := httptest.NewRecorder()

	h.Get(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Contains(t, string(resp["route"]), "Colombo - Kandy")
	assert.Contains(t, string(resp["stops"]), "Colombo Fort")
}

func TestRoutesHandler_Get_NotFound(t *testing.T) {
	rs := &mockRouteStore{routes: map[string]*model.Route{}}
	h := NewRoutesHandler(rs, &mockStopStore{})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/routes/999", nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("routeID", "999")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	w := httptest.NewRecorder()

	h.Get(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}
