package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/masariya/backend/internal/service"
)

type AuthHandler struct {
	auth *service.AuthService
}

func NewAuthHandler(auth *service.AuthService) *AuthHandler {
	return &AuthHandler{auth: auth}
}

// ── Login ────────────────────────────────────────────────────────────────

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type loginResponse struct {
	User         interface{} `json:"user"`
	AccessToken  string      `json:"access_token"`
	RefreshToken string      `json:"refresh_token"`
	ExpiresAt    string      `json:"expires_at"`
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "Invalid request body.", "")
		return
	}

	if req.Email == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "validation_failed", "Email and password are required.", "")
		return
	}

	ip := r.RemoteAddr
	ua := r.UserAgent()

	user, tokens, err := h.auth.Login(r.Context(), req.Email, req.Password, ip, ua)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidCredentials):
			writeError(w, http.StatusUnauthorized, "invalid_credentials", "Invalid email or password.", "")
		case errors.Is(err, service.ErrAccountDisabled):
			writeError(w, http.StatusForbidden, "account_disabled", "This account has been disabled.", "")
		case errors.Is(err, service.ErrAccountLocked):
			writeError(w, http.StatusTooManyRequests, "account_locked", "Too many failed attempts. Please try again later.", "")
		case errors.Is(err, service.ErrAccountNotActive):
			writeError(w, http.StatusForbidden, "account_not_active", "Please accept your invitation first.", "")
		default:
			writeError(w, http.StatusInternalServerError, "login_failed", "Login failed. Please try again.", "")
		}
		return
	}

	writeJSON(w, http.StatusOK, loginResponse{
		User:         user,
		AccessToken:  tokens.AccessToken,
		RefreshToken: tokens.RefreshToken,
		ExpiresAt:    tokens.ExpiresAt.Format("2006-01-02T15:04:05Z"),
	})
}

// ── Logout ───────────────────────────────────────────────────────────────

type logoutRequest struct {
	RefreshToken string `json:"refresh_token"`
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	var req logoutRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "Invalid request body.", "")
		return
	}

	_ = h.auth.Logout(r.Context(), req.RefreshToken)
	writeJSON(w, http.StatusOK, map[string]string{"status": "logged_out"})
}

// ── Refresh ──────────────────────────────────────────────────────────────

type refreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req refreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "Invalid request body.", "")
		return
	}

	if req.RefreshToken == "" {
		writeError(w, http.StatusBadRequest, "validation_failed", "Refresh token is required.", "")
		return
	}

	ip := r.RemoteAddr
	ua := r.UserAgent()

	user, tokens, err := h.auth.RefreshTokens(r.Context(), req.RefreshToken, ip, ua)
	if err != nil {
		if errors.Is(err, service.ErrInvalidToken) || errors.Is(err, service.ErrAccountDisabled) {
			writeError(w, http.StatusUnauthorized, "invalid_token", "Invalid or expired refresh token.", "")
			return
		}
		writeError(w, http.StatusInternalServerError, "refresh_failed", "Token refresh failed.", "")
		return
	}

	writeJSON(w, http.StatusOK, loginResponse{
		User:         user,
		AccessToken:  tokens.AccessToken,
		RefreshToken: tokens.RefreshToken,
		ExpiresAt:    tokens.ExpiresAt.Format("2006-01-02T15:04:05Z"),
	})
}

// ── Me ───────────────────────────────────────────────────────────────────

type meResponse struct {
	User        interface{} `json:"user"`
	Permissions []string    `json:"permissions"`
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	userID := UserIDFromContext(r.Context())
	if userID == "" {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Authentication required.", "")
		return
	}

	user, perms, err := h.auth.GetCurrentUser(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "get_user_failed", "Could not load user.", "")
		return
	}

	writeJSON(w, http.StatusOK, meResponse{
		User:        user,
		Permissions: perms,
	})
}

// ── Invite accept ────────────────────────────────────────────────────────

type acceptInviteRequest struct {
	Token    string `json:"token"`
	Password string `json:"password"`
}

func (h *AuthHandler) AcceptInvite(w http.ResponseWriter, r *http.Request) {
	var req acceptInviteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "Invalid request body.", "")
		return
	}

	if req.Token == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "validation_failed", "Token and password are required.", "")
		return
	}

	user, err := h.auth.AcceptInvite(r.Context(), req.Token, req.Password)
	if err != nil {
		if errors.Is(err, service.ErrInvalidToken) {
			writeError(w, http.StatusBadRequest, "invalid_token", "Invalid or expired invitation.", "")
			return
		}
		if errors.Is(err, service.ErrWeakPassword) {
			writeError(w, http.StatusBadRequest, "weak_password", err.Error(), "password")
			return
		}
		writeError(w, http.StatusInternalServerError, "invite_failed", "Could not activate account.", "")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status": "activated",
		"user":   user,
	})
}

// ── Password reset ───────────────────────────────────────────────────────

type passwordResetRequestBody struct {
	Email string `json:"email"`
}

func (h *AuthHandler) RequestPasswordReset(w http.ResponseWriter, r *http.Request) {
	var req passwordResetRequestBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "Invalid request body.", "")
		return
	}

	// Always return success to not leak user existence
	_, _ = h.auth.RequestPasswordReset(r.Context(), req.Email)
	writeJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"message": "If that email exists, a reset link has been sent.",
	})
}

type confirmPasswordResetBody struct {
	Token       string `json:"token"`
	NewPassword string `json:"new_password"`
}

func (h *AuthHandler) ConfirmPasswordReset(w http.ResponseWriter, r *http.Request) {
	var req confirmPasswordResetBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "Invalid request body.", "")
		return
	}

	if req.Token == "" || req.NewPassword == "" {
		writeError(w, http.StatusBadRequest, "validation_failed", "Token and new password are required.", "")
		return
	}

	err := h.auth.ResetPassword(r.Context(), req.Token, req.NewPassword)
	if err != nil {
		if errors.Is(err, service.ErrInvalidToken) {
			writeError(w, http.StatusBadRequest, "invalid_token", "Invalid or expired reset token.", "")
			return
		}
		if errors.Is(err, service.ErrWeakPassword) {
			writeError(w, http.StatusBadRequest, "weak_password", err.Error(), "new_password")
			return
		}
		writeError(w, http.StatusInternalServerError, "reset_failed", "Password reset failed.", "")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "password_reset"})
}

// ── JWT Auth Middleware ───────────────────────────────────────────────────

type contextKey string

const userIDKey contextKey = "userID"

func UserIDFromContext(ctx context.Context) string {
	v, _ := ctx.Value(userIDKey).(string)
	return v
}

func (h *AuthHandler) JWTMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			writeError(w, http.StatusUnauthorized, "missing_token", "Authorization header is required.", "")
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
			writeError(w, http.StatusUnauthorized, "invalid_token", "Invalid authorization header format.", "")
			return
		}

		claims, err := h.auth.ValidateAccessToken(parts[1])
		if err != nil {
			writeError(w, http.StatusUnauthorized, "invalid_token", "Invalid or expired access token.", "")
			return
		}

		ctx := context.WithValue(r.Context(), userIDKey, claims.UserID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
