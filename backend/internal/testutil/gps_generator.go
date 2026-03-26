package testutil

import (
	"math"
	"math/rand"
	"time"

	"github.com/masariya/backend/internal/model"
	"github.com/masariya/backend/internal/spatial"
	"github.com/paulmach/orb"
)

// GPSTraceConfig controls synthetic trace generation.
type GPSTraceConfig struct {
	// NoiseDeg is the maximum random offset in degrees (~0.0003 = 30m)
	NoiseDeg float64
	// SpeedKMH is the simulated speed
	SpeedKMH float64
	// IntervalSec is the GPS ping interval in seconds
	IntervalSec int
	// PointCount is how many points along the route to sample
	PointCount int
}

// DefaultGPSConfig returns realistic bus GPS parameters.
func DefaultGPSConfig() GPSTraceConfig {
	return GPSTraceConfig{
		NoiseDeg:    0.0002, // ~20m
		SpeedKMH:    35,
		IntervalSec: 5,
		PointCount:  10,
	}
}

// GenerateGPSBatch creates a synthetic GPS batch following a route polyline.
// Useful for testing the full pipeline without real phones.
func GenerateGPSBatch(routeLine orb.LineString, deviceHash string, cfg GPSTraceConfig) model.GPSBatch {
	if len(routeLine) < 2 {
		return model.GPSBatch{}
	}

	rng := rand.New(rand.NewSource(time.Now().UnixNano()))

	// Sample evenly spaced points along the route
	points := sampleAlongLine(routeLine, cfg.PointCount)

	startTime := time.Now().Unix()
	pings := make([]model.GPSPing, len(points))

	for i, pt := range points {
		// Add GPS noise
		noiseLat := (rng.Float64()*2 - 1) * cfg.NoiseDeg
		noiseLng := (rng.Float64()*2 - 1) * cfg.NoiseDeg

		lat := pt.Lat() + noiseLat
		lng := pt.Lon() + noiseLng

		// Compute bearing from this point to next
		bearing := 0.0
		if i < len(points)-1 {
			next := points[i+1]
			bearing = spatial.Bearing(pt.Lat(), pt.Lon(), next.Lat(), next.Lon())
		} else if i > 0 {
			prev := points[i-1]
			bearing = spatial.Bearing(prev.Lat(), prev.Lon(), pt.Lat(), pt.Lon())
		}

		pings[i] = model.GPSPing{
			Lat:       lat,
			Lng:       lng,
			Timestamp: startTime + int64(i*cfg.IntervalSec),
			Accuracy:  8 + rng.Float64()*12, // 8-20m accuracy
			Speed:     (cfg.SpeedKMH / 3.6) + (rng.Float64()*2 - 1), // m/s with jitter
			Bearing:   bearing + (rng.Float64()*10 - 5),              // ±5° jitter
		}
	}

	return model.GPSBatch{
		DeviceHash: deviceHash,
		SessionID:  "sess_" + deviceHash,
		Pings:      pings,
	}
}

// GenerateMultiDeviceBatches creates batches from multiple "passengers" on the same bus.
// Each device is offset slightly from the route with independent noise.
func GenerateMultiDeviceBatches(routeLine orb.LineString, deviceCount int, cfg GPSTraceConfig) []model.GPSBatch {
	batches := make([]model.GPSBatch, deviceCount)
	for i := 0; i < deviceCount; i++ {
		hash := randomHash()
		batches[i] = GenerateGPSBatch(routeLine, hash, cfg)
	}
	return batches
}

// sampleAlongLine returns n evenly spaced points along a polyline.
func sampleAlongLine(line orb.LineString, n int) []orb.Point {
	if n <= 0 || len(line) < 2 {
		return nil
	}
	if n == 1 {
		return []orb.Point{line[0]}
	}

	// Compute total length in degrees (approximate)
	totalLen := 0.0
	for i := 0; i < len(line)-1; i++ {
		dx := line[i+1][0] - line[i][0]
		dy := line[i+1][1] - line[i][1]
		totalLen += math.Sqrt(dx*dx + dy*dy)
	}

	step := totalLen / float64(n-1)
	points := make([]orb.Point, 0, n)
	points = append(points, line[0])

	accumulated := 0.0
	nextTarget := step
	segIdx := 0

	for len(points) < n && segIdx < len(line)-1 {
		dx := line[segIdx+1][0] - line[segIdx][0]
		dy := line[segIdx+1][1] - line[segIdx][1]
		segLen := math.Sqrt(dx*dx + dy*dy)

		if accumulated+segLen >= nextTarget {
			// Interpolate within this segment
			remaining := nextTarget - accumulated
			t := remaining / segLen
			p := orb.Point{
				line[segIdx][0] + t*dx,
				line[segIdx][1] + t*dy,
			}
			points = append(points, p)
			nextTarget += step
		} else {
			accumulated += segLen
			segIdx++
		}
	}

	// Ensure we have exactly n points
	for len(points) < n {
		points = append(points, line[len(line)-1])
	}

	return points[:n]
}

func randomHash() string {
	const chars = "abcdef0123456789"
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	b := make([]byte, 16)
	for i := range b {
		b[i] = chars[rng.Intn(len(chars))]
	}
	return string(b)
}
