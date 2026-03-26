package valhalla

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Client wraps HTTP calls to the Valhalla routing/map-matching service.
type Client struct {
	baseURL    string
	httpClient *http.Client
}

func NewClient(baseURL string) *Client {
	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// TraceRouteRequest is the input to Valhalla's trace_route (map matching).
type TraceRouteRequest struct {
	Shape      []ShapePoint `json:"shape"`
	Costing    string       `json:"costing"`
	ShapeMatch string       `json:"shape_match"`
}

type ShapePoint struct {
	Lat  float64 `json:"lat"`
	Lon  float64 `json:"lon"`
	Time int64   `json:"time,omitempty"`
}

// TraceRouteResponse is the output of Valhalla's trace_route.
type TraceRouteResponse struct {
	Trip struct {
		Legs []struct {
			Shape   string `json:"shape"` // encoded polyline
			Summary struct {
				Length float64 `json:"length"` // km
				Time   float64 `json:"time"`   // seconds
			} `json:"summary"`
		} `json:"legs"`
		MatchedPoints []MatchedPointResult `json:"matched_points,omitempty"`
	} `json:"trip"`
}

type MatchedPointResult struct {
	Lat           float64 `json:"lat"`
	Lon           float64 `json:"lon"`
	Type          string  `json:"type"` // "matched" or "interpolated"
	EdgeIndex     int     `json:"edge_index"`
	DistFromTrace float64 `json:"distance_from_trace_point"`
}

// TraceRoute snaps a GPS trace to the road network (map matching).
func (c *Client) TraceRoute(ctx context.Context, points []ShapePoint) (*TraceRouteResponse, error) {
	req := TraceRouteRequest{
		Shape:      points,
		Costing:    "bus",
		ShapeMatch: "map_snap",
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal trace request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/trace_route", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("trace_route request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("trace_route status %d: %s", resp.StatusCode, string(respBody))
	}

	var result TraceRouteResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode trace response: %w", err)
	}

	return &result, nil
}

// RouteRequest is input for Valhalla's route endpoint (directions between locations).
type RouteRequest struct {
	Locations         []Location `json:"locations"`
	Costing           string     `json:"costing"`
	DirectionsOptions struct {
		Units string `json:"units"`
	} `json:"directions_options"`
}

type Location struct {
	Lat float64 `json:"lat"`
	Lon float64 `json:"lon"`
}

// RouteResponse from Valhalla route endpoint.
type RouteResponse struct {
	Trip struct {
		Legs []struct {
			Shape   string `json:"shape"`
			Summary struct {
				Length float64 `json:"length"`
				Time   float64 `json:"time"`
			} `json:"summary"`
		} `json:"legs"`
	} `json:"trip"`
}

// Route computes a route between locations using Valhalla.
func (c *Client) Route(ctx context.Context, locations []Location) (*RouteResponse, error) {
	req := RouteRequest{
		Locations: locations,
		Costing:   "bus",
	}
	req.DirectionsOptions.Units = "km"

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal route request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/route", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("route request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("route status %d: %s", resp.StatusCode, string(respBody))
	}

	var result RouteResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode route response: %w", err)
	}

	return &result, nil
}
