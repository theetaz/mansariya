package store

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/masariya/backend/internal/model"
	"github.com/paulmach/orb"
)

// DiscoveredStopStore persists crowdsource-discovered bus stop candidates.
type DiscoveredStopStore struct {
	pool *pgxpool.Pool
}

func NewDiscoveredStopStore(pool *pgxpool.Pool) *DiscoveredStopStore {
	return &DiscoveredStopStore{pool: pool}
}

// Upsert inserts a new discovered stop or increments its observation count if one
// already exists within 30m of the given location.
func (s *DiscoveredStopStore) Upsert(ctx context.Context, ds model.DiscoveredStop) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO discovered_stops (id, location, observation_count, avg_dwell_seconds, nearest_route_ids, status, first_seen, last_seen)
		 VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326), $4, $5, $6, $7, $8, $9)
		 ON CONFLICT (id) DO UPDATE SET
		     observation_count = discovered_stops.observation_count + EXCLUDED.observation_count,
		     avg_dwell_seconds = (discovered_stops.avg_dwell_seconds * discovered_stops.observation_count + EXCLUDED.avg_dwell_seconds * EXCLUDED.observation_count)
		                         / (discovered_stops.observation_count + EXCLUDED.observation_count),
		     nearest_route_ids = (
		         SELECT array_agg(DISTINCT route_id)
		         FROM unnest(discovered_stops.nearest_route_ids || EXCLUDED.nearest_route_ids) AS route_id
		     ),
		     last_seen = EXCLUDED.last_seen`,
		ds.ID, ds.Location[0], ds.Location[1],
		ds.ObservationCount, ds.AvgDwellSeconds, ds.NearestRouteIDs,
		ds.Status, ds.FirstSeen, ds.LastSeen,
	)
	if err != nil {
		return fmt.Errorf("upsert discovered stop: %w", err)
	}
	return nil
}

// FindNearby returns discovered stops within radiusMeters of (lat, lng).
func (s *DiscoveredStopStore) FindNearby(ctx context.Context, lat, lng, radiusMeters float64) ([]model.DiscoveredStop, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, ST_Y(location) as lat, ST_X(location) as lng,
		        observation_count, avg_dwell_seconds, nearest_route_ids,
		        status, COALESCE(promoted_to_stop_id, ''), first_seen, last_seen
		 FROM discovered_stops
		 WHERE ST_DWithin(location::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
		 ORDER BY ST_Distance(location::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography)`,
		lng, lat, radiusMeters,
	)
	if err != nil {
		return nil, fmt.Errorf("find nearby discovered stops: %w", err)
	}
	defer rows.Close()

	var stops []model.DiscoveredStop
	for rows.Next() {
		var ds model.DiscoveredStop
		var lat, lng float64
		if err := rows.Scan(
			&ds.ID, &lat, &lng,
			&ds.ObservationCount, &ds.AvgDwellSeconds, &ds.NearestRouteIDs,
			&ds.Status, &ds.PromotedToStopID, &ds.FirstSeen, &ds.LastSeen,
		); err != nil {
			return nil, fmt.Errorf("scan discovered stop: %w", err)
		}
		ds.Location = orb.Point{lng, lat}
		stops = append(stops, ds)
	}
	return stops, rows.Err()
}
