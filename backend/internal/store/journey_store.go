package store

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/masariya/backend/internal/model"
)

type JourneyStore struct {
	pool *pgxpool.Pool
}

func NewJourneyStore(pool *pgxpool.Pool) *JourneyStore {
	return &JourneyStore{pool: pool}
}

// FindStopsByName searches for stops matching a query (fuzzy, trilingual).
func (s *JourneyStore) FindStopsByName(ctx context.Context, query string, limit int) ([]model.Stop, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, name_en, COALESCE(name_si,''), COALESCE(name_ta,''),
		        ST_Y(location) as lat, ST_X(location) as lng,
		        source, confidence, observation_count
		 FROM stops
		 WHERE name_en ILIKE '%' || $1 || '%'
		    OR COALESCE(name_si,'') ILIKE '%' || $1 || '%'
		    OR COALESCE(name_ta,'') ILIKE '%' || $1 || '%'
		 ORDER BY
		   CASE WHEN name_en ILIKE $1 THEN 0
		        WHEN name_en ILIKE $1 || '%' THEN 1
		        ELSE 2 END,
		   name_en
		 LIMIT $2`,
		query, limit)
	if err != nil {
		return nil, fmt.Errorf("find stops: %w", err)
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

// FindJourneys finds routes that pass through both the origin and destination stops
// in the correct order (origin stop_order < destination stop_order).
func (s *JourneyStore) FindJourneys(ctx context.Context, fromStopID, toStopID string) ([]model.JourneyResult, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT
		   r.id, r.name_en, r.name_si, r.name_ta, r.operator, r.service_type,
		   r.fare_lkr, r.frequency_minutes, r.is_active,
		   -- Board stop info
		   rs_from.stop_order as board_order,
		   rs_from.distance_from_start_km as board_dist,
		   COALESCE(rs_from.typical_duration_min, 0) as board_duration,
		   COALESCE(rs_from.fare_from_start_lkr, 0) as board_fare,
		   s_from.name_en as board_name_en,
		   COALESCE(s_from.name_si,'') as board_name_si,
		   ST_Y(s_from.location) as board_lat, ST_X(s_from.location) as board_lng,
		   -- Exit stop info
		   rs_to.stop_order as exit_order,
		   rs_to.distance_from_start_km as exit_dist,
		   COALESCE(rs_to.typical_duration_min, 0) as exit_duration,
		   COALESCE(rs_to.fare_from_start_lkr, 0) as exit_fare,
		   s_to.name_en as exit_name_en,
		   COALESCE(s_to.name_si,'') as exit_name_si,
		   ST_Y(s_to.location) as exit_lat, ST_X(s_to.location) as exit_lng
		 FROM route_stops rs_from
		 JOIN route_stops rs_to ON rs_from.route_id = rs_to.route_id
		   AND rs_to.stop_order > rs_from.stop_order
		 JOIN routes r ON r.id = rs_from.route_id AND r.is_active = true
		 JOIN stops s_from ON s_from.id = rs_from.stop_id
		 JOIN stops s_to ON s_to.id = rs_to.stop_id
		 WHERE rs_from.stop_id = $1
		   AND rs_to.stop_id = $2
		 ORDER BY
		   (rs_to.stop_order - rs_from.stop_order) ASC,
		   COALESCE(rs_to.typical_duration_min - rs_from.typical_duration_min, 999) ASC`,
		fromStopID, toStopID)
	if err != nil {
		return nil, fmt.Errorf("find journeys: %w", err)
	}
	defer rows.Close()

	var results []model.JourneyResult
	for rows.Next() {
		var j model.JourneyResult
		var boardDist, exitDist *float64
		if err := rows.Scan(
			&j.Route.ID, &j.Route.NameEN, &j.Route.NameSI, &j.Route.NameTA,
			&j.Route.Operator, &j.Route.ServiceType,
			&j.Route.FareLKR, &j.Route.FrequencyMinutes, &j.Route.IsActive,
			// Board
			&j.BoardStop.StopOrder, &boardDist,
			&j.BoardStop.TypicalDurationMin, &j.BoardStop.FareFromStartLKR,
			&j.BoardStop.StopNameEN, &j.BoardStop.StopNameSI,
			&j.BoardStop.StopLat, &j.BoardStop.StopLng,
			// Exit
			&j.ExitStop.StopOrder, &exitDist,
			&j.ExitStop.TypicalDurationMin, &j.ExitStop.FareFromStartLKR,
			&j.ExitStop.StopNameEN, &j.ExitStop.StopNameSI,
			&j.ExitStop.StopLat, &j.ExitStop.StopLng,
		); err != nil {
			return nil, fmt.Errorf("scan journey: %w", err)
		}

		if boardDist != nil {
			j.BoardStop.DistanceFromStartKM = *boardDist
		}
		if exitDist != nil {
			j.ExitStop.DistanceFromStartKM = *exitDist
		}

		j.StopsBetween = j.ExitStop.StopOrder - j.BoardStop.StopOrder - 1
		j.DurationMin = j.ExitStop.TypicalDurationMin - j.BoardStop.TypicalDurationMin
		j.FareLKR = j.ExitStop.FareFromStartLKR - j.BoardStop.FareFromStartLKR

		results = append(results, j)
	}
	return results, rows.Err()
}

// GetRouteStops returns all stops for a route with enriched data (timing, fares).
func (s *JourneyStore) GetRouteStops(ctx context.Context, routeID string) ([]model.EnrichedRouteStop, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT rs.route_id, rs.stop_id, rs.stop_order,
		        rs.distance_from_start_km,
		        COALESCE(rs.typical_duration_min, 0),
		        COALESCE(rs.fare_from_start_lkr, 0),
		        s.name_en, COALESCE(s.name_si,''), COALESCE(s.name_ta,''),
		        ST_Y(s.location), ST_X(s.location),
		        COALESCE(s.is_terminal, false)
		 FROM route_stops rs
		 JOIN stops s ON s.id = rs.stop_id
		 WHERE rs.route_id = $1
		 ORDER BY rs.stop_order`,
		routeID)
	if err != nil {
		return nil, fmt.Errorf("get route stops: %w", err)
	}
	defer rows.Close()

	var stops []model.EnrichedRouteStop
	for rows.Next() {
		var s model.EnrichedRouteStop
		var dist *float64
		if err := rows.Scan(
			&s.RouteID, &s.StopID, &s.StopOrder,
			&dist, &s.TypicalDurationMin, &s.FareFromStartLKR,
			&s.StopNameEN, &s.StopNameSI, &s.StopNameTA,
			&s.StopLat, &s.StopLng, &s.IsTerminal,
		); err != nil {
			return nil, fmt.Errorf("scan route stop: %w", err)
		}
		if dist != nil {
			s.DistanceFromStartKM = *dist
		}
		stops = append(stops, s)
	}
	return stops, rows.Err()
}
