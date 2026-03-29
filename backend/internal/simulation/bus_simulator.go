package simulation

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"github.com/masariya/backend/internal/model"
)

type BusSimulator struct {
	jobID     string
	vehicle   model.SimulationVehicle
	polyline  [][2]float64
	cumDists  []float64
	stopDists []float64

	speedMinKMH  float64
	speedMaxKMH  float64
	dwellMinSec  int
	dwellMaxSec  int
	pingInterval time.Duration

	apiBaseURL string
	rng        *rand.Rand

	mu     sync.Mutex
	paused bool
	pauseC chan struct{}
}

type BusSimulatorConfig struct {
	JobID           string
	Vehicle         model.SimulationVehicle
	Polyline        [][2]float64
	StopDists       []float64
	SpeedMinKMH     float64
	SpeedMaxKMH     float64
	DwellMinSec     int
	DwellMaxSec     int
	PingIntervalSec int
	APIBaseURL      string
}

func NewBusSimulator(cfg BusSimulatorConfig) *BusSimulator {
	cumDists := polylineSegmentDistances(cfg.Polyline)
	seed := time.Now().UnixNano() + int64(rand.Intn(10000))
	return &BusSimulator{
		jobID:        cfg.JobID,
		vehicle:      cfg.Vehicle,
		polyline:     cfg.Polyline,
		cumDists:     cumDists,
		stopDists:    cfg.StopDists,
		speedMinKMH:  cfg.SpeedMinKMH,
		speedMaxKMH:  cfg.SpeedMaxKMH,
		dwellMinSec:  cfg.DwellMinSec,
		dwellMaxSec:  cfg.DwellMaxSec,
		pingInterval: time.Duration(cfg.PingIntervalSec) * time.Second,
		apiBaseURL:   cfg.APIBaseURL,
		rng:          rand.New(rand.NewSource(seed)),
		pauseC:       make(chan struct{}),
	}
}

func (bs *BusSimulator) Run(ctx context.Context) {
	totalDist := bs.cumDists[len(bs.cumDists)-1]
	currentDist := bs.findStartDistance()
	currentSpeed := (bs.speedMinKMH + bs.speedMaxKMH) / 2
	targetSpeed := bs.randomSpeed()
	speedChangeTimer := 0

	visitedStops := make(map[int]bool)
	for i, sd := range bs.stopDists {
		if sd <= currentDist {
			visitedStops[i] = true
		}
	}

	client := &http.Client{Timeout: 5 * time.Second}
	ticker := time.NewTicker(bs.pingInterval)
	defer ticker.Stop()

	slog.Info("bus simulator started",
		"job", bs.jobID, "vehicle", bs.vehicle.VehicleID,
		"passengers", bs.vehicle.PassengerCount,
		"start_dist", currentDist, "total_dist", totalDist)

	for {
		select {
		case <-ctx.Done():
			slog.Info("bus simulator stopped (context cancelled)", "vehicle", bs.vehicle.VehicleID)
			return
		case <-ticker.C:
			// Check if paused
			bs.mu.Lock()
			for bs.paused {
				bs.mu.Unlock()
				select {
				case <-ctx.Done():
					return
				case <-bs.pauseC:
				}
				bs.mu.Lock()
			}
			bs.mu.Unlock()

			// Check if near a bus stop
			dwelling := false
			for i, sd := range bs.stopDists {
				if visitedStops[i] {
					continue
				}
				if currentDist >= sd-20 {
					visitedStops[i] = true
					dwellSec := bs.dwellMinSec + bs.rng.Intn(bs.dwellMaxSec-bs.dwellMinSec+1)
					slog.Debug("bus dwelling at stop", "vehicle", bs.vehicle.VehicleID, "stop_idx", i, "dwell_sec", dwellSec)
					dwelling = true

					dwellTicks := int(time.Duration(dwellSec)*time.Second / bs.pingInterval)
					for t := 0; t < dwellTicks; t++ {
						select {
						case <-ctx.Done():
							return
						default:
						}
						bs.mu.Lock()
						for bs.paused {
							bs.mu.Unlock()
							select {
							case <-ctx.Done():
								return
							case <-bs.pauseC:
							}
							bs.mu.Lock()
						}
						bs.mu.Unlock()

						lat, lng, brg := interpolatePosition(bs.polyline, bs.cumDists, currentDist)
						bs.sendPings(ctx, client, lat, lng, 0, brg)
						time.Sleep(bs.pingInterval)
					}
					currentSpeed = bs.speedMinKMH * 0.5
					break
				}
			}
			if dwelling {
				continue
			}

			speedChangeTimer++
			if speedChangeTimer >= 5 {
				targetSpeed = bs.randomSpeed()
				speedChangeTimer = 0
			}
			currentSpeed += 0.3 * (targetSpeed - currentSpeed)

			speedMS := currentSpeed * 1000 / 3600
			currentDist += speedMS * bs.pingInterval.Seconds()

			if currentDist >= totalDist {
				lat, lng, brg := interpolatePosition(bs.polyline, bs.cumDists, totalDist)
				bs.sendPings(ctx, client, lat, lng, 0, brg)
				slog.Info("bus completed trip", "vehicle", bs.vehicle.VehicleID)
				return
			}

			lat, lng, brg := interpolatePosition(bs.polyline, bs.cumDists, currentDist)
			bs.sendPings(ctx, client, lat, lng, speedMS, brg)
		}
	}
}

func (bs *BusSimulator) Pause() {
	bs.mu.Lock()
	bs.paused = true
	bs.mu.Unlock()
}

func (bs *BusSimulator) Resume() {
	bs.mu.Lock()
	bs.paused = false
	bs.mu.Unlock()
	close(bs.pauseC)
	bs.pauseC = make(chan struct{})
}

func (bs *BusSimulator) findStartDistance() float64 {
	if bs.vehicle.StartLat != nil && bs.vehicle.StartLng != nil {
		return findNearestDistanceOnPolyline(bs.polyline, bs.cumDists, *bs.vehicle.StartLat, *bs.vehicle.StartLng)
	}
	return 0
}

func (bs *BusSimulator) randomSpeed() float64 {
	return bs.speedMinKMH + bs.rng.Float64()*(bs.speedMaxKMH-bs.speedMinKMH)
}

func (bs *BusSimulator) sendPings(ctx context.Context, client *http.Client, lat, lng, speedMS, brg float64) {
	for i := 0; i < bs.vehicle.PassengerCount; i++ {
		deviceHash := fmt.Sprintf("sim_%s_%s_%d", bs.jobID[:8], bs.vehicle.VehicleID, i)
		sessionID := fmt.Sprintf("sim_%s_%s", bs.jobID[:8], bs.vehicle.VehicleID)

		nLat, nLng, nAcc, nSpd, nBrg := addGPSNoise(lat, lng, speedMS, brg, bs.rng)

		batch := model.GPSBatch{
			DeviceHash: deviceHash,
			SessionID:  sessionID,
			Pings: []model.GPSPing{
				{
					Lat:       nLat,
					Lng:       nLng,
					Timestamp: time.Now().Unix(),
					Accuracy:  nAcc,
					Speed:     nSpd,
					Bearing:   nBrg,
				},
			},
		}

		data, err := json.Marshal(batch)
		if err != nil {
			slog.Error("marshal ping", "error", err)
			continue
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodPost, bs.apiBaseURL+"/api/v1/gps/batch", bytes.NewReader(data))
		if err != nil {
			continue
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := client.Do(req)
		if err != nil {
			slog.Debug("send ping failed", "error", err, "device", deviceHash)
			continue
		}
		resp.Body.Close()
	}
}
