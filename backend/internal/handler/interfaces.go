package handler

import (
	"context"

	"github.com/masariya/backend/internal/model"
	"github.com/paulmach/orb"
)

// GPSIngester abstracts GPS batch ingestion (implemented by pipeline.Ingester).
type GPSIngester interface {
	Ingest(ctx context.Context, batch model.GPSBatch) error
}

// TripSessionStore abstracts trip session persistence (implemented by store.TripStore).
type TripSessionStore interface {
	UpsertSession(ctx context.Context, batch model.GPSBatch) error
}

// RouteQuerier abstracts route database queries (implemented by store.RouteStore).
type RouteQuerier interface {
	GetAll(ctx context.Context) (map[string]orb.LineString, error)
	GetByID(ctx context.Context, id string) (*model.Route, error)
	GetPolyline(ctx context.Context, id string) ([][]float64, error)
	ListNearby(ctx context.Context, lat, lng, radiusKM float64) ([]model.Route, error)
	Search(ctx context.Context, query string, limit int) ([]model.Route, error)
}

// StopQuerier abstracts stop database queries (implemented by store.StopStore).
type StopQuerier interface {
	GetByRoute(ctx context.Context, routeID string) ([]model.Stop, error)
	ListNearby(ctx context.Context, lat, lng, radiusKM float64) ([]model.Stop, error)
}
