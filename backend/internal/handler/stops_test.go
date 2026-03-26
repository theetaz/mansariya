package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/masariya/backend/internal/model"
	"github.com/paulmach/orb"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestStopsHandler_Nearby(t *testing.T) {
	ss := &mockStopStore{
		nearby: []model.Stop{
			{ID: "s1", NameEN: "Colombo Fort", Location: orb.Point{79.8612, 6.9271}},
			{ID: "s2", NameEN: "Pettah", Location: orb.Point{79.8530, 6.9350}},
		},
	}
	h := NewStopsHandler(ss)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/stops/nearby?lat=6.9271&lng=79.8612", nil)
	w := httptest.NewRecorder()

	h.Nearby(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var stops []model.Stop
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &stops))
	assert.Len(t, stops, 2)
	assert.Equal(t, "Colombo Fort", stops[0].NameEN)
}

func TestStopsHandler_Nearby_MissingParams(t *testing.T) {
	h := NewStopsHandler(&mockStopStore{})

	tests := []struct {
		name string
		url  string
	}{
		{"no params", "/api/v1/stops/nearby"},
		{"only lat", "/api/v1/stops/nearby?lat=6.9"},
		{"only lng", "/api/v1/stops/nearby?lng=79.8"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, tt.url, nil)
			w := httptest.NewRecorder()
			h.Nearby(w, req)
			assert.Equal(t, http.StatusBadRequest, w.Code)
		})
	}
}

func TestStopsHandler_Nearby_DBError(t *testing.T) {
	ss := &mockStopStore{nearbyErr: fmt.Errorf("db error")}
	h := NewStopsHandler(ss)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/stops/nearby?lat=6.9&lng=79.8", nil)
	w := httptest.NewRecorder()

	h.Nearby(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestStopsHandler_Nearby_EmptyResults(t *testing.T) {
	ss := &mockStopStore{nearby: []model.Stop{}}
	h := NewStopsHandler(ss)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/stops/nearby?lat=6.9&lng=79.8", nil)
	w := httptest.NewRecorder()

	h.Nearby(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}
