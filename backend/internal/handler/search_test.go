package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/masariya/backend/internal/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSearchHandler_ValidQuery(t *testing.T) {
	rs := &mockRouteStore{
		searchRes: []model.Route{
			{ID: "1", NameEN: "Colombo - Kandy"},
			{ID: "138", NameEN: "Colombo - Kurunegala"},
		},
	}
	h := NewSearchHandler(rs)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/search?q=colombo", nil)
	w := httptest.NewRecorder()

	h.Handle(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))

	var results []model.Route
	require.NoError(t, json.Unmarshal(resp["results"], &results))
	assert.Len(t, results, 2)
	assert.Equal(t, "colombo", string(resp["query"][1:len(resp["query"])-1])) // strip quotes
}

func TestSearchHandler_EmptyQuery(t *testing.T) {
	h := NewSearchHandler(&mockRouteStore{})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/search", nil)
	w := httptest.NewRecorder()

	h.Handle(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestSearchHandler_EmptyQueryParam(t *testing.T) {
	h := NewSearchHandler(&mockRouteStore{})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/search?q=", nil)
	w := httptest.NewRecorder()

	h.Handle(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestSearchHandler_NoResults(t *testing.T) {
	rs := &mockRouteStore{searchRes: []model.Route{}}
	h := NewSearchHandler(rs)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/search?q=xyznonexistent", nil)
	w := httptest.NewRecorder()

	h.Handle(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp struct {
		Count int `json:"count"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, 0, resp.Count)
}

func TestSearchHandler_DBError(t *testing.T) {
	rs := &mockRouteStore{searchErr: fmt.Errorf("db error")}
	h := NewSearchHandler(rs)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/search?q=test", nil)
	w := httptest.NewRecorder()

	h.Handle(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestSearchHandler_CustomLimit(t *testing.T) {
	rs := &mockRouteStore{searchRes: []model.Route{}}
	h := NewSearchHandler(rs)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/search?q=test&limit=5", nil)
	w := httptest.NewRecorder()

	h.Handle(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}
