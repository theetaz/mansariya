package valhalla

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTraceRoute_Success(t *testing.T) {
	// Mock Valhalla server
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/trace_route", r.URL.Path)
		assert.Equal(t, http.MethodPost, r.Method)
		assert.Equal(t, "application/json", r.Header.Get("Content-Type"))

		// Verify request body
		var req TraceRouteRequest
		require.NoError(t, json.NewDecoder(r.Body).Decode(&req))
		assert.Equal(t, "bus", req.Costing)
		assert.Equal(t, "map_snap", req.ShapeMatch)
		assert.Len(t, req.Shape, 3)

		// Return mock response
		resp := TraceRouteResponse{}
		resp.Trip.MatchedPoints = []MatchedPointResult{
			{Lat: 6.9271, Lon: 79.8612, Type: "matched", EdgeIndex: 1, DistFromTrace: 5.2},
			{Lat: 6.9285, Lon: 79.8620, Type: "matched", EdgeIndex: 2, DistFromTrace: 3.1},
			{Lat: 6.9301, Lon: 79.8635, Type: "interpolated", EdgeIndex: 3, DistFromTrace: 8.0},
		}
		resp.Trip.Legs = append(resp.Trip.Legs, struct {
			Shape   string `json:"shape"`
			Summary struct {
				Length float64 `json:"length"`
				Time   float64 `json:"time"`
			} `json:"summary"`
		}{
			Shape: "encoded_polyline_here",
		})
		resp.Trip.Legs[0].Summary.Length = 0.5
		resp.Trip.Legs[0].Summary.Time = 30

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer srv.Close()

	client := NewClient(srv.URL)
	result, err := client.TraceRoute(context.Background(), []ShapePoint{
		{Lat: 6.9271, Lon: 79.8612, Time: 1000},
		{Lat: 6.9285, Lon: 79.8620, Time: 1005},
		{Lat: 6.9301, Lon: 79.8635, Time: 1010},
	})

	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Len(t, result.Trip.MatchedPoints, 3)
	assert.Equal(t, "matched", result.Trip.MatchedPoints[0].Type)
	assert.InDelta(t, 6.9271, result.Trip.MatchedPoints[0].Lat, 0.001)
	assert.Len(t, result.Trip.Legs, 1)
	assert.InDelta(t, 0.5, result.Trip.Legs[0].Summary.Length, 0.01)
}

func TestTraceRoute_ServerError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(`{"error":"no matching edge found"}`))
	}))
	defer srv.Close()

	client := NewClient(srv.URL)
	result, err := client.TraceRoute(context.Background(), []ShapePoint{
		{Lat: 0.0, Lon: 0.0},
	})

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "trace_route status 500")
}

func TestTraceRoute_ConnectionRefused(t *testing.T) {
	client := NewClient("http://localhost:19999") // nothing listening
	result, err := client.TraceRoute(context.Background(), []ShapePoint{
		{Lat: 6.9, Lon: 79.8},
	})

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "trace_route request")
}

func TestTraceRoute_InvalidJSON(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{not valid json`))
	}))
	defer srv.Close()

	client := NewClient(srv.URL)
	result, err := client.TraceRoute(context.Background(), []ShapePoint{
		{Lat: 6.9, Lon: 79.8},
	})

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "decode trace response")
}

func TestTraceRoute_ContextCanceled(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// slow response — context will cancel first
		select {}
	}))
	defer srv.Close()

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // cancel immediately

	client := NewClient(srv.URL)
	result, err := client.TraceRoute(ctx, []ShapePoint{
		{Lat: 6.9, Lon: 79.8},
	})

	assert.Error(t, err)
	assert.Nil(t, result)
}

func TestRoute_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/route", r.URL.Path)

		var req RouteRequest
		require.NoError(t, json.NewDecoder(r.Body).Decode(&req))
		assert.Equal(t, "bus", req.Costing)
		assert.Len(t, req.Locations, 2)

		resp := RouteResponse{}
		resp.Trip.Legs = append(resp.Trip.Legs, struct {
			Shape   string `json:"shape"`
			Summary struct {
				Length float64 `json:"length"`
				Time   float64 `json:"time"`
			} `json:"summary"`
		}{
			Shape: "encoded_route_polyline",
		})
		resp.Trip.Legs[0].Summary.Length = 115.0
		resp.Trip.Legs[0].Summary.Time = 7200

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer srv.Close()

	client := NewClient(srv.URL)
	result, err := client.Route(context.Background(), []Location{
		{Lat: 6.9271, Lon: 79.8612},
		{Lat: 7.2906, Lon: 80.6337},
	})

	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Len(t, result.Trip.Legs, 1)
	assert.InDelta(t, 115.0, result.Trip.Legs[0].Summary.Length, 0.01)
}

func TestRoute_ServerError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte(`{"error":"insufficient number of locations"}`))
	}))
	defer srv.Close()

	client := NewClient(srv.URL)
	result, err := client.Route(context.Background(), []Location{})

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "route status 400")
}
