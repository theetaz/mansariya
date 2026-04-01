package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSystemHandlerGetHealth_AllHealthy(t *testing.T) {
	valhalla := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/status", r.URL.Path)
		w.WriteHeader(http.StatusOK)
	}))
	defer valhalla.Close()

	handler := NewSystemHandler(
		func(ctx context.Context) error { return nil },
		func(ctx context.Context) error { return nil },
		valhalla.URL,
	)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/system/health", nil)
	rec := httptest.NewRecorder()

	handler.GetHealth(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)

	var resp systemHealthResponse
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&resp))
	require.Equal(t, "ok", resp.Status)
	require.Len(t, resp.Services, 4)
	require.Equal(t, "backend", resp.Services[0].Name)
	require.Equal(t, "ok", resp.Services[1].Status)
	require.Equal(t, "ok", resp.Services[2].Status)
	require.Equal(t, "ok", resp.Services[3].Status)
}

func TestSystemHandlerGetHealth_DegradedServices(t *testing.T) {
	valhalla := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer valhalla.Close()

	handler := NewSystemHandler(
		func(ctx context.Context) error { return errors.New("postgres unavailable") },
		func(ctx context.Context) error { return nil },
		valhalla.URL,
	)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/system/health", nil)
	rec := httptest.NewRecorder()

	handler.GetHealth(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)

	var resp systemHealthResponse
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&resp))
	require.Equal(t, "degraded", resp.Status)
	require.Equal(t, "down", resp.Services[1].Status)
	require.Equal(t, "postgres unavailable", resp.Services[1].Message)
	require.Equal(t, "ok", resp.Services[2].Status)
	require.Equal(t, "down", resp.Services[3].Status)
	require.Equal(t, "status 503", resp.Services[3].Message)
}
