package store

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/masariya/backend/internal/model"
)

type TripStore struct {
	pool *pgxpool.Pool
}

func NewTripStore(pool *pgxpool.Pool) *TripStore {
	return &TripStore{pool: pool}
}

// UpsertSession inserts or updates a trip session record for the given GPS batch.
// On conflict (same session_id), it increments ping_count and updates metadata fields
// if new values are provided.
func (s *TripStore) UpsertSession(ctx context.Context, batch model.GPSBatch) error {
	hasMeta := batch.RouteID != "" || batch.BusNumber != "" || batch.CrowdLevel > 0

	_, err := s.pool.Exec(ctx,
		`INSERT INTO trip_sessions (device_hash, session_id, route_id, bus_number, crowd_level, ping_count, has_metadata)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 ON CONFLICT (session_id) DO UPDATE SET
		   ping_count = trip_sessions.ping_count + $6,
		   route_id = COALESCE(NULLIF($3, ''), trip_sessions.route_id),
		   bus_number = COALESCE(NULLIF($4, ''), trip_sessions.bus_number),
		   crowd_level = CASE WHEN $5 > 0 THEN $5 ELSE trip_sessions.crowd_level END,
		   has_metadata = trip_sessions.has_metadata OR $7`,
		batch.DeviceHash, batch.SessionID, batch.RouteID, batch.BusNumber,
		batch.CrowdLevel, len(batch.Pings), hasMeta,
	)
	if err != nil {
		return fmt.Errorf("upsert trip session: %w", err)
	}
	return nil
}

// GetHistoricalSpeed returns the average speed for a route segment at a given hour.
// Falls back to overall average if no data for the specific hour.
func (s *TripStore) GetHistoricalSpeed(ctx context.Context, routeID, fromStopID, toStopID string, hourOfDay int) (float64, error) {
	var speed float64

	// Try hour-specific first
	err := s.pool.QueryRow(ctx,
		`SELECT AVG(speed_kmh)
		 FROM trip_segments
		 WHERE route_id = $1 AND from_stop_id = $2 AND to_stop_id = $3 AND hour_of_day = $4
		 HAVING COUNT(*) >= 5`,
		routeID, fromStopID, toStopID, hourOfDay).Scan(&speed)

	if err == nil && speed > 0 {
		return speed, nil
	}

	// Fall back to overall average for this segment
	err = s.pool.QueryRow(ctx,
		`SELECT AVG(speed_kmh)
		 FROM trip_segments
		 WHERE route_id = $1 AND from_stop_id = $2 AND to_stop_id = $3
		 HAVING COUNT(*) >= 3`,
		routeID, fromStopID, toStopID).Scan(&speed)

	if err != nil {
		return 0, fmt.Errorf("get historical speed: %w", err)
	}
	return speed, nil
}

// RecordSegment stores a trip segment observation for ETA learning.
func (s *TripStore) RecordSegment(ctx context.Context, routeID, fromStopID, toStopID string, travelTimeSec int, speedKMH float64, hourOfDay, dayOfWeek int) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO trip_segments (route_id, from_stop_id, to_stop_id, travel_time_seconds, speed_kmh, hour_of_day, day_of_week)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		routeID, fromStopID, toStopID, travelTimeSec, speedKMH, hourOfDay, dayOfWeek)
	if err != nil {
		return fmt.Errorf("record segment: %w", err)
	}
	return nil
}
