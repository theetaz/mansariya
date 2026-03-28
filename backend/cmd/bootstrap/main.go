// bootstrap loads NTC route data into the database.
//
// Usage:
//
//	go run ./cmd/bootstrap -data routes.json
//
// The routes.json file should contain an array of route definitions.
// Each route has: id, name_en, name_si, name_ta, operator, service_type,
// fare_lkr, and an ordered list of stop names.
//
// For each route, the bootstrap script:
// 1. Geocodes each stop name via Nominatim (Sri Lanka)
// 2. Routes between consecutive stops via Valhalla (bus costing)
// 3. Inserts route + stops + polyline into PostGIS
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type RawRoute struct {
	ID          string          `json:"id"`
	NameEN      string          `json:"name_en"`
	NameSI      string          `json:"name_si"`
	NameTA      string          `json:"name_ta"`
	Operator    string          `json:"operator"`
	ServiceType string          `json:"service_type"`
	FareLKR     int             `json:"fare_lkr"`
	Frequency   int             `json:"frequency_minutes"`
	Hours       string          `json:"operating_hours"`
	Stops       []string        `json:"stops"`       // ordered stop names in English
	StopCoords  []StopCoordJSON `json:"stop_coords"` // pre-geocoded GPS coords (optional)
}

type StopCoordJSON struct {
	Name string  `json:"name"`
	Lat  float64 `json:"lat"`
	Lng  float64 `json:"lng"`
}

type GeocodedStop struct {
	Name string
	Lat  float64
	Lng  float64
}

type OSMStop struct {
	OSMID  int64   `json:"osm_id"`
	Name   string  `json:"name"`
	NameEN string  `json:"name_en"`
	NameSI string  `json:"name_si"`
	NameTA string  `json:"name_ta"`
	Lat    float64 `json:"lat"`
	Lng    float64 `json:"lng"`
}

type TimetableFile map[string]TimetableRouteData

type TimetableRouteData struct {
	RouteID string           `json:"route_id"`
	Entries []TimetableEntry `json:"entries"`
}

type TimetableEntry struct {
	RouteID       string            `json:"route_id"`
	DepartureTime string            `json:"departure_time"`
	ServiceType   string            `json:"service_type"`
	StopTimes     map[string]string `json:"stop_times"`
}

func main() {
	dataFile := flag.String("data", "data/routes.json", "Path to routes JSON file")
	dbURL := flag.String("db", "", "Database URL (or set DATABASE_URL env)")
	nominatimURL := flag.String("nominatim", "", "Nominatim base URL (or set NOMINATIM_URL env)")
	osrmBaseURL := flag.String("osrm", "", "OSRM base URL (or set OSRM_URL env)")
	dryRun := flag.Bool("dry-run", false, "Show pre-flight report only, don't insert")
	skipEmpty := flag.Bool("skip-empty", true, "Skip routes with no name_en AND no stops")
	osmStopsFile := flag.String("osm-stops", "", "Path to OSM bus stops JSON file to seed")
	timetablesFile := flag.String("timetables", "", "Path to timetables JSON file to seed")
	flag.Parse()

	if *dbURL == "" {
		*dbURL = os.Getenv("DATABASE_URL")
	}
	if *dbURL == "" {
		slog.Error("DATABASE_URL required")
		os.Exit(1)
	}
	if *nominatimURL == "" {
		*nominatimURL = os.Getenv("NOMINATIM_URL")
	}
	if *nominatimURL == "" {
		*nominatimURL = "https://nominatim.openstreetmap.org"
	}
	if *osrmBaseURL == "" {
		*osrmBaseURL = os.Getenv("OSRM_URL")
	}
	if *osrmBaseURL == "" {
		*osrmBaseURL = "https://router.project-osrm.org"
	}

	ctx := context.Background()

	// Pre-flight: check Nominatim is reachable
	if err := checkService(*nominatimURL+"/status", "Nominatim"); err != nil {
		slog.Error("Nominatim is not reachable",
			"url", *nominatimURL,
			"error", err,
		)
		fmt.Fprintf(os.Stderr, "\n  Nominatim is required for geocoding bus stops.\n\n")
		fmt.Fprintf(os.Stderr, "  Options:\n")
		fmt.Fprintf(os.Stderr, "    1. Start local Nominatim:  make nominatim-up  (first run takes ~10 min)\n")
		fmt.Fprintf(os.Stderr, "    2. Use public Nominatim:   -nominatim https://nominatim.openstreetmap.org\n\n")
		os.Exit(1)
	}

	// Pre-flight: check database is reachable
	testPool, err := pgxpool.New(ctx, *dbURL)
	if err != nil {
		slog.Error("database is not reachable",
			"url", *dbURL,
			"error", err,
		)
		fmt.Fprintf(os.Stderr, "\n  PostgreSQL is required. Start it with:  make infra-up\n\n")
		os.Exit(1)
	}
	testPool.Close()

	slog.Info("pre-flight checks passed", "nominatim", *nominatimURL, "osrm", *osrmBaseURL)

	// Load route data
	raw, err := os.ReadFile(*dataFile)
	if err != nil {
		slog.Error("read data file", "path", *dataFile, "error", err)
		os.Exit(1)
	}

	var routes []RawRoute
	if err := json.Unmarshal(raw, &routes); err != nil {
		slog.Error("parse routes", "error", err)
		os.Exit(1)
	}

	slog.Info("loaded route definitions", "count", len(routes))

	// Connect to DB
	pool, err := pgxpool.New(ctx, *dbURL)
	if err != nil {
		slog.Error("connect db", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	// Analyze route data for the report
	routesWithNames := 0
	routesWithStops := 0
	routesWithStopCoords := 0
	for _, r := range routes {
		if r.NameEN != "" {
			routesWithNames++
		}
		if len(r.Stops) >= 2 {
			routesWithStops++
		}
		if len(r.StopCoords) >= 2 {
			routesWithStopCoords++
		}
	}

	// Load optional data files for reporting
	osmStopCount := 0
	osmStopLabel := "not provided"
	if *osmStopsFile != "" {
		osmData, osmErr := os.ReadFile(*osmStopsFile)
		if osmErr != nil {
			slog.Error("read OSM stops file", "path", *osmStopsFile, "error", osmErr)
			os.Exit(1)
		}
		var osmStops []OSMStop
		if osmErr := json.Unmarshal(osmData, &osmStops); osmErr != nil {
			slog.Error("parse OSM stops", "error", osmErr)
			os.Exit(1)
		}
		osmStopCount = len(osmStops)
		osmStopLabel = fmt.Sprintf("%d stops", osmStopCount)
	}

	timetableEntryCount := 0
	timetableLabel := "not provided"
	if *timetablesFile != "" {
		ttData, ttErr := os.ReadFile(*timetablesFile)
		if ttErr != nil {
			slog.Error("read timetables file", "path", *timetablesFile, "error", ttErr)
			os.Exit(1)
		}
		var ttFile TimetableFile
		if ttErr := json.Unmarshal(ttData, &ttFile); ttErr != nil {
			slog.Error("parse timetables", "error", ttErr)
			os.Exit(1)
		}
		for _, rd := range ttFile {
			timetableEntryCount += len(rd.Entries)
		}
		timetableLabel = fmt.Sprintf("%d entries", timetableEntryCount)
	}

	// Query database state
	var existingRoutes, existingStops, existingTimetables int
	_ = pool.QueryRow(ctx, "SELECT COUNT(*) FROM routes").Scan(&existingRoutes)
	_ = pool.QueryRow(ctx, "SELECT COUNT(*) FROM stops").Scan(&existingStops)
	_ = pool.QueryRow(ctx, "SELECT COUNT(*) FROM timetables").Scan(&existingTimetables)

	// Count routes that will be filtered
	routesToSkip := 0
	if *skipEmpty {
		for _, r := range routes {
			if r.NameEN == "" && len(r.Stops) < 2 && len(r.StopCoords) < 2 {
				routesToSkip++
			}
		}
	}
	routesToInsert := len(routes) - routesToSkip

	// ANSI colors
	const (
		green = "\033[32m"
		cyan  = "\033[36m"
		bold  = "\033[1m"
		dim   = "\033[2m"
		reset = "\033[0m"
	)

	// Print pre-flight report
	fmt.Fprintf(os.Stdout, "\n  %s━━━ Mansariya Seed — Pre-flight Report ━━━%s\n\n", bold, reset)
	fmt.Fprintf(os.Stdout, "  %sDependencies:%s\n", bold, reset)
	fmt.Fprintf(os.Stdout, "    %s✓%s PostgreSQL          reachable\n", green, reset)
	fmt.Fprintf(os.Stdout, "    %s✓%s Nominatim           reachable at %s\n", green, reset, *nominatimURL)
	fmt.Fprintf(os.Stdout, "    %s✓%s OSRM                %s\n", green, reset, *osrmBaseURL)
	fmt.Fprintf(os.Stdout, "\n  %sData Files:%s\n", bold, reset)
	fmt.Fprintf(os.Stdout, "    Routes:     %s%d%s total, %s%d%s with names, %s%d%s with stops, %s%d%s with stop_coords\n",
		cyan, len(routes), reset, cyan, routesWithNames, reset, cyan, routesWithStops, reset, cyan, routesWithStopCoords, reset)
	fmt.Fprintf(os.Stdout, "    OSM Stops:  %s%s%s\n", cyan, osmStopLabel, reset)
	fmt.Fprintf(os.Stdout, "    Timetables: %s%s%s\n", cyan, timetableLabel, reset)
	fmt.Fprintf(os.Stdout, "\n  %sDatabase State:%s\n", bold, reset)
	fmt.Fprintf(os.Stdout, "    Routes:     %s%d%s existing\n", cyan, existingRoutes, reset)
	fmt.Fprintf(os.Stdout, "    Stops:      %s%d%s existing\n", cyan, existingStops, reset)
	fmt.Fprintf(os.Stdout, "    Timetables: %s%d%s existing\n", cyan, existingTimetables, reset)
	fmt.Fprintf(os.Stdout, "\n  %sPlan:%s\n", bold, reset)
	fmt.Fprintf(os.Stdout, "    Routes to insert:  %s%d%s %s(after filtering empty)%s\n", cyan, routesToInsert, reset, dim, reset)
	fmt.Fprintf(os.Stdout, "    Routes to skip:    %s%d%s %s(empty/incomplete)%s\n\n", cyan, routesToSkip, reset, dim, reset)

	if *dryRun {
		slog.Info("dry-run mode — exiting without changes")
		os.Exit(0)
	}

	// Filter empty routes if --skip-empty is true
	if *skipEmpty {
		originalLen := len(routes)
		filtered := make([]RawRoute, 0, len(routes))
		for _, r := range routes {
			if r.NameEN != "" || len(r.Stops) >= 2 || len(r.StopCoords) >= 2 {
				filtered = append(filtered, r)
			}
		}
		routes = filtered
		slog.Info("filtered empty routes", "before", originalLen, "after", len(routes), "removed", originalLen-len(routes))
	}

	// Seed OSM bus stops before route processing
	if *osmStopsFile != "" {
		osmInserted, osmErr := seedOSMStops(ctx, pool, *osmStopsFile)
		if osmErr != nil {
			slog.Error("seed OSM stops", "error", osmErr)
			os.Exit(1)
		}
		slog.Info("OSM stops seeded", "inserted", osmInserted)
	}

	inserted := 0
	skipped := 0

	for i, route := range routes {
		slog.Info("processing route",
			"index", i+1,
			"total", len(routes),
			"id", route.ID,
			"name", route.NameEN,
			"stops", len(route.Stops),
		)

		// Use pre-geocoded coords if available, otherwise geocode via Nominatim
		var geocoded []GeocodedStop
		if len(route.StopCoords) >= 2 {
			for _, sc := range route.StopCoords {
				geocoded = append(geocoded, GeocodedStop{Name: sc.Name, Lat: sc.Lat, Lng: sc.Lng})
			}
			slog.Info("using pre-geocoded stop coords", "route", route.ID, "stops", len(geocoded))
		} else {
			geocoded = geocodeStops(route.Stops, *nominatimURL)
		}
		if len(geocoded) < 2 {
			slog.Warn("insufficient geocoded stops, skipping", "route", route.ID, "geocoded", len(geocoded))
			skipped++
			continue
		}

		// Build road-snapped polyline using OSRM routing service
		coords := buildRoadSnappedPolyline(geocoded, *osrmBaseURL)

		err := insertRoute(ctx, pool, route, geocoded, coords)
		if err != nil {
			slog.Error("insert route", "id", route.ID, "error", err)
			skipped++
			continue
		}
		inserted++
	}

	// Seed timetables after route processing
	if *timetablesFile != "" {
		ttInserted, ttErr := seedTimetables(ctx, pool, *timetablesFile)
		if ttErr != nil {
			slog.Error("seed timetables", "error", ttErr)
			os.Exit(1)
		}
		slog.Info("timetables seeded", "inserted", ttInserted)
	}

	slog.Info("bootstrap complete",
		"inserted", inserted,
		"skipped", skipped,
		"total", len(routes),
	)
}

// buildRoadSnappedPolyline uses OSRM to get a road-following route between stops.
// Falls back to straight lines if OSRM is unavailable.
func buildRoadSnappedPolyline(stops []GeocodedStop, osrmBase string) [][2]float64 {
	if len(stops) < 2 {
		coords := make([][2]float64, len(stops))
		for i, s := range stops {
			coords[i] = [2]float64{s.Lng, s.Lat}
		}
		return coords
	}

	// Build OSRM coordinates string: lng,lat;lng,lat;...
	coordParts := make([]string, len(stops))
	for i, s := range stops {
		coordParts[i] = fmt.Sprintf("%f,%f", s.Lng, s.Lat)
	}
	coordStr := strings.Join(coordParts, ";")

	// Call OSRM route API
	osrmURL := fmt.Sprintf("%s/route/v1/driving/%s?overview=full&geometries=geojson", osrmBase, coordStr)

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Get(osrmURL)
	if err != nil {
		slog.Warn("OSRM routing failed, using straight lines", "error", err)
		return straightLineCoords(stops)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		slog.Warn("OSRM returned non-200", "status", resp.StatusCode)
		return straightLineCoords(stops)
	}

	var osrmResp struct {
		Routes []struct {
			Geometry struct {
				Coordinates [][]float64 `json:"coordinates"`
			} `json:"geometry"`
		} `json:"routes"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&osrmResp); err != nil {
		slog.Warn("OSRM decode failed", "error", err)
		return straightLineCoords(stops)
	}

	if len(osrmResp.Routes) == 0 || len(osrmResp.Routes[0].Geometry.Coordinates) < 2 {
		return straightLineCoords(stops)
	}

	// Convert [lng, lat] to [2]float64
	osrmCoords := osrmResp.Routes[0].Geometry.Coordinates
	result := make([][2]float64, len(osrmCoords))
	for i, c := range osrmCoords {
		result[i] = [2]float64{c[0], c[1]} // [lng, lat]
	}

	slog.Debug("road-snapped route", "stops", len(stops), "points", len(result))
	return result
}

func straightLineCoords(stops []GeocodedStop) [][2]float64 {
	coords := make([][2]float64, len(stops))
	for i, s := range stops {
		coords[i] = [2]float64{s.Lng, s.Lat}
	}
	return coords
}

func geocodeStops(stopNames []string, nominatimURL string) []GeocodedStop {
	var results []GeocodedStop
	client := &http.Client{Timeout: 10 * time.Second}

	for _, name := range stopNames {
		query := name + ", Sri Lanka"
		reqURL := fmt.Sprintf("%s/search?q=%s&format=json&countrycodes=lk&limit=1",
			nominatimURL, url.QueryEscape(query))

		req, _ := http.NewRequest(http.MethodGet, reqURL, nil)
		req.Header.Set("User-Agent", "Mansariya/1.0 (bus-tracker)")

		resp, err := client.Do(req)
		if err != nil {
			slog.Warn("geocode failed", "stop", name, "error", err)
			continue
		}

		var geocodeResults []struct {
			Lat string `json:"lat"`
			Lon string `json:"lon"`
		}
		json.NewDecoder(resp.Body).Decode(&geocodeResults)
		resp.Body.Close()

		if len(geocodeResults) > 0 {
			var lat, lng float64
			fmt.Sscanf(geocodeResults[0].Lat, "%f", &lat)
			fmt.Sscanf(geocodeResults[0].Lon, "%f", &lng)
			results = append(results, GeocodedStop{Name: name, Lat: lat, Lng: lng})
			slog.Debug("geocoded", "stop", name, "lat", lat, "lng", lng)
		} else {
			slog.Warn("geocode no results", "stop", name)
		}

		// Rate limit: 1 req/sec for public Nominatim
		if !strings.HasPrefix(nominatimURL, "http://localhost") {
			time.Sleep(time.Second)
		}
	}

	return results
}

func insertRoute(ctx context.Context, pool *pgxpool.Pool, route RawRoute, stops []GeocodedStop, coords [][2]float64) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Build WKT LineString
	points := make([]string, len(coords))
	for i, c := range coords {
		points[i] = fmt.Sprintf("%f %f", c[0], c[1])
	}
	lineWKT := "LINESTRING(" + strings.Join(points, ", ") + ")"

	// Upsert route
	_, err = tx.Exec(ctx,
		`INSERT INTO routes (id, name_en, name_si, name_ta, operator, service_type, fare_lkr, frequency_minutes, operating_hours, polyline, polyline_confidence, source)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, ST_GeomFromText($10, 4326), 0.1, 'bootstrap')
		 ON CONFLICT (id) DO UPDATE SET
		   name_en = EXCLUDED.name_en, name_si = EXCLUDED.name_si, name_ta = EXCLUDED.name_ta,
		   polyline = EXCLUDED.polyline, updated_at = NOW()`,
		route.ID, route.NameEN, route.NameSI, route.NameTA,
		route.Operator, route.ServiceType, route.FareLKR,
		route.Frequency, route.Hours, lineWKT)
	if err != nil {
		return fmt.Errorf("insert route: %w", err)
	}

	// Insert stops and route_stops
	for i, stop := range stops {
		stopID := fmt.Sprintf("%s_s%d", route.ID, i)
		pointWKT := fmt.Sprintf("POINT(%f %f)", stop.Lng, stop.Lat)

		_, err = tx.Exec(ctx,
			`INSERT INTO stops (id, name_en, location, source)
			 VALUES ($1, $2, ST_GeomFromText($3, 4326), 'bootstrap')
			 ON CONFLICT (id) DO NOTHING`,
			stopID, stop.Name, pointWKT)
		if err != nil {
			return fmt.Errorf("insert stop %s: %w", stop.Name, err)
		}

		_, err = tx.Exec(ctx,
			`INSERT INTO route_stops (route_id, stop_id, stop_order)
			 VALUES ($1, $2, $3)
			 ON CONFLICT DO NOTHING`,
			route.ID, stopID, i)
		if err != nil {
			return fmt.Errorf("insert route_stop: %w", err)
		}
	}

	return tx.Commit(ctx)
}

func checkService(url, name string) error {
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return err
	}
	resp.Body.Close()
	if resp.StatusCode >= 500 {
		return fmt.Errorf("%s returned status %d", name, resp.StatusCode)
	}
	return nil
}

func seedOSMStops(ctx context.Context, pool *pgxpool.Pool, filePath string) (int, error) {
	raw, err := os.ReadFile(filePath)
	if err != nil {
		return 0, fmt.Errorf("read OSM stops file: %w", err)
	}

	var stops []OSMStop
	if err := json.Unmarshal(raw, &stops); err != nil {
		return 0, fmt.Errorf("parse OSM stops: %w", err)
	}

	totalInserted := 0
	batchSize := 500

	for i := 0; i < len(stops); i += batchSize {
		end := i + batchSize
		if end > len(stops) {
			end = len(stops)
		}
		batch := stops[i:end]

		tx, err := pool.Begin(ctx)
		if err != nil {
			return totalInserted, fmt.Errorf("begin transaction: %w", err)
		}

		batchInserted := 0
		for _, s := range batch {
			stopID := fmt.Sprintf("osm_%d", s.OSMID)
			pointWKT := fmt.Sprintf("POINT(%f %f)", s.Lng, s.Lat)

			nameEN := s.NameEN
			if nameEN == "" {
				nameEN = s.Name
			}

			tag, err := tx.Exec(ctx,
				`INSERT INTO stops (id, name_en, name_si, name_ta, location, source)
				 VALUES ($1, $2, $3, $4, ST_GeomFromText($5, 4326), 'osm')
				 ON CONFLICT (id) DO NOTHING`,
				stopID, nameEN, s.NameSI, s.NameTA, pointWKT)
			if err != nil {
				_ = tx.Rollback(ctx)
				return totalInserted, fmt.Errorf("insert OSM stop %d: %w", s.OSMID, err)
			}
			batchInserted += int(tag.RowsAffected())
		}

		if err := tx.Commit(ctx); err != nil {
			return totalInserted, fmt.Errorf("commit OSM batch: %w", err)
		}
		totalInserted += batchInserted
		slog.Debug("OSM stops batch committed", "batch", i/batchSize+1, "inserted", batchInserted)
	}

	return totalInserted, nil
}

func seedTimetables(ctx context.Context, pool *pgxpool.Pool, filePath string) (int, error) {
	raw, err := os.ReadFile(filePath)
	if err != nil {
		return 0, fmt.Errorf("read timetables file: %w", err)
	}

	var ttFile TimetableFile
	if err := json.Unmarshal(raw, &ttFile); err != nil {
		return 0, fmt.Errorf("parse timetables: %w", err)
	}

	allDays := []string{"MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"}
	totalInserted := 0

	for _, routeData := range ttFile {
		// Check if the route exists in the database
		var exists bool
		err := pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM routes WHERE id = $1)", routeData.RouteID).Scan(&exists)
		if err != nil {
			return totalInserted, fmt.Errorf("check route %s: %w", routeData.RouteID, err)
		}
		if !exists {
			slog.Warn("timetable route not found, skipping", "route_id", routeData.RouteID)
			continue
		}

		tx, err := pool.Begin(ctx)
		if err != nil {
			return totalInserted, fmt.Errorf("begin transaction: %w", err)
		}

		for _, entry := range routeData.Entries {
			depTime := normalizeTime(entry.DepartureTime)
			serviceType := entry.ServiceType
			if serviceType == "" {
				serviceType = "Normal"
			}

			tag, err := tx.Exec(ctx,
				`INSERT INTO timetables (route_id, departure_time, days, service_type)
				 VALUES ($1, $2::time, $3, $4)
				 ON CONFLICT DO NOTHING`,
				routeData.RouteID, depTime, allDays, serviceType)
			if err != nil {
				_ = tx.Rollback(ctx)
				return totalInserted, fmt.Errorf("insert timetable for route %s at %s: %w", routeData.RouteID, depTime, err)
			}
			totalInserted += int(tag.RowsAffected())
		}

		if err := tx.Commit(ctx); err != nil {
			return totalInserted, fmt.Errorf("commit timetable batch for route %s: %w", routeData.RouteID, err)
		}
	}

	return totalInserted, nil
}

// normalizeTime pads times like "3:00" to "03:00" for proper TIME parsing.
func normalizeTime(t string) string {
	parts := strings.SplitN(t, ":", 2)
	if len(parts) != 2 {
		return t
	}
	hour := parts[0]
	if len(hour) == 1 {
		hour = "0" + hour
	}
	return hour + ":" + parts[1]
}
