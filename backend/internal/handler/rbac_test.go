package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func okHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func TestRequirePermission_Granted(t *testing.T) {
	// Simulate a context with permissions already loaded
	ctx := context.WithValue(context.Background(), permissionsKey, []string{"routes.view", "routes.create"})
	req := httptest.NewRequest(http.MethodGet, "/test", nil).WithContext(ctx)
	rec := httptest.NewRecorder()

	mw := RequirePermission("routes.view")
	mw(http.HandlerFunc(okHandler)).ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestRequirePermission_Denied(t *testing.T) {
	ctx := context.WithValue(context.Background(), permissionsKey, []string{"routes.view"})
	req := httptest.NewRequest(http.MethodGet, "/test", nil).WithContext(ctx)
	rec := httptest.NewRecorder()

	mw := RequirePermission("users.manage")
	mw(http.HandlerFunc(okHandler)).ServeHTTP(rec, req)

	assert.Equal(t, http.StatusForbidden, rec.Code)
}

func TestRequirePermission_WildcardGrantsAll(t *testing.T) {
	// API key users get "*" wildcard
	ctx := context.WithValue(context.Background(), permissionsKey, []string{"*"})
	req := httptest.NewRequest(http.MethodGet, "/test", nil).WithContext(ctx)
	rec := httptest.NewRecorder()

	mw := RequirePermission("users.manage")
	mw(http.HandlerFunc(okHandler)).ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestRequirePermission_NoPermissions(t *testing.T) {
	ctx := context.WithValue(context.Background(), permissionsKey, []string{})
	req := httptest.NewRequest(http.MethodGet, "/test", nil).WithContext(ctx)
	rec := httptest.NewRecorder()

	mw := RequirePermission("routes.view")
	mw(http.HandlerFunc(okHandler)).ServeHTTP(rec, req)

	assert.Equal(t, http.StatusForbidden, rec.Code)
}

func TestRequireAnyPermission_OneMatch(t *testing.T) {
	ctx := context.WithValue(context.Background(), permissionsKey, []string{"stops.edit"})
	req := httptest.NewRequest(http.MethodGet, "/test", nil).WithContext(ctx)
	rec := httptest.NewRecorder()

	mw := RequireAnyPermission("routes.edit", "stops.edit", "map.edit_polyline")
	mw(http.HandlerFunc(okHandler)).ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestRequireAnyPermission_NoneMatch(t *testing.T) {
	ctx := context.WithValue(context.Background(), permissionsKey, []string{"routes.view"})
	req := httptest.NewRequest(http.MethodGet, "/test", nil).WithContext(ctx)
	rec := httptest.NewRecorder()

	mw := RequireAnyPermission("users.manage", "system.settings")
	mw(http.HandlerFunc(okHandler)).ServeHTTP(rec, req)

	assert.Equal(t, http.StatusForbidden, rec.Code)
}

func TestRBACMiddleware_APIKey(t *testing.T) {
	rbac := NewRBACMiddleware(nil, nil, "test-api-key")

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("X-API-Key", "test-api-key")
	rec := httptest.NewRecorder()

	rbac.Authenticate(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Should have wildcard permissions
		perms := PermissionsFromContext(r.Context())
		require.Len(t, perms, 1)
		assert.Equal(t, "*", perms[0])

		uid := UserIDFromContext(r.Context())
		assert.Equal(t, "api-key", uid)

		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})).ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestRBACMiddleware_NoAuth(t *testing.T) {
	rbac := NewRBACMiddleware(nil, nil, "test-api-key")

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	rec := httptest.NewRecorder()

	rbac.Authenticate(http.HandlerFunc(okHandler)).ServeHTTP(rec, req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestRBACMiddleware_WrongAPIKey(t *testing.T) {
	rbac := NewRBACMiddleware(nil, nil, "test-api-key")

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("X-API-Key", "wrong-key")
	rec := httptest.NewRecorder()

	rbac.Authenticate(http.HandlerFunc(okHandler)).ServeHTTP(rec, req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestHasPermission(t *testing.T) {
	ctx := context.WithValue(context.Background(), permissionsKey, []string{"routes.view", "stops.edit"})

	assert.True(t, HasPermission(ctx, "routes.view"))
	assert.True(t, HasPermission(ctx, "stops.edit"))
	assert.False(t, HasPermission(ctx, "users.manage"))
}
