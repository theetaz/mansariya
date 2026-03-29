package handler

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/masariya/backend/internal/model"
)

type SimulationStoreInterface interface {
	Create(ctx context.Context, input model.SimulationJobInput) (*model.SimulationJob, error)
	Get(ctx context.Context, id string) (*model.SimulationJobDetail, error)
	List(ctx context.Context) ([]model.SimulationJob, error)
	Update(ctx context.Context, id string, input model.SimulationJobInput) error
	Delete(ctx context.Context, id string) error
	GetActiveStats(ctx context.Context) (*model.SimulationActiveResponse, error)
}

type SimulationManagerInterface interface {
	Start(ctx context.Context, jobID string) error
	Pause(ctx context.Context, jobID string) error
	Resume(ctx context.Context, jobID string) error
	Stop(ctx context.Context, jobID string) error
}

type SimulationHandler struct {
	store   SimulationStoreInterface
	manager SimulationManagerInterface
}

func NewSimulationHandler(store SimulationStoreInterface, manager SimulationManagerInterface) *SimulationHandler {
	return &SimulationHandler{store: store, manager: manager}
}

func (h *SimulationHandler) List(w http.ResponseWriter, r *http.Request) {
	jobs, err := h.store.List(r.Context())
	if err != nil {
		slog.Error("list simulations", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to list simulations"})
		return
	}
	if jobs == nil {
		jobs = []model.SimulationJob{}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"simulations": jobs, "count": len(jobs)})
}

func (h *SimulationHandler) Create(w http.ResponseWriter, r *http.Request) {
	var input model.SimulationJobInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if input.RouteID == "" || input.Name == "" || len(input.Vehicles) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "route_id, name, and at least one vehicle are required"})
		return
	}

	if input.PingIntervalSec == 0 {
		input.PingIntervalSec = 3
	}
	if input.DefaultSpeedMinKMH == 0 {
		input.DefaultSpeedMinKMH = 20
	}
	if input.DefaultSpeedMaxKMH == 0 {
		input.DefaultSpeedMaxKMH = 60
	}
	if input.DefaultDwellMinSec == 0 {
		input.DefaultDwellMinSec = 15
	}
	if input.DefaultDwellMaxSec == 0 {
		input.DefaultDwellMaxSec = 60
	}

	job, err := h.store.Create(r.Context(), input)
	if err != nil {
		slog.Error("create simulation", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create simulation"})
		return
	}

	writeJSON(w, http.StatusCreated, job)
}

func (h *SimulationHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "simID")
	detail, err := h.store.Get(r.Context(), id)
	if err != nil {
		slog.Error("get simulation", "error", err)
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "simulation not found"})
		return
	}
	writeJSON(w, http.StatusOK, detail)
}

func (h *SimulationHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "simID")
	var input model.SimulationJobInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if err := h.store.Update(r.Context(), id, input); err != nil {
		slog.Error("update simulation", "error", err)
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *SimulationHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "simID")
	if err := h.store.Delete(r.Context(), id); err != nil {
		slog.Error("delete simulation", "error", err)
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (h *SimulationHandler) StartJob(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "simID")
	if err := h.manager.Start(r.Context(), id); err != nil {
		slog.Error("start simulation", "error", err)
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "started"})
}

func (h *SimulationHandler) PauseJob(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "simID")
	if err := h.manager.Pause(r.Context(), id); err != nil {
		slog.Error("pause simulation", "error", err)
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "paused"})
}

func (h *SimulationHandler) ResumeJob(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "simID")
	if err := h.manager.Resume(r.Context(), id); err != nil {
		slog.Error("resume simulation", "error", err)
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "resumed"})
}

func (h *SimulationHandler) StopJob(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "simID")
	if err := h.manager.Stop(r.Context(), id); err != nil {
		slog.Error("stop simulation", "error", err)
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "stopped"})
}

func (h *SimulationHandler) ActiveStats(w http.ResponseWriter, r *http.Request) {
	stats, err := h.store.GetActiveStats(r.Context())
	if err != nil {
		slog.Error("get active stats", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to get active stats"})
		return
	}
	writeJSON(w, http.StatusOK, stats)
}
