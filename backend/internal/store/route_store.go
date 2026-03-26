package store

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/masariya/backend/internal/model"
	"github.com/paulmach/orb"
	"github.com/paulmach/orb/encoding/wkb"
)

type RouteStore struct {
	pool *pgxpool.Pool
}

func NewRouteStore(pool *pgxpool.Pool) *RouteStore {
	return &RouteStore{pool: pool}
}

// GetAll returns all active routes with polylines (for loading into the spatial index).
func (s *RouteStore) GetAll(ctx context.Context) (map[string]orb.LineString, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, ST_AsBinary(polyline) FROM routes WHERE is_active = true AND polyline IS NOT NULL`)
	if err != nil {
		return nil, fmt.Errorf("query routes: %w", err)
	}
	defer rows.Close()

	routes := make(map[string]orb.LineString)
	for rows.Next() {
		var id string
		var geomBytes []byte
		if err := rows.Scan(&id, &geomBytes); err != nil {
			return nil, fmt.Errorf("scan route: %w", err)
		}

		geom, err := wkb.Unmarshal(geomBytes)
		if err != nil {
			continue // skip invalid geometries
		}

		if line, ok := geom.(orb.LineString); ok {
			routes[id] = line
		}
	}
	return routes, rows.Err()
}

// GetByID returns a single route with full details.
func (s *RouteStore) GetByID(ctx context.Context, id string) (*model.Route, error) {
	route := &model.Route{}
	var geomBytes []byte

	err := s.pool.QueryRow(ctx,
		`SELECT id, name_en, name_si, name_ta, operator, service_type,
		        fare_lkr, frequency_minutes, operating_hours,
		        ST_AsBinary(polyline), polyline_confidence, source, is_active,
		        created_at, updated_at
		 FROM routes WHERE id = $1`, id).Scan(
		&route.ID, &route.NameEN, &route.NameSI, &route.NameTA,
		&route.Operator, &route.ServiceType, &route.FareLKR,
		&route.FrequencyMinutes, &route.OperatingHours,
		&geomBytes, &route.PolylineConfidence, &route.Source, &route.IsActive,
		&route.CreatedAt, &route.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("get route %s: %w", id, err)
	}

	if geomBytes != nil {
		geom, err := wkb.Unmarshal(geomBytes)
		if err == nil {
			if line, ok := geom.(orb.LineString); ok {
				route.Polyline = line
			}
		}
	}

	return route, nil
}

// ListNearby returns routes whose polyline passes near the given point.
func (s *RouteStore) ListNearby(ctx context.Context, lat, lng, radiusKM float64) ([]model.Route, error) {
	// ST_DWithin uses meters for geography type, so convert km to meters
	rows, err := s.pool.Query(ctx,
		`SELECT id, name_en, name_si, name_ta, operator, service_type,
		        fare_lkr, frequency_minutes, is_active
		 FROM routes
		 WHERE is_active = true
		   AND ST_DWithin(polyline::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
		 ORDER BY ST_Distance(polyline::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography)
		 LIMIT 50`,
		lng, lat, radiusKM*1000)
	if err != nil {
		return nil, fmt.Errorf("list nearby routes: %w", err)
	}
	defer rows.Close()

	var routes []model.Route
	for rows.Next() {
		var r model.Route
		if err := rows.Scan(
			&r.ID, &r.NameEN, &r.NameSI, &r.NameTA,
			&r.Operator, &r.ServiceType, &r.FareLKR,
			&r.FrequencyMinutes, &r.IsActive,
		); err != nil {
			return nil, fmt.Errorf("scan nearby route: %w", err)
		}
		routes = append(routes, r)
	}
	return routes, rows.Err()
}

// Search performs trilingual fuzzy text search on route names.
func (s *RouteStore) Search(ctx context.Context, query string, limit int) ([]model.Route, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, name_en, name_si, name_ta, operator, service_type,
		        fare_lkr, frequency_minutes, is_active
		 FROM routes
		 WHERE is_active = true
		   AND (name_en ILIKE '%' || $1 || '%'
		        OR name_si ILIKE '%' || $1 || '%'
		        OR name_ta ILIKE '%' || $1 || '%'
		        OR id ILIKE '%' || $1 || '%')
		 ORDER BY similarity(name_en, $1) DESC
		 LIMIT $2`,
		query, limit)
	if err != nil {
		return nil, fmt.Errorf("search routes: %w", err)
	}
	defer rows.Close()

	var routes []model.Route
	for rows.Next() {
		var r model.Route
		if err := rows.Scan(
			&r.ID, &r.NameEN, &r.NameSI, &r.NameTA,
			&r.Operator, &r.ServiceType, &r.FareLKR,
			&r.FrequencyMinutes, &r.IsActive,
		); err != nil {
			return nil, fmt.Errorf("scan search route: %w", err)
		}
		routes = append(routes, r)
	}
	return routes, rows.Err()
}
