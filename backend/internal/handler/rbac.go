package handler

import (
	"context"
	"net/http"
	"strings"

	"github.com/masariya/backend/internal/service"
)

const permissionsKey contextKey = "permissions"

// PermissionsFromContext returns the permission slugs for the authenticated user.
func PermissionsFromContext(ctx context.Context) []string {
	v, _ := ctx.Value(permissionsKey).([]string)
	return v
}

// HasPermission checks if the context contains a specific permission.
func HasPermission(ctx context.Context, perm string) bool {
	for _, p := range PermissionsFromContext(ctx) {
		if p == perm {
			return true
		}
	}
	return false
}

// RBACMiddleware combines authentication (JWT or API key) with permission loading.
// It accepts either a Bearer JWT token or an X-API-Key header.
// JWT users get their actual permissions loaded; API key gets full access.
type RBACMiddleware struct {
	auth   *service.AuthService
	apiKey string
	store  service.AuthStoreInterface
}

func NewRBACMiddleware(auth *service.AuthService, store service.AuthStoreInterface, apiKey string) *RBACMiddleware {
	return &RBACMiddleware{auth: auth, store: store, apiKey: apiKey}
}

// Authenticate resolves the user from JWT or API key and loads permissions into context.
func (m *RBACMiddleware) Authenticate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Try JWT first
		if authHeader := r.Header.Get("Authorization"); authHeader != "" {
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) == 2 && strings.EqualFold(parts[0], "bearer") {
				claims, err := m.auth.ValidateAccessToken(parts[1])
				if err != nil {
					writeError(w, http.StatusUnauthorized, "invalid_token", "Invalid or expired access token.", "")
					return
				}

				// Verify user still exists and is active
				user, err := m.store.GetUserByID(r.Context(), claims.UserID)
				if err != nil {
					writeError(w, http.StatusUnauthorized, "user_not_found", "User no longer exists.", "")
					return
				}
				if user.Status != "active" {
					writeError(w, http.StatusUnauthorized, "account_disabled", "Account has been disabled.", "")
					return
				}

				// Verify user has at least one active session
				sessions, err := m.store.ListUserSessions(r.Context(), claims.UserID)
				if err == nil && len(sessions) == 0 {
					writeError(w, http.StatusUnauthorized, "session_revoked", "All sessions have been revoked. Please sign in again.", "")
					return
				}

				// Load permissions
				perms, err := m.store.GetUserPermissions(r.Context(), claims.UserID)
				if err != nil {
					writeError(w, http.StatusInternalServerError, "load_permissions", "Failed to load permissions.", "")
					return
				}

				ctx := context.WithValue(r.Context(), userIDKey, claims.UserID)
				ctx = context.WithValue(ctx, permissionsKey, perms)
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}
		}

		// Fall back to API key (for programmatic/script access — grants full admin)
		if key := r.Header.Get("X-API-Key"); key != "" && key == m.apiKey {
			ctx := context.WithValue(r.Context(), userIDKey, "api-key")
			ctx = context.WithValue(ctx, permissionsKey, []string{"*"}) // wildcard = all perms
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}

		writeError(w, http.StatusUnauthorized, "unauthenticated", "Authentication required. Provide a Bearer token or X-API-Key.", "")
	})
}

// RequirePermission returns middleware that checks for a specific permission.
// Returns 403 if the user lacks the permission.
func RequirePermission(perm string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			perms := PermissionsFromContext(r.Context())

			// Wildcard (API key) grants everything
			for _, p := range perms {
				if p == "*" || p == perm {
					next.ServeHTTP(w, r)
					return
				}
			}

			writeError(w, http.StatusForbidden, "forbidden", "You do not have permission to perform this action.", "")
		})
	}
}

// RequireAnyPermission returns middleware that checks for any of the given permissions.
func RequireAnyPermission(perms ...string) func(http.Handler) http.Handler {
	permSet := make(map[string]bool, len(perms))
	for _, p := range perms {
		permSet[p] = true
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			for _, p := range PermissionsFromContext(r.Context()) {
				if p == "*" || permSet[p] {
					next.ServeHTTP(w, r)
					return
				}
			}

			writeError(w, http.StatusForbidden, "forbidden", "You do not have permission to perform this action.", "")
		})
	}
}
