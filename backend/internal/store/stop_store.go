package store

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/masariya/backend/internal/model"
)

type StopStore struct {
	pool *pgxpool.Pool
}

func NewStopStore(pool *pgxpool.Pool) *StopStore {
	return &StopStore{pool: pool}
}

// GetByRoute returns all stops for a route, ordered by sequence.
func (s *StopStore) GetByRoute(ctx context.Context, routeID string) ([]model.Stop, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT s.id, s.name_en, COALESCE(s.name_si, ''), COALESCE(s.name_ta, ''),
		        ST_Y(s.location) as lat, ST_X(s.location) as lng,
		        COALESCE(s.source, ''), COALESCE(s.confidence, 0), COALESCE(s.observation_count, 0)
		 FROM stops s
		 JOIN route_stops rs ON s.id = rs.stop_id
		 WHERE rs.route_id = $1
		 ORDER BY rs.stop_order`, routeID)
	if err != nil {
		return nil, fmt.Errorf("get stops for route %s: %w", routeID, err)
	}
	defer rows.Close()

	var stops []model.Stop
	for rows.Next() {
		var stop model.Stop
		var lat, lng float64
		if err := rows.Scan(
			&stop.ID, &stop.NameEN, &stop.NameSI, &stop.NameTA,
			&lat, &lng, &stop.Source, &stop.Confidence, &stop.ObservationCount,
		); err != nil {
			return nil, fmt.Errorf("scan stop: %w", err)
		}
		stop.Location[0] = lng
		stop.Location[1] = lat
		stops = append(stops, stop)
	}
	return stops, rows.Err()
}

// ListNearby returns stops near a given point.
func (s *StopStore) ListNearby(ctx context.Context, lat, lng, radiusKM float64) ([]model.Stop, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, name_en, COALESCE(name_si, ''), COALESCE(name_ta, ''),
		        ST_Y(location) as lat, ST_X(location) as lng,
		        COALESCE(source, ''), COALESCE(confidence, 0), COALESCE(observation_count, 0)
		 FROM stops
		 WHERE ST_DWithin(location::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
		 ORDER BY ST_Distance(location::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography)
		 LIMIT 50`,
		lng, lat, radiusKM*1000)
	if err != nil {
		return nil, fmt.Errorf("list nearby stops: %w", err)
	}
	defer rows.Close()

	var stops []model.Stop
	for rows.Next() {
		var stop model.Stop
		var lat, lng float64
		if err := rows.Scan(
			&stop.ID, &stop.NameEN, &stop.NameSI, &stop.NameTA,
			&lat, &lng, &stop.Source, &stop.Confidence, &stop.ObservationCount,
		); err != nil {
			return nil, fmt.Errorf("scan nearby stop: %w", err)
		}
		stop.Location[0] = lng
		stop.Location[1] = lat
		stops = append(stops, stop)
	}
	return stops, rows.Err()
}
