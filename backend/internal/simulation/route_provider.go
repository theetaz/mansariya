package simulation

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

type DBRouteProvider struct {
	pool *pgxpool.Pool
}

func NewDBRouteProvider(pool *pgxpool.Pool) *DBRouteProvider {
	return &DBRouteProvider{pool: pool}
}

func (p *DBRouteProvider) GetPolyline(ctx context.Context, routeID string) ([][2]float64, error) {
	var geoJSON string
	err := p.pool.QueryRow(ctx,
		`SELECT ST_AsGeoJSON(polyline) FROM routes WHERE id = $1 AND polyline IS NOT NULL`, routeID,
	).Scan(&geoJSON)
	if err != nil {
		return nil, fmt.Errorf("get polyline for route %s: %w", routeID, err)
	}

	var geom struct {
		Coordinates [][2]float64 `json:"coordinates"`
	}
	if err := json.Unmarshal([]byte(geoJSON), &geom); err != nil {
		return nil, fmt.Errorf("unmarshal polyline geojson: %w", err)
	}
	return geom.Coordinates, nil
}

func (p *DBRouteProvider) GetStopDistances(ctx context.Context, routeID string) ([]float64, error) {
	polyline, err := p.GetPolyline(ctx, routeID)
	if err != nil {
		return nil, err
	}
	cumDists := polylineSegmentDistances(polyline)

	rows, err := p.pool.Query(ctx,
		`SELECT ST_Y(s.location::geometry), ST_X(s.location::geometry)
		 FROM route_stops rs
		 JOIN stops s ON s.id = rs.stop_id
		 WHERE rs.route_id = $1
		 ORDER BY rs.stop_order`, routeID)
	if err != nil {
		return nil, fmt.Errorf("get stops for route %s: %w", routeID, err)
	}
	defer rows.Close()

	var stopDists []float64
	for rows.Next() {
		var lat, lng float64
		if err := rows.Scan(&lat, &lng); err != nil {
			return nil, fmt.Errorf("scan stop: %w", err)
		}
		dist := findNearestDistanceOnPolyline(polyline, cumDists, lat, lng)
		stopDists = append(stopDists, dist)
	}
	return stopDists, nil
}
