package tests

import (
	"context"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"

	"github.com/masariya/backend/internal/model"
	"github.com/masariya/backend/internal/service"
	"github.com/masariya/backend/internal/store"
)

// TestRBACRolePermissionDifferences verifies that different roles have different
// permission sets, matching what was seeded in the migration.
func TestRBACRolePermissionDifferences(t *testing.T) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		t.Skip("DATABASE_URL not set — skipping integration test")
	}
	pool, err := store.NewPool(context.Background(), dbURL)
	require.NoError(t, err)
	defer pool.Close()

	authStore := store.NewAuthStore(pool)
	svc := service.NewAuthService(authStore, "rbac-test-secret", 15, 168)
	ctx := context.Background()

	authStore.CleanupTestData(ctx)
	defer authStore.CleanupTestData(ctx)

	hash, _ := bcrypt.GenerateFromPassword([]byte("Test1234"), bcrypt.DefaultCost)

	// Create 3 users with different roles
	superAdmin := &model.User{Email: "super@rbac.lk", PasswordHash: string(hash), DisplayName: "Super", Status: model.UserStatusActive}
	require.NoError(t, authStore.CreateUser(ctx, superAdmin))
	saRole, _ := authStore.GetRoleBySlug(ctx, model.RoleSuperAdmin)
	require.NoError(t, authStore.AssignRole(ctx, superAdmin.ID, saRole.ID, nil))

	editor := &model.User{Email: "editor@rbac.lk", PasswordHash: string(hash), DisplayName: "Editor", Status: model.UserStatusActive}
	require.NoError(t, authStore.CreateUser(ctx, editor))
	edRole, _ := authStore.GetRoleBySlug(ctx, model.RoleEditor)
	require.NoError(t, authStore.AssignRole(ctx, editor.ID, edRole.ID, nil))

	mapContrib := &model.User{Email: "map@rbac.lk", PasswordHash: string(hash), DisplayName: "Map", Status: model.UserStatusActive}
	require.NoError(t, authStore.CreateUser(ctx, mapContrib))
	mcRole, _ := authStore.GetRoleBySlug(ctx, model.RoleMapContributor)
	require.NoError(t, authStore.AssignRole(ctx, mapContrib.ID, mcRole.ID, nil))

	// Login each and check permissions via GetCurrentUser
	t.Run("super_admin has all permissions", func(t *testing.T) {
		_, perms, err := svc.GetCurrentUser(ctx, superAdmin.ID)
		require.NoError(t, err)

		permSet := toSet(perms)
		assert.True(t, permSet["routes.create"])
		assert.True(t, permSet["users.manage"])
		assert.True(t, permSet["system.settings"])
		assert.True(t, permSet["map.edit_polyline"])
	})

	t.Run("editor has route/stop/timetable but not user management", func(t *testing.T) {
		_, perms, err := svc.GetCurrentUser(ctx, editor.ID)
		require.NoError(t, err)

		permSet := toSet(perms)
		assert.True(t, permSet["routes.create"])
		assert.True(t, permSet["routes.edit"])
		assert.True(t, permSet["stops.create"])
		assert.True(t, permSet["timetables.edit"])
		assert.True(t, permSet["simulations.manage"])
		// Editor should NOT have these
		assert.False(t, permSet["users.manage"])
		assert.False(t, permSet["system.settings"])
	})

	t.Run("map_contributor has only view + map editing", func(t *testing.T) {
		_, perms, err := svc.GetCurrentUser(ctx, mapContrib.ID)
		require.NoError(t, err)

		permSet := toSet(perms)
		assert.True(t, permSet["routes.view"])
		assert.True(t, permSet["stops.view"])
		assert.True(t, permSet["map.edit_polyline"])
		assert.True(t, permSet["map.edit_stops"])
		// Map contributor should NOT have these
		assert.False(t, permSet["routes.create"])
		assert.False(t, permSet["routes.delete"])
		assert.False(t, permSet["stops.create"])
		assert.False(t, permSet["users.manage"])
		assert.False(t, permSet["simulations.manage"])
	})
}

func toSet(items []string) map[string]bool {
	s := make(map[string]bool, len(items))
	for _, item := range items {
		s[item] = true
	}
	return s
}
