package store

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

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
	_, err := s.pool.Exec(ctx, `DELETE FROM routes WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete route: %w", err)
	}
	return nil
}

func (s *AdminStore) SetRouteActive(ctx context.Context, id string, isActive bool) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE routes SET is_active = $2, updated_at = NOW() WHERE id = $1`,
		id, isActive)
	if err != nil {
		return fmt.Errorf("set route active: %w", err)
	}
	return nil
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
		        (SELECT COUNT(*) FROM route_patterns WHERE route_id = r.id) AS pattern_count,
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
			&r.StopCount, &r.PatternCount, &r.HasPolyline,
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

// --- Route Detail ---

func (s *AdminStore) GetRouteDetail(ctx context.Context, routeID string) (*handler.AdminRouteDetail, error) {
	// 1. Get route basic info
	var detail handler.AdminRouteDetail
	var info handler.AdminRouteDetailInfo
	var validatedAt, createdAt, updatedAt *time.Time
	err := s.pool.QueryRow(ctx, `
		SELECT id, COALESCE(name_en,''), COALESCE(name_si,''), COALESCE(name_ta,''),
		       COALESCE(operator,''), COALESCE(service_type,''), COALESCE(fare_lkr,0),
		       COALESCE(frequency_minutes,0), COALESCE(operating_hours,''), is_active,
		       COALESCE(source,''), COALESCE(data_source,''),
		       COALESCE(validated_by,''), validated_at, created_at, updated_at
		FROM routes WHERE id = $1`, routeID).Scan(
		&info.ID, &info.NameEN, &info.NameSI, &info.NameTA,
		&info.Operator, &info.ServiceType, &info.FareLKR,
		&info.FrequencyMin, &info.OperatingHours, &info.IsActive,
		&info.Source, &info.DataSource, &info.ValidatedBy, &validatedAt,
		&createdAt, &updatedAt)
	if err != nil {
		return nil, fmt.Errorf("route not found: %w", err)
	}
	if validatedAt != nil {
		t := validatedAt.Format(time.RFC3339)
		info.ValidatedAt = &t
	}
	if createdAt != nil {
		info.CreatedAt = createdAt.Format(time.RFC3339)
	}
	if updatedAt != nil {
		info.UpdatedAt = updatedAt.Format(time.RFC3339)
	}
	detail.Route = info

	// 2. Get enriched stops
	rows, err := s.pool.Query(ctx, `
		SELECT rs.stop_id, rs.stop_order, s.name_en, COALESCE(s.name_si,''), COALESCE(s.name_ta,''),
		       ST_Y(s.location::geometry), ST_X(s.location::geometry),
		       COALESCE(rs.distance_from_start_km, 0), COALESCE(rs.typical_duration_min, 0),
		       COALESCE(rs.fare_from_start_lkr, 0), COALESCE(s.is_terminal, false)
		FROM route_stops rs JOIN stops s ON rs.stop_id = s.id
		WHERE rs.route_id = $1 ORDER BY rs.stop_order`, routeID)
	if err != nil {
		return nil, fmt.Errorf("get route stops: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var stop handler.AdminEnrichedStop
		if err := rows.Scan(&stop.StopID, &stop.StopOrder, &stop.NameEN, &stop.NameSI, &stop.NameTA,
			&stop.Lat, &stop.Lng, &stop.DistanceFromStart, &stop.DurationMin,
			&stop.FareFromStart, &stop.IsTerminal); err != nil {
			return nil, fmt.Errorf("scan stop: %w", err)
		}
		detail.Stops = append(detail.Stops, stop)
	}
	if detail.Stops == nil {
		detail.Stops = []handler.AdminEnrichedStop{}
	}

	// 3. Get route patterns
	patterns, err := s.GetRoutePatterns(ctx, routeID)
	if err != nil {
		return nil, fmt.Errorf("get patterns: %w", err)
	}
	detail.Patterns = patterns

	// 4. Get timetable entries
	timetable, err := s.GetTimetableEntries(ctx, routeID)
	if err != nil {
		return nil, fmt.Errorf("get timetable: %w", err)
	}
	detail.Timetable = timetable

	// 5. Get polyline
	var polylineJSON []byte
	err = s.pool.QueryRow(ctx, `
		SELECT ST_AsGeoJSON(polyline)::jsonb->'coordinates'
		FROM routes WHERE id = $1 AND polyline IS NOT NULL`, routeID).Scan(&polylineJSON)
	if err == nil && polylineJSON != nil {
		json.Unmarshal(polylineJSON, &detail.Polyline)
	}
	if detail.Polyline == nil {
		detail.Polyline = [][]float64{}
	}

	return &detail, nil
}

func (s *AdminStore) GetTimetableEntries(ctx context.Context, routeID string) ([]handler.AdminTimetable, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, route_id, departure_time::text, days, COALESCE(service_type,'Normal'), COALESCE(notes,'')
		FROM timetables WHERE route_id = $1 ORDER BY departure_time`, routeID)
	if err != nil {
		return nil, fmt.Errorf("query timetables: %w", err)
	}
	defer rows.Close()
	var entries []handler.AdminTimetable
	for rows.Next() {
		var e handler.AdminTimetable
		if err := rows.Scan(&e.ID, &e.RouteID, &e.DepartureTime, &e.Days, &e.ServiceType, &e.Notes); err != nil {
			return nil, fmt.Errorf("scan timetable: %w", err)
		}
		entries = append(entries, e)
	}
	if entries == nil {
		entries = []handler.AdminTimetable{}
	}
	return entries, nil
}

func (s *AdminStore) DeleteStop(ctx context.Context, id string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)
	// Remove from route_stops first
	_, err = tx.Exec(ctx, `DELETE FROM route_stops WHERE stop_id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete route_stops: %w", err)
	}
	// Delete the stop
	_, err = tx.Exec(ctx, `DELETE FROM stops WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete stop: %w", err)
	}
	return tx.Commit(ctx)
}

type StopListResult struct {
	Stops []handler.AdminStopView `json:"stops"`
	Total int                     `json:"total"`
}

func (s *AdminStore) ListStopsFiltered(ctx context.Context, search, source, sortBy, sortDir string, limit, offset int) (interface{}, error) {
	return s.listStopsFilteredInternal(ctx, search, source, sortBy, sortDir, limit, offset)
}

func (s *AdminStore) listStopsFilteredInternal(ctx context.Context, search, source, sortBy, sortDir string, limit, offset int) (*StopListResult, error) {
	if limit <= 0 {
		limit = 15
	}
	if limit > 100 {
		limit = 100
	}

	where := "WHERE 1=1"
	args := []interface{}{}
	n := 0

	if search != "" {
		n++
		where += fmt.Sprintf(" AND (name_en ILIKE $%d OR COALESCE(name_si,'') ILIKE $%d OR id ILIKE $%d)", n, n, n)
		args = append(args, "%"+search+"%")
	}
	if source != "" {
		n++
		where += fmt.Sprintf(" AND source = $%d", n)
		args = append(args, source)
	}

	var total int
	if err := s.pool.QueryRow(ctx, "SELECT COUNT(*) FROM stops "+where, args...).Scan(&total); err != nil {
		return nil, fmt.Errorf("count stops: %w", err)
	}

	sortCols := map[string]string{
		"name_en": "name_en", "source": "source", "confidence": "confidence",
		"observation_count": "observation_count", "created_at": "created_at",
	}
	sc := "created_at"
	if col, ok := sortCols[sortBy]; ok {
		sc = col
	}
	sd := "DESC"
	if sortDir == "asc" {
		sd = "ASC"
	}

	n++
	args = append(args, limit)
	n++
	args = append(args, offset)

	query := fmt.Sprintf(
		`SELECT id, name_en, COALESCE(name_si,''), COALESCE(name_ta,''),
		        ST_Y(location) AS lat, ST_X(location) AS lng,
		        source, confidence, observation_count, created_at
		 FROM stops %s ORDER BY %s %s LIMIT $%d OFFSET $%d`,
		where, sc, sd, n-1, n,
	)

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list stops: %w", err)
	}
	defer rows.Close()

	var stops []handler.AdminStopView
	for rows.Next() {
		var sv handler.AdminStopView
		if err := rows.Scan(&sv.ID, &sv.NameEN, &sv.NameSI, &sv.NameTA,
			&sv.Lat, &sv.Lng, &sv.Source, &sv.Confidence, &sv.ObservationCount, &sv.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan stop: %w", err)
		}
		stops = append(stops, sv)
	}
	if stops == nil {
		stops = []handler.AdminStopView{}
	}
	return &StopListResult{Stops: stops, Total: total}, nil
}

func (s *AdminStore) ListRoutesFiltered(ctx context.Context, filter handler.AdminRouteFilter) (*handler.AdminRouteListResponse, error) {
	// Build dynamic WHERE clause
	where := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1

	if filter.Query != "" {
		where = append(where, fmt.Sprintf("(r.id ILIKE $%d OR r.name_en ILIKE $%d)", argIdx, argIdx))
		args = append(args, "%"+filter.Query+"%")
		argIdx++
	}
	if filter.Operator != "" {
		where = append(where, fmt.Sprintf("r.operator = $%d", argIdx))
		args = append(args, filter.Operator)
		argIdx++
	}
	if filter.ServiceType != "" {
		where = append(where, fmt.Sprintf("r.service_type = $%d", argIdx))
		args = append(args, filter.ServiceType)
		argIdx++
	}
	if filter.IsActive == "true" {
		where = append(where, "r.is_active = TRUE")
	} else if filter.IsActive == "false" {
		where = append(where, "r.is_active = FALSE")
	}

	whereClause := strings.Join(where, " AND ")

	// Count total matching
	var totalCount int
	countSQL := fmt.Sprintf(`SELECT COUNT(*) FROM routes r WHERE %s`, whereClause)
	if err := s.pool.QueryRow(ctx, countSQL, args...).Scan(&totalCount); err != nil {
		return nil, fmt.Errorf("count routes: %w", err)
	}

	totalPages := (totalCount + filter.PerPage - 1) / filter.PerPage
	offset := (filter.Page - 1) * filter.PerPage

	// Sort
	sortColumns := map[string]string{
		"id": "r.id", "name_en": "r.name_en", "operator": "r.operator",
		"service_type": "r.service_type", "is_active": "r.is_active",
	}
	sortCol := "r.id"
	if col, ok := sortColumns[filter.SortBy]; ok {
		sortCol = col
	}
	sortDir := "ASC"
	if filter.SortDir == "desc" {
		sortDir = "DESC"
	}

	// Query with pagination
	querySQL := fmt.Sprintf(`
		SELECT r.id, r.name_en, COALESCE(r.name_si,''), COALESCE(r.name_ta,''),
		       COALESCE(r.operator,''), COALESCE(r.service_type,''), COALESCE(r.fare_lkr,0),
		       COALESCE(r.frequency_minutes,0), COALESCE(r.operating_hours,''),
		       r.is_active,
		       (SELECT COUNT(*) FROM route_stops WHERE route_id = r.id),
		       (SELECT COUNT(*) FROM route_patterns WHERE route_id = r.id),
		       (r.polyline IS NOT NULL),
		       COALESCE(os.name_en, ''), COALESCE(ds.name_en, '')
		FROM routes r
		LEFT JOIN stops os ON r.origin_stop_id = os.id
		LEFT JOIN stops ds ON r.destination_stop_id = ds.id
		WHERE %s
		ORDER BY %s %s
		LIMIT $%d OFFSET $%d`, whereClause, sortCol, sortDir, argIdx, argIdx+1)
	args = append(args, filter.PerPage, offset)

	rows, err := s.pool.Query(ctx, querySQL, args...)
	if err != nil {
		return nil, fmt.Errorf("query routes: %w", err)
	}
	defer rows.Close()

	var routes []handler.AdminRouteWithStats
	for rows.Next() {
		var r handler.AdminRouteWithStats
		if err := rows.Scan(&r.ID, &r.NameEN, &r.NameSI, &r.NameTA,
			&r.Operator, &r.ServiceType, &r.FareLKR, &r.FrequencyMinutes, &r.OperatingHours,
			&r.IsActive, &r.StopCount, &r.PatternCount, &r.HasPolyline,
			&r.OriginStopName, &r.DestStopName); err != nil {
			return nil, fmt.Errorf("scan route: %w", err)
		}
		routes = append(routes, r)
	}
	if routes == nil {
		routes = []handler.AdminRouteWithStats{}
	}

	return &handler.AdminRouteListResponse{
		Routes:     routes,
		Count:      totalCount,
		Page:       filter.Page,
		PerPage:    filter.PerPage,
		TotalPages: totalPages,
	}, nil
}

// --- Route Patterns ---

func (s *AdminStore) GetRoutePatterns(ctx context.Context, routeID string) ([]handler.AdminRoutePattern, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, route_id, headsign, direction, is_primary, stop_count, COALESCE(source,''), (polyline IS NOT NULL)
		FROM route_patterns WHERE route_id = $1 ORDER BY is_primary DESC, headsign`, routeID)
	if err != nil {
		return nil, fmt.Errorf("query route patterns: %w", err)
	}
	defer rows.Close()

	var patterns []handler.AdminRoutePattern
	for rows.Next() {
		var p handler.AdminRoutePattern
		if err := rows.Scan(&p.ID, &p.RouteID, &p.Headsign, &p.Direction, &p.IsPrimary, &p.StopCount, &p.Source, &p.HasPolyline); err != nil {
			return nil, fmt.Errorf("scan route pattern: %w", err)
		}
		patterns = append(patterns, p)
	}
	if patterns == nil {
		patterns = []handler.AdminRoutePattern{}
	}
	return patterns, rows.Err()
}

func (s *AdminStore) GetPatternStops(ctx context.Context, patternID string) ([]handler.AdminEnrichedStop, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT ps.stop_id, ps.stop_order, s.name_en, COALESCE(s.name_si,''), COALESCE(s.name_ta,''),
		       ST_Y(s.location::geometry), ST_X(s.location::geometry),
		       COALESCE(ps.distance_from_start_km, 0), COALESCE(ps.typical_duration_min, 0),
		       COALESCE(ps.fare_from_start_lkr, 0), COALESCE(s.is_terminal, false)
		FROM pattern_stops ps JOIN stops s ON ps.stop_id = s.id
		WHERE ps.pattern_id = $1 ORDER BY ps.stop_order`, patternID)
	if err != nil {
		return nil, fmt.Errorf("query pattern stops: %w", err)
	}
	defer rows.Close()

	var stops []handler.AdminEnrichedStop
	for rows.Next() {
		var stop handler.AdminEnrichedStop
		if err := rows.Scan(&stop.StopID, &stop.StopOrder, &stop.NameEN, &stop.NameSI, &stop.NameTA,
			&stop.Lat, &stop.Lng, &stop.DistanceFromStart, &stop.DurationMin,
			&stop.FareFromStart, &stop.IsTerminal); err != nil {
			return nil, fmt.Errorf("scan pattern stop: %w", err)
		}
		stops = append(stops, stop)
	}
	if stops == nil {
		stops = []handler.AdminEnrichedStop{}
	}
	return stops, rows.Err()
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
