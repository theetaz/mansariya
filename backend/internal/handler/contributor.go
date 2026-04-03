package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/masariya/backend/internal/model"
	"github.com/masariya/backend/internal/service"
)

// ContributorDataStore abstracts contributor data operations for the handler.
type ContributorDataStore interface {
	GetByContributorID(ctx context.Context, contributorID string) (*model.Contributor, error)
	GetContributionStats(ctx context.Context, contributorID string) (*model.ContributionStats, error)
	GetLeaderboard(ctx context.Context, sortBy string, limit, offset int) ([]model.LeaderboardEntry, int, error)
	ListContributorsFiltered(ctx context.Context, search, status, sortBy, sortDir string, limit, offset int) ([]model.Contributor, []model.ContributionStats, int, error)
}

type ContributorHandler struct {
	auth  *service.ContributorAuthService
	store ContributorDataStore
}

func NewContributorHandler(auth *service.ContributorAuthService, cs ContributorDataStore) *ContributorHandler {
	return &ContributorHandler{auth: auth, store: cs}
}

// ── Context key for contributor ID ───────────────────────────────────────

const contributorIDKey contextKey = "contributorID"

func ContributorIDFromContext(ctx context.Context) string {
	v, _ := ctx.Value(contributorIDKey).(string)
	return v
}

// ── JWT Middleware ────────────────────────────────────────────────────────

func (h *ContributorHandler) JWTMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			WriteAPIErr(w, r, ErrUnauthorized("auth.unauthorized"))
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
			WriteAPIErr(w, r, ErrUnauthorized("auth.invalid_token"))
			return
		}

		claims, err := h.auth.ValidateContributorToken(parts[1])
		if err != nil {
			WriteAPIErr(w, r, ErrUnauthorized("auth.invalid_token"))
			return
		}

		ctx := context.WithValue(r.Context(), contributorIDKey, claims.ContributorID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// ── Login ────────────────────────────────────────────────────────────────

func (h *ContributorHandler) HandleLogin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		DisplayName string `json:"display_name"`
		Password    string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteAPIErr(w, r, ErrValidation("invalid_body", "validation.invalid_body", ""))
		return
	}
	if req.DisplayName == "" || req.Password == "" {
		WriteAPIErr(w, r, ErrValidation("validation_failed", "validation.required", "display_name,password"))
		return
	}

	c, tokens, err := h.auth.Login(r.Context(), req.DisplayName, req.Password, r.RemoteAddr, r.UserAgent())
	if err != nil {
		if errors.Is(err, service.ErrInvalidCredentials) {
			WriteAPIErr(w, r, ErrUnauthorized("auth.invalid_credentials"))
			return
		}
		if errors.Is(err, service.ErrContributorNotClaimed) {
			WriteAPIErr(w, r, ErrValidation("not_claimed", "auth.account_not_active", ""))
			return
		}
		WriteAPIErr(w, r, ErrInternal(err))
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"contributor":   c,
		"access_token":  tokens.AccessToken,
		"refresh_token": tokens.RefreshToken,
		"expires_at":    tokens.ExpiresAt.Format("2006-01-02T15:04:05Z"),
	})
}

// ── Refresh ──────────────────────────────────────────────────────────────

func (h *ContributorHandler) HandleRefresh(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.RefreshToken == "" {
		WriteAPIErr(w, r, ErrValidation("validation_failed", "validation.required", "refresh_token"))
		return
	}

	c, tokens, err := h.auth.RefreshTokens(r.Context(), req.RefreshToken, r.RemoteAddr, r.UserAgent())
	if err != nil {
		WriteAPIErr(w, r, ErrUnauthorized("auth.invalid_token"))
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"contributor":   c,
		"access_token":  tokens.AccessToken,
		"refresh_token": tokens.RefreshToken,
		"expires_at":    tokens.ExpiresAt.Format("2006-01-02T15:04:05Z"),
	})
}

// ── Logout ───────────────────────────────────────────────────────────────

func (h *ContributorHandler) HandleLogout(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RefreshToken string `json:"refresh_token"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)
	_ = h.auth.Logout(r.Context(), req.RefreshToken)
	writeJSON(w, http.StatusOK, map[string]string{"status": "logged_out"})
}

// ── Profile ──────────────────────────────────────────────────────────────

func (h *ContributorHandler) HandleGetProfile(w http.ResponseWriter, r *http.Request) {
	cid := ContributorIDFromContext(r.Context())
	c, err := h.store.GetByContributorID(r.Context(), cid)
	if err != nil || c == nil {
		WriteAPIErr(w, r, ErrNotFound("not_found.generic"))
		return
	}

	stats, err := h.store.GetContributionStats(r.Context(), cid)
	if err != nil {
		WriteAPIErr(w, r, ErrInternal(err))
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"contributor": c,
		"stats":       stats,
	})
}

// ── Stats ────────────────────────────────────────────────────────────────

func (h *ContributorHandler) HandleGetStats(w http.ResponseWriter, r *http.Request) {
	cid := ContributorIDFromContext(r.Context())
	stats, err := h.store.GetContributionStats(r.Context(), cid)
	if err != nil {
		WriteAPIErr(w, r, ErrInternal(err))
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

// ── Claim ────────────────────────────────────────────────────────────────

func (h *ContributorHandler) HandleClaim(w http.ResponseWriter, r *http.Request) {
	cid := ContributorIDFromContext(r.Context())

	var req struct {
		DisplayName string `json:"display_name"`
		Password    string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteAPIErr(w, r, ErrValidation("invalid_body", "validation.invalid_body", ""))
		return
	}
	if req.DisplayName == "" || req.Password == "" {
		WriteAPIErr(w, r, ErrValidation("validation_failed", "validation.required", "display_name,password"))
		return
	}
	if len(req.Password) < 8 {
		WriteAPIErr(w, r, ErrValidation("weak_password", "auth.weak_password", "password"))
		return
	}

	c, err := h.auth.Claim(r.Context(), cid, req.DisplayName, req.Password)
	if err != nil {
		if errors.Is(err, service.ErrAlreadyClaimed) {
			WriteAPIErr(w, r, ErrValidation("already_claimed", "conflict.duplicate", ""))
			return
		}
		if errors.Is(err, service.ErrDisplayNameTaken) {
			WriteAPIErr(w, r, ErrConflict("display_name_taken", "conflict.duplicate", "display_name"))
			return
		}
		if errors.Is(err, service.ErrContributorNotFound) {
			WriteAPIErr(w, r, ErrNotFound("not_found.generic"))
			return
		}
		WriteAPIErr(w, r, ErrInternal(err))
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":      "claimed",
		"contributor": c,
	})
}

// ── Leaderboard (public) ─────────────────────────────────────────────────

func (h *ContributorHandler) HandleLeaderboard(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	limit, _ := strconv.Atoi(q.Get("limit"))
	offset, _ := strconv.Atoi(q.Get("offset"))
	if limit <= 0 {
		limit = 50
	}

	entries, total, err := h.store.GetLeaderboard(r.Context(), q.Get("sort"), limit, offset)
	if err != nil {
		WriteAPIErr(w, r, ErrInternal(err))
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"leaderboard": entries,
		"total":       total,
		"limit":       limit,
		"offset":      offset,
	})
}

// ── Admin: List contributors (server-side) ───────────────────────────────

func (h *ContributorHandler) HandleAdminList(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	limit, _ := strconv.Atoi(q.Get("limit"))
	offset, _ := strconv.Atoi(q.Get("offset"))
	if limit <= 0 {
		limit = 15
	}

	contributors, stats, total, err := h.store.ListContributorsFiltered(r.Context(),
		q.Get("search"), q.Get("status"),
		q.Get("sort_by"), q.Get("sort_dir"),
		limit, offset,
	)
	if err != nil {
		WriteAPIErr(w, r, ErrInternal(err))
		return
	}

	// Merge into views
	type contributorView struct {
		ID            string      `json:"id"`
		ContributorID string      `json:"contributor_id"`
		DisplayName   *string     `json:"display_name"`
		Status        string      `json:"status"`
		ClaimedAt     interface{} `json:"claimed_at"`
		LastSeenAt    interface{} `json:"last_seen_at"`
		CreatedAt     string      `json:"created_at"`
		TotalTrips    int         `json:"total_trips"`
		TotalPings    int64       `json:"total_pings"`
		QualityScore  float64     `json:"quality_score"`
		ActiveDays    int         `json:"active_days"`
	}

	views := make([]contributorView, len(contributors))
	for i, c := range contributors {
		var claimed, lastSeen interface{}
		if c.ClaimedAt != nil {
			claimed = c.ClaimedAt.Format("2006-01-02T15:04:05Z")
		}
		if c.LastSeenAt != nil {
			lastSeen = c.LastSeenAt.Format("2006-01-02T15:04:05Z")
		}
		views[i] = contributorView{
			ID:            c.ID,
			ContributorID: c.ContributorID,
			DisplayName:   c.DisplayName,
			Status:        c.Status,
			ClaimedAt:     claimed,
			LastSeenAt:    lastSeen,
			CreatedAt:     c.CreatedAt.Format("2006-01-02T15:04:05Z"),
			TotalTrips:    stats[i].TotalTrips,
			TotalPings:    stats[i].TotalPings,
			QualityScore:  stats[i].QualityScore,
			ActiveDays:    stats[i].ActiveDays,
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"contributors": views,
		"total":        total,
		"limit":        limit,
		"offset":       offset,
	})
}
