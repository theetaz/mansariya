package simulation

import (
	"context"
	"log/slog"
	"sync"

	"github.com/masariya/backend/internal/model"
)

type JobRunner struct {
	job        model.SimulationJob
	vehicles   []model.SimulationVehicle
	polyline   [][2]float64
	stopDists  []float64
	apiBaseURL string

	cancel context.CancelFunc
	buses  []*BusSimulator
	wg     sync.WaitGroup

	onComplete func(jobID string)
}

type JobRunnerConfig struct {
	Job        model.SimulationJob
	Vehicles   []model.SimulationVehicle
	Polyline   [][2]float64
	StopDists  []float64
	APIBaseURL string
	OnComplete func(jobID string)
}

func NewJobRunner(cfg JobRunnerConfig) *JobRunner {
	return &JobRunner{
		job:        cfg.Job,
		vehicles:   cfg.Vehicles,
		polyline:   cfg.Polyline,
		stopDists:  cfg.StopDists,
		apiBaseURL: cfg.APIBaseURL,
		onComplete: cfg.OnComplete,
	}
}

func (jr *JobRunner) Start(parentCtx context.Context) {
	ctx, cancel := context.WithCancel(parentCtx)
	jr.cancel = cancel

	for _, v := range jr.vehicles {
		speedMin := jr.job.DefaultSpeedMinKMH
		speedMax := jr.job.DefaultSpeedMaxKMH
		dwellMin := jr.job.DefaultDwellMinSec
		dwellMax := jr.job.DefaultDwellMaxSec
		pingInt := jr.job.PingIntervalSec

		if v.SpeedMinKMH != nil {
			speedMin = *v.SpeedMinKMH
		}
		if v.SpeedMaxKMH != nil {
			speedMax = *v.SpeedMaxKMH
		}
		if v.DwellMinSec != nil {
			dwellMin = *v.DwellMinSec
		}
		if v.DwellMaxSec != nil {
			dwellMax = *v.DwellMaxSec
		}
		if v.PingIntervalSec != nil {
			pingInt = *v.PingIntervalSec
		}

		bs := NewBusSimulator(BusSimulatorConfig{
			JobID:           jr.job.ID,
			Vehicle:         v,
			Polyline:        jr.polyline,
			StopDists:       jr.stopDists,
			SpeedMinKMH:     speedMin,
			SpeedMaxKMH:     speedMax,
			DwellMinSec:     dwellMin,
			DwellMaxSec:     dwellMax,
			PingIntervalSec: pingInt,
			APIBaseURL:      jr.apiBaseURL,
		})
		jr.buses = append(jr.buses, bs)

		jr.wg.Add(1)
		go func(bs *BusSimulator) {
			defer jr.wg.Done()
			bs.Run(ctx)
		}(bs)
	}

	go func() {
		jr.wg.Wait()
		slog.Info("all buses completed for job", "job", jr.job.ID)
		if jr.onComplete != nil {
			jr.onComplete(jr.job.ID)
		}
	}()
}

func (jr *JobRunner) Stop() {
	if jr.cancel != nil {
		jr.cancel()
	}
}

func (jr *JobRunner) Pause() {
	for _, bs := range jr.buses {
		bs.Pause()
	}
}

func (jr *JobRunner) Resume() {
	for _, bs := range jr.buses {
		bs.Resume()
	}
}
