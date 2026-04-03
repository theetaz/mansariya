package tests

import (
	"context"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/masariya/backend/internal/service"
	"github.com/masariya/backend/internal/store"
)

func testSessionService(t *testing.T) (*service.AuthService, *store.AuthStore) {
	t.Helper()
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		t.Skip("DATABASE_URL not set — skipping integration test")
	}
	pool, err := store.NewPool(context.Background(), dbURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	authStore := store.NewAuthStore(pool)
	svc := service.NewAuthService(authStore, "session-test-secret", 15, 168)
	return svc, authStore
}

func TestMultiSessionLogin(t *testing.T) {
	svc, authStore := testSessionService(t)
	ctx := context.Background()
	authStore.CleanupTestData(ctx)
	defer authStore.CleanupTestData(ctx)

	createTestUser(t, authStore, "multi@session.lk", "Test1234")

	// Login from "browser 1"
	_, tokens1, err := svc.Login(ctx, "multi@session.lk", "Test1234", "10.0.0.1", "Chrome/120")
	require.NoError(t, err)

	// Login from "browser 2"
	_, tokens2, err := svc.Login(ctx, "multi@session.lk", "Test1234", "10.0.0.2", "Firefox/119")
	require.NoError(t, err)

	// List sessions — should see 2
	user, _, err := svc.GetCurrentUser(ctx, tokens1.ExpiresAt.String()) // need user ID
	_ = user
	// Get the user ID from a valid login
	claims1, err := svc.ValidateAccessToken(tokens1.AccessToken)
	require.NoError(t, err)

	sessions, err := svc.ListSessions(ctx, claims1.UserID)
	require.NoError(t, err)
	assert.Len(t, sessions, 2, "should have 2 active sessions")

	// Verify different user agents
	agents := map[string]bool{}
	for _, s := range sessions {
		agents[s.UserAgent] = true
	}
	assert.True(t, agents["Chrome/120"])
	assert.True(t, agents["Firefox/119"])

	// Both refresh tokens should work independently
	_, newTokens1, err := svc.RefreshTokens(ctx, tokens1.RefreshToken, "10.0.0.1", "Chrome/120")
	require.NoError(t, err)
	assert.NotEmpty(t, newTokens1.RefreshToken)

	_, _, err = svc.RefreshTokens(ctx, tokens2.RefreshToken, "10.0.0.2", "Firefox/119")
	require.NoError(t, err)
}

func TestRevokeSpecificSession(t *testing.T) {
	svc, authStore := testSessionService(t)
	ctx := context.Background()
	authStore.CleanupTestData(ctx)
	defer authStore.CleanupTestData(ctx)

	createTestUser(t, authStore, "revoke@session.lk", "Test1234")

	// Login from 2 browsers
	_, tokens1, err := svc.Login(ctx, "revoke@session.lk", "Test1234", "10.0.0.1", "Chrome")
	require.NoError(t, err)
	_, tokens2, err := svc.Login(ctx, "revoke@session.lk", "Test1234", "10.0.0.2", "Firefox")
	require.NoError(t, err)

	claims1, _ := svc.ValidateAccessToken(tokens1.AccessToken)

	// List sessions — should be 2
	sessions, err := svc.ListSessions(ctx, claims1.UserID)
	require.NoError(t, err)
	require.Len(t, sessions, 2)

	// Find the Firefox session and revoke it
	var firefoxSessionID string
	for _, s := range sessions {
		if s.UserAgent == "Firefox" {
			firefoxSessionID = s.ID
		}
	}
	require.NotEmpty(t, firefoxSessionID)

	err = svc.RevokeSession(ctx, claims1.UserID, firefoxSessionID)
	require.NoError(t, err)

	// Firefox refresh should now fail
	_, _, err = svc.RefreshTokens(ctx, tokens2.RefreshToken, "10.0.0.2", "Firefox")
	assert.ErrorIs(t, err, service.ErrInvalidToken)

	// Chrome refresh should still work
	_, _, err = svc.RefreshTokens(ctx, tokens1.RefreshToken, "10.0.0.1", "Chrome")
	require.NoError(t, err)

	// Only 1 session should remain
	sessions, err = svc.ListSessions(ctx, claims1.UserID)
	require.NoError(t, err)
	assert.Len(t, sessions, 1)
}

func TestRevokeOtherSessions(t *testing.T) {
	svc, authStore := testSessionService(t)
	ctx := context.Background()
	authStore.CleanupTestData(ctx)
	defer authStore.CleanupTestData(ctx)

	createTestUser(t, authStore, "others@session.lk", "Test1234")

	// Login from 3 browsers
	_, tokens1, err := svc.Login(ctx, "others@session.lk", "Test1234", "10.0.0.1", "Chrome")
	require.NoError(t, err)
	_, _, err = svc.Login(ctx, "others@session.lk", "Test1234", "10.0.0.2", "Firefox")
	require.NoError(t, err)
	_, _, err = svc.Login(ctx, "others@session.lk", "Test1234", "10.0.0.3", "Safari")
	require.NoError(t, err)

	claims1, _ := svc.ValidateAccessToken(tokens1.AccessToken)

	// Verify 3 sessions
	sessions, err := svc.ListSessions(ctx, claims1.UserID)
	require.NoError(t, err)
	assert.Len(t, sessions, 3)

	// Revoke all OTHER sessions (keep Chrome)
	count, err := svc.RevokeOtherSessions(ctx, claims1.UserID, tokens1.RefreshToken)
	require.NoError(t, err)
	assert.Equal(t, int64(2), count)

	// Only 1 session should remain
	sessions, err = svc.ListSessions(ctx, claims1.UserID)
	require.NoError(t, err)
	assert.Len(t, sessions, 1)
	assert.Equal(t, "Chrome", sessions[0].UserAgent)
}

func TestRefreshTokenReuse(t *testing.T) {
	svc, authStore := testSessionService(t)
	ctx := context.Background()
	authStore.CleanupTestData(ctx)
	defer authStore.CleanupTestData(ctx)

	createTestUser(t, authStore, "reuse@session.lk", "Test1234")

	_, tokens, err := svc.Login(ctx, "reuse@session.lk", "Test1234", "10.0.0.1", "Chrome")
	require.NoError(t, err)
	oldRefresh := tokens.RefreshToken

	// Rotate (use the refresh token)
	_, _, err = svc.RefreshTokens(ctx, oldRefresh, "10.0.0.1", "Chrome")
	require.NoError(t, err)

	// Attempt to reuse the old token — must fail
	_, _, err = svc.RefreshTokens(ctx, oldRefresh, "10.0.0.1", "Chrome")
	assert.ErrorIs(t, err, service.ErrInvalidToken, "reused refresh token must be rejected")
}
