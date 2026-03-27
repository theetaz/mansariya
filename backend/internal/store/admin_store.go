package store

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/masariya/backend/internal/handler"
)

type AdminStore struct {
	pool *pgxpool.Pool
}

func NewAdminStore(pool *pgxpool.Pool) *AdminStore {
	return &AdminStore{pool: pool}
}

// --- Route CRUD ---

func (s *AdminStore) CreateRoute(ctx context.Context, input handler.AdminRouteInput) (string, error) {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO routes (id, name_en, name_si, name_ta, operator, service_type, fare_lkr, frequency_minutes, operating_hours, data_source, is_active)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)`,
		input.ID, input.NameEN, input.NameSI, input.NameTA,
		input.Operator, input.ServiceType, input.FareLKR,
		input.FrequencyMinutes, input.OperatingHours,
		coalesce(input.DataSource, "admin"))
	if err != nil {
		return "", fmt.Errorf("create route: %w", err)
	}
	return input.ID, nil
}

func (s *AdminStore) UpdateRoute(ctx context.Context, id string, input handler.AdminRouteInput) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE routes SET
		   name_en = COALESCE(NULLIF($2,''), name_en),
		   name_si = COALESCE(NULLIF($3,''), name_si),
		   name_ta = COALESCE(NULLIF($4,''), name_ta),
		   operator = COALESCE(NULLIF($5,''), operator),
		   service_type = COALESCE(NULLIF($6,''), service_type),
		   fare_lkr = CASE WHEN $7 > 0 THEN $7 ELSE fare_lkr END,
		   frequency_minutes = CASE WHEN $8 > 0 THEN $8 ELSE frequency_minutes END,
		   operating_hours = COALESCE(NULLIF($9,''), operating_hours),
		   updated_at = NOW()
		 WHERE id = $1`,
		id, input.NameEN, input.NameSI, input.NameTA,
		input.Operator, input.ServiceType, input.FareLKR,
		input.FrequencyMinutes, input.OperatingHours)
	if err != nil {
		return fmt.Errorf("update route: %w", err)
	}
	return nil
}

func (s *AdminStore) DeleteRoute(ctx context.Context, id string) error {
	_, err := s.pool.Exec(ctx, `UPDATE routes SET is_active = false, updated_at = NOW() WHERE id = $1`, id)
	return err
}

func (s *AdminStore) ValidateRoute(ctx context.Context, id string, validatedBy string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE routes SET validated_by = $2, validated_at = NOW(), updated_at = NOW() WHERE id = $1`,
		id, validatedBy)
	return err
}

// --- Stop CRUD ---

func (s *AdminStore) CreateStop(ctx context.Context, input handler.AdminStopInput) (string, error) {
	id := input.ID
	if id == "" {
		id = slugify(input.NameEN)
	}

	_, err := s.pool.Exec(ctx,
		`INSERT INTO stops (id, name_en, name_si, name_ta, location, road_name, landmark, is_terminal, source)
		 VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326), $7, $8, $9, 'admin')
		 ON CONFLICT (id) DO UPDATE SET
		   name_en = EXCLUDED.name_en, name_si = EXCLUDED.name_si, name_ta = EXCLUDED.name_ta,
		   location = EXCLUDED.location, road_name = EXCLUDED.road_name, landmark = EXCLUDED.landmark,
		   is_terminal = EXCLUDED.is_terminal`,
		id, input.NameEN, input.NameSI, input.NameTA,
		input.Lng, input.Lat, input.RoadName, input.Landmark, input.Terminal)
	if err != nil {
		return "", fmt.Errorf("create stop: %w", err)
	}
	return id, nil
}

func (s *AdminStore) UpdateStop(ctx context.Context, id string, input handler.AdminStopInput) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE stops SET
		   name_en = COALESCE(NULLIF($2,''), name_en),
		   name_si = COALESCE(NULLIF($3,''), name_si),
		   name_ta = COALESCE(NULLIF($4,''), name_ta),
		   location = CASE WHEN $5 != 0 THEN ST_SetSRID(ST_MakePoint($6, $5), 4326) ELSE location END,
		   road_name = COALESCE(NULLIF($7,''), road_name),
		   landmark = COALESCE(NULLIF($8,''), landmark),
		   is_terminal = $9
		 WHERE id = $1`,
		id, input.NameEN, input.NameSI, input.NameTA,
		input.Lat, input.Lng, input.RoadName, input.Landmark, input.Terminal)
	return err
}

// --- Route Stops ---

func (s *AdminStore) SetRouteStops(ctx context.Context, routeID string, stops []handler.AdminRouteStopInput) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Remove existing route_stops
	_, err = tx.Exec(ctx, `DELETE FROM route_stops WHERE route_id = $1`, routeID)
	if err != nil {
		return fmt.Errorf("clear route stops: %w", err)
	}

	// Insert new ones
	for _, stop := range stops {
		_, err = tx.Exec(ctx,
			`INSERT INTO route_stops (route_id, stop_id, stop_order, distance_from_start_km, typical_duration_min, fare_from_start_lkr)
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			routeID, stop.StopID, stop.StopOrder,
			stop.DistanceFromStartKM, stop.TypicalDurationMin, stop.FareFromStartLKR)
		if err != nil {
			return fmt.Errorf("insert route stop %d: %w", stop.StopOrder, err)
		}
	}

	// Update origin/destination on route
	if len(stops) >= 2 {
		_, _ = tx.Exec(ctx,
			`UPDATE routes SET origin_stop_id = $2, destination_stop_id = $3, updated_at = NOW() WHERE id = $1`,
			routeID, stops[0].StopID, stops[len(stops)-1].StopID)
	}

	return tx.Commit(ctx)
}

// --- Timetable ---

func (s *AdminStore) AddTimetableEntry(ctx context.Context, entry handler.AdminTimetableInput) error {
	days := "{" + strings.Join(entry.Days, ",") + "}"
	_, err := s.pool.Exec(ctx,
		`INSERT INTO timetables (route_id, departure_time, days, service_type, notes)
		 VALUES ($1, $2::time, $3::text[], $4, $5)`,
		entry.RouteID, entry.DepartureTime, days,
		coalesce(entry.ServiceType, "Normal"), entry.Notes)
	return err
}

func (s *AdminStore) DeleteTimetableEntries(ctx context.Context, routeID string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM timetables WHERE route_id = $1`, routeID)
	return err
}

// --- Dashboard queries ---

func (s *AdminStore) ListRoutesWithStats(ctx context.Context) ([]handler.AdminRouteWithStats, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT r.id,
		        COALESCE(r.name_en, ''),
		        COALESCE(r.name_si, ''),
		        COALESCE(r.name_ta, ''),
		        COALESCE(r.operator, ''),
		        COALESCE(r.service_type, ''),
		        COALESCE(r.fare_lkr, 0),
		        COALESCE(r.frequency_minutes, 0),
		        COALESCE(r.operating_hours, ''),
		        r.is_active,
		        COUNT(rs.stop_id) AS stop_count,
		        (r.polyline IS NOT NULL) AS has_polyline
		 FROM routes r
		 LEFT JOIN route_stops rs ON r.id = rs.route_id
		 GROUP BY r.id
		 ORDER BY r.id`)
	if err != nil {
		return nil, fmt.Errorf("list routes with stats: %w", err)
	}
	defer rows.Close()

	var routes []handler.AdminRouteWithStats
	for rows.Next() {
		var r handler.AdminRouteWithStats
		if err := rows.Scan(
			&r.ID, &r.NameEN, &r.NameSI, &r.NameTA,
			&r.Operator, &r.ServiceType, &r.FareLKR,
			&r.FrequencyMinutes, &r.OperatingHours, &r.IsActive,
			&r.StopCount, &r.HasPolyline,
		); err != nil {
			return nil, fmt.Errorf("scan route with stats: %w", err)
		}
		routes = append(routes, r)
	}
	return routes, rows.Err()
}

func (s *AdminStore) GetDashboardStats(ctx context.Context) (*handler.DashboardStats, error) {
	stats := &handler.DashboardStats{}

	err := s.pool.QueryRow(ctx,
		`SELECT
		    (SELECT COUNT(*) FROM routes),
		    (SELECT COUNT(*) FROM stops),
		    (SELECT COUNT(*) FROM routes WHERE is_active = true),
		    (SELECT COUNT(DISTINCT rs.route_id) FROM route_stops rs),
		    (SELECT COUNT(*) FROM routes WHERE polyline IS NOT NULL),
		    (SELECT COUNT(DISTINCT route_id) FROM timetables)`).Scan(
		&stats.TotalRoutes,
		&stats.TotalStops,
		&stats.ActiveRoutes,
		&stats.RoutesWithStops,
		&stats.RoutesWithPolyline,
		&stats.RoutesWithTimetable,
	)
	if err != nil {
		return nil, fmt.Errorf("get dashboard stats: %w", err)
	}
	return stats, nil
}

func (s *AdminStore) UpdateRoutePolyline(ctx context.Context, routeID string, coordinates [][]float64, confidence float64) error {
	// Build WKT LINESTRING from coordinates
	points := make([]string, len(coordinates))
	for i, coord := range coordinates {
		if len(coord) < 2 {
			return fmt.Errorf("coordinate at index %d must have at least 2 values", i)
		}
		points[i] = fmt.Sprintf("%f %f", coord[0], coord[1])
	}
	wkt := "LINESTRING(" + strings.Join(points, ", ") + ")"

	_, err := s.pool.Exec(ctx,
		`UPDATE routes
		 SET polyline = ST_GeomFromText($2, 4326),
		     polyline_confidence = $3,
		     updated_at = NOW()
		 WHERE id = $1`,
		routeID, wkt, confidence)
	if err != nil {
		return fmt.Errorf("update route polyline: %w", err)
	}
	return nil
}

func coalesce(val, fallback string) string {
	if val == "" {
		return fallback
	}
	return val
}

func slugify(name string) string {
	s := strings.ToLower(name)
	s = strings.ReplaceAll(s, " ", "-")
	s = strings.ReplaceAll(s, "'", "")
	return s
}
