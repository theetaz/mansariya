// GPS Simulator: mimics real mobile devices pushing GPS data to the backend.
//
// Usage:
//   go run ./cmd/simulator -api http://localhost:8000 -buses 3 -routes 1,2,138
//
// This generates realistic GPS traces along the specified routes and POSTs
// them to the backend's /api/v1/gps/batch endpoint, just like real phones would.
// Useful for testing the full pipeline and seeing buses move on the map.
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log/slog"
	"math"
	"math/rand"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"time"
)

type GPSPing struct {
	Lat       float64 `json:"lat"`
	Lng       float64 `json:"lng"`
	Timestamp int64   `json:"ts"`
	Accuracy  float64 `json:"acc"`
	Speed     float64 `json:"spd"`
	Bearing   float64 `json:"brg"`
}

type GPSBatch struct {
	DeviceHash string    `json:"device_hash"`
	SessionID  string    `json:"session_id"`
	Pings      []GPSPing `json:"pings"`
}

// Known route polylines (approximate, for simulation)
var routePolylines = map[string][][2]float64{
	"1": { // Colombo → Kandy
		{6.9271, 79.8612}, {6.9350, 79.8800}, {6.9500, 79.9000},
		{6.9600, 79.9200}, {6.9800, 79.9500}, {7.0000, 79.9800},
		{7.0200, 80.0200}, {7.0500, 80.1000}, {7.0800, 80.1500},
		{7.1000, 80.2000}, {7.1200, 80.2500}, {7.1500, 80.3500},
		{7.1800, 80.4000}, {7.2200, 80.5000}, {7.2500, 80.5500},
		{7.2700, 80.6000}, {7.2906, 80.6337},
	},
	"2": { // Colombo → Galle
		{6.9271, 79.8612}, {6.9100, 79.8550}, {6.8900, 79.8500},
		{6.8500, 79.8600}, {6.8200, 79.8650}, {6.7800, 79.8700},
		{6.7000, 79.8800}, {6.6000, 79.9000}, {6.5000, 79.9500},
		{6.4000, 80.0000}, {6.3000, 80.0500}, {6.2000, 80.1000},
		{6.1000, 80.1500}, {6.0535, 80.2210},
	},
	"138": { // Colombo → Kurunegala
		{6.9271, 79.8612}, {6.9500, 79.8800}, {6.9800, 79.9000},
		{7.0000, 79.9200}, {7.0500, 79.9500}, {7.1000, 79.9800},
		{7.1500, 80.0500}, {7.2000, 80.1500}, {7.2500, 80.2500},
		{7.3000, 80.3000}, {7.3500, 80.3500}, {7.4500, 80.3500},
	},
	"100": { // Colombo Fort → Kaduwela
		{6.9271, 79.8612}, {6.9300, 79.8700}, {6.9350, 79.8800},
		{6.9200, 79.8900}, {6.9100, 79.9000}, {6.9050, 79.9200},
		{6.9000, 79.9400}, {6.8950, 79.9600},
	},
	"103": { // Colombo Fort → Moratuwa
		{6.9271, 79.8612}, {6.9150, 79.8560}, {6.9000, 79.8530},
		{6.8800, 79.8600}, {6.8600, 79.8620}, {6.8400, 79.8630},
		{6.8200, 79.8620}, {6.7950, 79.8630},
	},
	"120": { // Colombo → Negombo
		{6.9271, 79.8612}, {6.9500, 79.8700}, {6.9700, 79.8650},
		{6.9800, 79.8600}, {7.0000, 79.8500}, {7.0300, 79.8400},
		{7.0700, 79.8350}, {7.1000, 79.8400}, {7.1700, 79.8400},
		{7.2090, 79.8384},
	},
}

func main() {
	apiURL := flag.String("api", "http://localhost:8000", "Backend API URL")
	busCount := flag.Int("buses", 3, "Number of simulated buses per route")
	routeList := flag.String("routes", "1,2,138", "Comma-separated route IDs to simulate")
	speedKMH := flag.Float64("speed", 35, "Average bus speed in km/h")
	intervalSec := flag.Int("interval", 5, "GPS ping interval in seconds")
	noiseDeg := flag.Float64("noise", 0.0002, "GPS noise in degrees (~20m)")
	flag.Parse()

	routes := strings.Split(*routeList, ",")
	for i := range routes {
		routes[i] = strings.TrimSpace(routes[i])
	}

	slog.Info("GPS Simulator starting",
		"api", *apiURL,
		"buses_per_route", *busCount,
		"routes", routes,
		"speed_kmh", *speedKMH,
	)

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt)
	defer cancel()

	var wg sync.WaitGroup

	for _, routeID := range routes {
		polyline, ok := routePolylines[routeID]
		if !ok {
			slog.Warn("unknown route, skipping", "route", routeID)
			continue
		}

		for i := 0; i < *busCount; i++ {
			wg.Add(1)
			go func(rid string, busIdx int, poly [][2]float64) {
				defer wg.Done()
				simulateBus(ctx, *apiURL, rid, busIdx, poly, *speedKMH, *intervalSec, *noiseDeg)
			}(routeID, i, polyline)
		}
	}

	wg.Wait()
	slog.Info("Simulator stopped")
}

func simulateBus(ctx context.Context, apiURL, routeID string, busIdx int, polyline [][2]float64, speedKMH float64, intervalSec int, noiseDeg float64) {
	rng := rand.New(rand.NewSource(time.Now().UnixNano() + int64(busIdx*1000)))
	deviceHash := fmt.Sprintf("sim_%s_bus%d_%s", routeID, busIdx, randomHex(rng, 8))
	sessionID := fmt.Sprintf("sess_%s_%d", deviceHash, time.Now().Unix())

	slog.Info("bus started",
		"route", routeID,
		"bus", busIdx,
		"device", deviceHash[:16],
		"stops", len(polyline),
	)

	// Start at a random position along the route (not all buses start at the beginning)
	startIdx := rng.Intn(len(polyline) / 2)
	direction := 1 // 1 = forward, -1 = reverse

	currentIdx := startIdx
	progress := 0.0 // progress within current segment (0.0 to 1.0)

	client := &http.Client{Timeout: 10 * time.Second}
	ticker := time.NewTicker(time.Duration(intervalSec) * time.Second)
	defer ticker.Stop()

	batchBuffer := make([]GPSPing, 0, 10)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			// Interpolate position between polyline points
			nextIdx := currentIdx + direction
			if nextIdx >= len(polyline) || nextIdx < 0 {
				direction *= -1 // reverse at endpoints
				nextIdx = currentIdx + direction
				if nextIdx >= len(polyline) || nextIdx < 0 {
					continue
				}
			}

			lat := polyline[currentIdx][0] + progress*(polyline[nextIdx][0]-polyline[currentIdx][0])
			lng := polyline[currentIdx][1] + progress*(polyline[nextIdx][1]-polyline[currentIdx][1])

			// Add GPS noise
			lat += (rng.Float64()*2 - 1) * noiseDeg
			lng += (rng.Float64()*2 - 1) * noiseDeg

			// Compute bearing
			bearing := computeBearing(polyline[currentIdx][0], polyline[currentIdx][1],
				polyline[nextIdx][0], polyline[nextIdx][1])

			ping := GPSPing{
				Lat:       lat,
				Lng:       lng,
				Timestamp: time.Now().Unix(),
				Accuracy:  8 + rng.Float64()*12,
				Speed:     (speedKMH / 3.6) * (0.8 + rng.Float64()*0.4),
				Bearing:   bearing + (rng.Float64()*10 - 5),
			}

			batchBuffer = append(batchBuffer, ping)

			// Advance position
			// Approximate: each segment covers ~2-5km, bus moves ~0.05-0.1 per tick at 35km/h
			segmentLenKM := haversine(polyline[currentIdx][0], polyline[currentIdx][1],
				polyline[nextIdx][0], polyline[nextIdx][1])
			if segmentLenKM > 0 {
				advanceKM := (speedKMH / 3600.0) * float64(intervalSec)
				progress += advanceKM / segmentLenKM
			}

			if progress >= 1.0 {
				currentIdx = nextIdx
				progress = 0.0
			}

			// Send batch every 10 seconds (2 pings per batch at 5s interval)
			if len(batchBuffer) >= 2 {
				batch := GPSBatch{
					DeviceHash: deviceHash,
					SessionID:  sessionID,
					Pings:      batchBuffer,
				}
				go sendBatch(client, apiURL, batch, routeID, busIdx)
				batchBuffer = make([]GPSPing, 0, 10)
			}
		}
	}
}

func sendBatch(client *http.Client, apiURL string, batch GPSBatch, routeID string, busIdx int) {
	body, err := json.Marshal(batch)
	if err != nil {
		return
	}

	resp, err := client.Post(apiURL+"/api/v1/gps/batch", "application/json", bytes.NewReader(body))
	if err != nil {
		slog.Debug("send failed", "route", routeID, "bus", busIdx, "error", err)
		return
	}
	resp.Body.Close()

	if resp.StatusCode == 200 {
		slog.Debug("batch sent",
			"route", routeID,
			"bus", busIdx,
			"pings", len(batch.Pings),
			"lat", fmt.Sprintf("%.4f", batch.Pings[0].Lat),
			"lng", fmt.Sprintf("%.4f", batch.Pings[0].Lng),
		)
	}
}

func haversine(lat1, lng1, lat2, lng2 float64) float64 {
	const R = 6371.0
	dLat := (lat2 - lat1) * math.Pi / 180
	dLng := (lng2 - lng1) * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*
			math.Sin(dLng/2)*math.Sin(dLng/2)
	return R * 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
}

func computeBearing(lat1, lng1, lat2, lng2 float64) float64 {
	dLng := (lng2 - lng1) * math.Pi / 180
	lat1R := lat1 * math.Pi / 180
	lat2R := lat2 * math.Pi / 180
	y := math.Sin(dLng) * math.Cos(lat2R)
	x := math.Cos(lat1R)*math.Sin(lat2R) - math.Sin(lat1R)*math.Cos(lat2R)*math.Cos(dLng)
	bearing := math.Atan2(y, x) * 180 / math.Pi
	return math.Mod(bearing+360, 360)
}

func randomHex(rng *rand.Rand, n int) string {
	const chars = "abcdef0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = chars[rng.Intn(len(chars))]
	}
	return string(b)
}
