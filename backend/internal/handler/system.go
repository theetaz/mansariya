package handler

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type healthCheckFunc func(ctx context.Context) error

type serviceHealth struct {
	Name    string `json:"name"`
	Status  string `json:"status"`
	Message string `json:"message,omitempty"`
}

type systemHealthResponse struct {
	Status    string          `json:"status"`
	CheckedAt time.Time       `json:"checked_at"`
	Services  []serviceHealth `json:"services"`
}

type SystemHandler struct {
	postgresCheck healthCheckFunc
	redisCheck    healthCheckFunc
	valhallaURL   string
	httpClient    *http.Client
}

func NewSystemHandler(postgresCheck, redisCheck healthCheckFunc, valhallaURL string) *SystemHandler {
	return &SystemHandler{
		postgresCheck: postgresCheck,
		redisCheck:    redisCheck,
		valhallaURL:   strings.TrimRight(valhallaURL, "/"),
		httpClient: &http.Client{
			Timeout: 2 * time.Second,
		},
	}
}

func (h *SystemHandler) GetHealth(w http.ResponseWriter, r *http.Request) {
	services := []serviceHealth{{
		Name:   "backend",
		Status: "ok",
	}}

	services = append(services,
		h.runCheck(r.Context(), "postgres", h.postgresCheck),
		h.runCheck(r.Context(), "redis", h.redisCheck),
		h.checkValhalla(r.Context()),
	)

	overall := "ok"
	for _, service := range services {
		if service.Status != "ok" {
			overall = "degraded"
			break
		}
	}

	writeJSON(w, http.StatusOK, systemHealthResponse{
		Status:    overall,
		CheckedAt: time.Now().UTC(),
		Services:  services,
	})
}

func (h *SystemHandler) runCheck(ctx context.Context, name string, check healthCheckFunc) serviceHealth {
	if check == nil {
		return serviceHealth{
			Name:    name,
			Status:  "unknown",
			Message: "not configured",
		}
	}

	checkCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	if err := check(checkCtx); err != nil {
		return serviceHealth{
			Name:    name,
			Status:  "down",
			Message: err.Error(),
		}
	}

	return serviceHealth{
		Name:   name,
		Status: "ok",
	}
}

func (h *SystemHandler) checkValhalla(ctx context.Context) serviceHealth {
	if h.valhallaURL == "" {
		return serviceHealth{
			Name:    "valhalla",
			Status:  "unknown",
			Message: "not configured",
		}
	}

	checkCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(checkCtx, http.MethodGet, h.valhallaURL+"/status", nil)
	if err != nil {
		return serviceHealth{
			Name:    "valhalla",
			Status:  "down",
			Message: fmt.Sprintf("create request: %v", err),
		}
	}

	resp, err := h.httpClient.Do(req)
	if err != nil {
		return serviceHealth{
			Name:    "valhalla",
			Status:  "down",
			Message: err.Error(),
		}
	}
	defer resp.Body.Close()

	// Valhalla doesn't expose a dedicated /status endpoint in all versions.
	// Any HTTP response (including 404) proves the service is reachable and
	// serving requests. Only a connection failure (handled above) means down.
	if resp.StatusCode >= 500 {
		return serviceHealth{
			Name:    "valhalla",
			Status:  "down",
			Message: fmt.Sprintf("server error: status %d", resp.StatusCode),
		}
	}

	return serviceHealth{
		Name:   "valhalla",
		Status: "ok",
	}
}
