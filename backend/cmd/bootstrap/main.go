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
	ID          string   `json:"id"`
	NameEN      string   `json:"name_en"`
	NameSI      string   `json:"name_si"`
	NameTA      string   `json:"name_ta"`
	Operator    string   `json:"operator"`
	ServiceType string   `json:"service_type"`
	FareLKR     int      `json:"fare_lkr"`
	Frequency   int      `json:"frequency_minutes"`
	Hours       string   `json:"operating_hours"`
	Stops       []string `json:"stops"` // ordered stop names in English
}

type GeocodedStop struct {
	Name string
	Lat  float64
	Lng  float64
}

func main() {
	dataFile := flag.String("data", "data/routes.json", "Path to routes JSON file")
	dbURL := flag.String("db", "", "Database URL (or set DATABASE_URL env)")
	nominatimURL := flag.String("nominatim", "https://nominatim.openstreetmap.org", "Nominatim base URL")
	flag.Parse()

	if *dbURL == "" {
		*dbURL = os.Getenv("DATABASE_URL")
	}
	if *dbURL == "" {
		slog.Error("DATABASE_URL required")
		os.Exit(1)
	}

	ctx := context.Background()

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

		// Geocode stops
		geocoded := geocodeStops(route.Stops, *nominatimURL)
		if len(geocoded) < 2 {
			slog.Warn("insufficient geocoded stops, skipping", "route", route.ID, "geocoded", len(geocoded))
			skipped++
			continue
		}

		// Build road-snapped polyline using OSRM routing service
		coords := buildRoadSnappedPolyline(geocoded)

		err := insertRoute(ctx, pool, route, geocoded, coords)
		if err != nil {
			slog.Error("insert route", "id", route.ID, "error", err)
			skipped++
			continue
		}
		inserted++
	}

	slog.Info("bootstrap complete",
		"inserted", inserted,
		"skipped", skipped,
		"total", len(routes),
	)
}

// buildRoadSnappedPolyline uses OSRM to get a road-following route between stops.
// Falls back to straight lines if OSRM is unavailable.
func buildRoadSnappedPolyline(stops []GeocodedStop) [][2]float64 {
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
	osrmURL := fmt.Sprintf("https://router.project-osrm.org/route/v1/driving/%s?overview=full&geometries=geojson", coordStr)

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
