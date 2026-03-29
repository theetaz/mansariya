package simulation

import (
	"context"
	"fmt"
	"log/slog"
	"sync"

	"github.com/masariya/backend/internal/store"
)

type Manager struct {
	mu         sync.Mutex
	runners    map[string]*JobRunner
	store      *store.SimulationStore
	routeStore RouteDataProvider
	apiBaseURL string
}

type RouteDataProvider interface {
	GetPolyline(ctx context.Context, routeID string) ([][2]float64, error)
	GetStopDistances(ctx context.Context, routeID string) ([]float64, error)
}

func NewManager(simStore *store.SimulationStore, routeProvider RouteDataProvider, apiBaseURL string) *Manager {
	return &Manager{
		runners:    make(map[string]*JobRunner),
		store:      simStore,
		routeStore: routeProvider,
		apiBaseURL: apiBaseURL,
	}
}

func (m *Manager) Start(ctx context.Context, jobID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.runners[jobID]; exists {
		return fmt.Errorf("job %s is already running", jobID)
	}

	detail, err := m.store.Get(ctx, jobID)
	if err != nil {
		return fmt.Errorf("get job detail: %w", err)
	}

	if detail.Job.Status != "draft" && detail.Job.Status != "stopped" {
		return fmt.Errorf("cannot start job in %s state", detail.Job.Status)
	}

	polyline, err := m.routeStore.GetPolyline(ctx, detail.Job.RouteID)
	if err != nil {
		return fmt.Errorf("get route polyline: %w", err)
	}
	if len(polyline) < 2 {
		return fmt.Errorf("route %s has no polyline data", detail.Job.RouteID)
	}

	stopDists, err := m.routeStore.GetStopDistances(ctx, detail.Job.RouteID)
	if err != nil {
		slog.Warn("failed to get stop distances, running without stops", "error", err)
		stopDists = nil
	}

	runner := NewJobRunner(JobRunnerConfig{
		Job:        detail.Job,
		Vehicles:   detail.Vehicles,
		Polyline:   polyline,
		StopDists:  stopDists,
		APIBaseURL: m.apiBaseURL,
		OnComplete: m.handleJobComplete,
	})

	if err := m.store.SetStatus(ctx, jobID, "running"); err != nil {
		return fmt.Errorf("set status running: %w", err)
	}

	m.runners[jobID] = runner
	runner.Start(ctx)

	slog.Info("simulation started", "job", jobID, "route", detail.Job.RouteID, "vehicles", len(detail.Vehicles))
	return nil
}

func (m *Manager) Pause(ctx context.Context, jobID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	runner, ok := m.runners[jobID]
	if !ok {
		return fmt.Errorf("job %s is not running", jobID)
	}

	runner.Pause()
	if err := m.store.SetStatus(ctx, jobID, "paused"); err != nil {
		return fmt.Errorf("set status paused: %w", err)
	}
	slog.Info("simulation paused", "job", jobID)
	return nil
}

func (m *Manager) Resume(ctx context.Context, jobID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	runner, ok := m.runners[jobID]
	if !ok {
		return fmt.Errorf("job %s is not running", jobID)
	}

	runner.Resume()
	if err := m.store.SetStatus(ctx, jobID, "running"); err != nil {
		return fmt.Errorf("set status running: %w", err)
	}
	slog.Info("simulation resumed", "job", jobID)
	return nil
}

func (m *Manager) Stop(ctx context.Context, jobID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	runner, ok := m.runners[jobID]
	if !ok {
		return fmt.Errorf("job %s is not running", jobID)
	}

	runner.Stop()
	delete(m.runners, jobID)

	if err := m.store.SetStatus(ctx, jobID, "stopped"); err != nil {
		return fmt.Errorf("set status stopped: %w", err)
	}
	slog.Info("simulation stopped", "job", jobID)
	return nil
}

func (m *Manager) handleJobComplete(jobID string) {
	m.mu.Lock()
	delete(m.runners, jobID)
	m.mu.Unlock()

	ctx := context.Background()
	if err := m.store.SetStatus(ctx, jobID, "stopped"); err != nil {
		slog.Error("failed to set completed job status", "job", jobID, "error", err)
	}
	slog.Info("simulation completed naturally", "job", jobID)
}
