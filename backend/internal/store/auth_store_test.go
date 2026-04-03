package store

import (
	"context"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/masariya/backend/internal/model"
)

// testAuthStore returns an AuthStore connected to the test database.
// Skips the test if DATABASE_URL is not set.
func testAuthStore(t *testing.T) *AuthStore {
	t.Helper()
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		t.Skip("DATABASE_URL not set — skipping integration test")
	}
	pool, err := NewPool(context.Background(), dbURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)
	return NewAuthStore(pool)
}

// cleanupAuthTables removes all auth data for a clean test slate.
func cleanupAuthTables(t *testing.T, s *AuthStore) {
	t.Helper()
	ctx := context.Background()
	_, err := s.pool.Exec(ctx, `DELETE FROM user_roles`)
	require.NoError(t, err)
	_, err = s.pool.Exec(ctx, `DELETE FROM users`)
	require.NoError(t, err)
}

func TestBootstrapSuperAdmin(t *testing.T) {
	s := testAuthStore(t)
	ctx := context.Background()
	cleanupAuthTables(t, s)
	t.Cleanup(func() { cleanupAuthTables(t, s) })

	// First bootstrap should create a user
	user, err := s.BootstrapSuperAdmin(ctx, "admin@test.lk", "$2a$10$fakehash", "Test Admin")
	require.NoError(t, err)
	require.NotNil(t, user)
	assert.Equal(t, "admin@test.lk", user.Email)
	assert.Equal(t, "Test Admin", user.DisplayName)
	assert.Equal(t, model.UserStatusActive, user.Status)
	assert.NotEmpty(t, user.ID)

	// Verify user has super_admin role
	roles, err := s.GetUserRoles(ctx, user.ID)
	require.NoError(t, err)
	require.Len(t, roles, 1)
	assert.Equal(t, model.RoleSuperAdmin, roles[0].Slug)

	// Second bootstrap should be a no-op
	user2, err := s.BootstrapSuperAdmin(ctx, "admin2@test.lk", "$2a$10$fakehash2", "Admin 2")
	require.NoError(t, err)
	assert.Nil(t, user2, "second bootstrap should return nil")
}

func TestCreateAndGetUser(t *testing.T) {
	s := testAuthStore(t)
	ctx := context.Background()
	cleanupAuthTables(t, s)
	t.Cleanup(func() { cleanupAuthTables(t, s) })

	u := &model.User{
		Email:       "test@mansariya.lk",
		DisplayName: "Test User",
		Status:      model.UserStatusInvited,
	}
	err := s.CreateUser(ctx, u)
	require.NoError(t, err)
	assert.NotEmpty(t, u.ID)

	// Get by ID
	got, err := s.GetUserByID(ctx, u.ID)
	require.NoError(t, err)
	assert.Equal(t, u.Email, got.Email)
	assert.Equal(t, model.UserStatusInvited, got.Status)

	// Get by email
	got2, err := s.GetUserByEmail(ctx, u.Email)
	require.NoError(t, err)
	assert.Equal(t, u.ID, got2.ID)
}

func TestAssignMultipleRoles(t *testing.T) {
	s := testAuthStore(t)
	ctx := context.Background()
	cleanupAuthTables(t, s)
	t.Cleanup(func() { cleanupAuthTables(t, s) })

	// Create a user
	u := &model.User{
		Email:       "multi@mansariya.lk",
		DisplayName: "Multi Role User",
		Status:      model.UserStatusActive,
	}
	require.NoError(t, s.CreateUser(ctx, u))

	// Get roles
	editorRole, err := s.GetRoleBySlug(ctx, model.RoleEditor)
	require.NoError(t, err)
	mapRole, err := s.GetRoleBySlug(ctx, model.RoleMapContributor)
	require.NoError(t, err)

	// Assign both
	require.NoError(t, s.AssignRole(ctx, u.ID, editorRole.ID, nil))
	require.NoError(t, s.AssignRole(ctx, u.ID, mapRole.ID, nil))

	// Verify
	roles, err := s.GetUserRoles(ctx, u.ID)
	require.NoError(t, err)
	assert.Len(t, roles, 2)

	// Duplicate assign should be idempotent
	require.NoError(t, s.AssignRole(ctx, u.ID, editorRole.ID, nil))
	roles, err = s.GetUserRoles(ctx, u.ID)
	require.NoError(t, err)
	assert.Len(t, roles, 2, "duplicate assign should not create extra row")
}

func TestUpdateUserStatus(t *testing.T) {
	s := testAuthStore(t)
	ctx := context.Background()
	cleanupAuthTables(t, s)
	t.Cleanup(func() { cleanupAuthTables(t, s) })

	u := &model.User{
		Email:       "status@mansariya.lk",
		DisplayName: "Status User",
		Status:      model.UserStatusActive,
	}
	require.NoError(t, s.CreateUser(ctx, u))

	// Disable user
	u.Status = model.UserStatusDisabled
	require.NoError(t, s.UpdateUser(ctx, u))

	got, err := s.GetUserByID(ctx, u.ID)
	require.NoError(t, err)
	assert.Equal(t, model.UserStatusDisabled, got.Status)

	// Verify roles still intact after status change
	editorRole, err := s.GetRoleBySlug(ctx, model.RoleEditor)
	require.NoError(t, err)
	require.NoError(t, s.AssignRole(ctx, u.ID, editorRole.ID, nil))

	roles, err := s.GetUserRoles(ctx, u.ID)
	require.NoError(t, err)
	assert.Len(t, roles, 1, "disabled user should retain roles")
}

func TestGetUserPermissions(t *testing.T) {
	s := testAuthStore(t)
	ctx := context.Background()
	cleanupAuthTables(t, s)
	t.Cleanup(func() { cleanupAuthTables(t, s) })

	// Bootstrap super admin
	user, err := s.BootstrapSuperAdmin(ctx, "perms@test.lk", "$2a$10$fakehash", "Perms User")
	require.NoError(t, err)
	require.NotNil(t, user)

	// Super admin should have all permissions
	perms, err := s.GetUserPermissions(ctx, user.ID)
	require.NoError(t, err)
	assert.True(t, len(perms) > 0, "super admin should have permissions")

	// Should include key permissions
	permSet := make(map[string]bool)
	for _, p := range perms {
		permSet[p] = true
	}
	assert.True(t, permSet["routes.create"])
	assert.True(t, permSet["users.manage"])
	assert.True(t, permSet["system.settings"])
}

func TestListRolesAndPermissions(t *testing.T) {
	s := testAuthStore(t)
	ctx := context.Background()

	// List roles (seeded by migration)
	roles, err := s.ListRoles(ctx)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(roles), 3, "should have at least 3 seeded roles")

	slugs := make(map[string]bool)
	for _, r := range roles {
		slugs[r.Slug] = true
	}
	assert.True(t, slugs[model.RoleSuperAdmin])
	assert.True(t, slugs[model.RoleEditor])
	assert.True(t, slugs[model.RoleMapContributor])

	// List permissions (seeded by migration)
	perms, err := s.ListPermissions(ctx)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(perms), 20, "should have at least 20 seeded permissions")
}

func TestListUsers(t *testing.T) {
	s := testAuthStore(t)
	ctx := context.Background()
	cleanupAuthTables(t, s)
	t.Cleanup(func() { cleanupAuthTables(t, s) })

	// Create a couple of users
	require.NoError(t, s.CreateUser(ctx, &model.User{
		Email: "a@test.lk", DisplayName: "User A", Status: model.UserStatusActive,
	}))
	require.NoError(t, s.CreateUser(ctx, &model.User{
		Email: "b@test.lk", DisplayName: "User B", Status: model.UserStatusInvited,
	}))

	users, err := s.ListUsers(ctx)
	require.NoError(t, err)
	assert.Len(t, users, 2)
}
