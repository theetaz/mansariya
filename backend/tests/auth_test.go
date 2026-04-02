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

const testJWTSecret = "test-secret-for-jwt-signing-only"

func testAuthService(t *testing.T) (*service.AuthService, *store.AuthStore) {
	t.Helper()
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		t.Skip("DATABASE_URL not set — skipping integration test")
	}
	pool, err := store.NewPool(context.Background(), dbURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	authStore := store.NewAuthStore(pool)
	svc := service.NewAuthService(authStore, testJWTSecret, 15, 168)
	return svc, authStore
}

func cleanupAuth(t *testing.T, s *store.AuthStore) {
	t.Helper()
	s.CleanupTestData(context.Background())
}

func createTestUser(t *testing.T, s *store.AuthStore, email, password string) *model.User {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	require.NoError(t, err)

	u := &model.User{
		Email:        email,
		PasswordHash: string(hash),
		DisplayName:  "Test User",
		Status:       model.UserStatusActive,
	}
	require.NoError(t, s.CreateUser(context.Background(), u))
	return u
}

func TestLogin_Valid(t *testing.T) {
	svc, authStore := testAuthService(t)
	cleanupAuth(t, authStore)
	t.Cleanup(func() { cleanupAuth(t, authStore) })

	createTestUser(t, authStore, "login@test.lk", "Test1234")

	user, tokens, err := svc.Login(context.Background(), "login@test.lk", "Test1234", "127.0.0.1", "test-agent")
	require.NoError(t, err)
	assert.NotNil(t, user)
	assert.Equal(t, "login@test.lk", user.Email)
	assert.NotEmpty(t, tokens.AccessToken)
	assert.NotEmpty(t, tokens.RefreshToken)

	// Validate the access token
	claims, err := svc.ValidateAccessToken(tokens.AccessToken)
	require.NoError(t, err)
	assert.Equal(t, user.ID, claims.UserID)
}

func TestLogin_InvalidPassword(t *testing.T) {
	svc, authStore := testAuthService(t)
	cleanupAuth(t, authStore)
	t.Cleanup(func() { cleanupAuth(t, authStore) })

	createTestUser(t, authStore, "invalid@test.lk", "Test1234")

	_, _, err := svc.Login(context.Background(), "invalid@test.lk", "WrongPassword1", "127.0.0.1", "test-agent")
	assert.ErrorIs(t, err, service.ErrInvalidCredentials)
}

func TestLogin_NonExistentUser(t *testing.T) {
	svc, authStore := testAuthService(t)
	cleanupAuth(t, authStore)
	t.Cleanup(func() { cleanupAuth(t, authStore) })

	_, _, err := svc.Login(context.Background(), "nobody@test.lk", "Test1234", "127.0.0.1", "test-agent")
	assert.ErrorIs(t, err, service.ErrInvalidCredentials)
}

func TestLogin_DisabledUser(t *testing.T) {
	svc, authStore := testAuthService(t)
	cleanupAuth(t, authStore)
	t.Cleanup(func() { cleanupAuth(t, authStore) })

	u := createTestUser(t, authStore, "disabled@test.lk", "Test1234")
	u.Status = model.UserStatusDisabled
	require.NoError(t, authStore.UpdateUser(context.Background(), u))

	_, _, err := svc.Login(context.Background(), "disabled@test.lk", "Test1234", "127.0.0.1", "test-agent")
	assert.ErrorIs(t, err, service.ErrAccountDisabled)
}

func TestLogin_InvitedUser(t *testing.T) {
	svc, authStore := testAuthService(t)
	cleanupAuth(t, authStore)
	t.Cleanup(func() { cleanupAuth(t, authStore) })

	u := &model.User{
		Email:       "invited@test.lk",
		DisplayName: "Invited",
		Status:      model.UserStatusInvited,
	}
	require.NoError(t, authStore.CreateUser(context.Background(), u))

	_, _, err := svc.Login(context.Background(), "invited@test.lk", "Test1234", "127.0.0.1", "test-agent")
	assert.ErrorIs(t, err, service.ErrAccountNotActive)
}

func TestLogin_AccountLockout(t *testing.T) {
	svc, authStore := testAuthService(t)
	cleanupAuth(t, authStore)
	t.Cleanup(func() { cleanupAuth(t, authStore) })

	createTestUser(t, authStore, "lockout@test.lk", "Test1234")

	// 5 failed attempts should lock the account
	for i := 0; i < 5; i++ {
		_, _, err := svc.Login(context.Background(), "lockout@test.lk", "WrongPass1", "127.0.0.1", "test-agent")
		assert.ErrorIs(t, err, service.ErrInvalidCredentials)
	}

	// Next attempt should be locked
	_, _, err := svc.Login(context.Background(), "lockout@test.lk", "Test1234", "127.0.0.1", "test-agent")
	assert.ErrorIs(t, err, service.ErrAccountLocked)
}

func TestRefreshTokens(t *testing.T) {
	svc, authStore := testAuthService(t)
	cleanupAuth(t, authStore)
	t.Cleanup(func() { cleanupAuth(t, authStore) })

	createTestUser(t, authStore, "refresh@test.lk", "Test1234")

	_, tokens, err := svc.Login(context.Background(), "refresh@test.lk", "Test1234", "127.0.0.1", "test-agent")
	require.NoError(t, err)

	// Refresh
	user, newTokens, err := svc.RefreshTokens(context.Background(), tokens.RefreshToken, "127.0.0.1", "test-agent")
	require.NoError(t, err)
	assert.Equal(t, "refresh@test.lk", user.Email)
	assert.NotEmpty(t, newTokens.AccessToken)
	assert.NotEqual(t, tokens.RefreshToken, newTokens.RefreshToken, "refresh token must rotate")

	// Old refresh token should no longer work (rotation)
	_, _, err = svc.RefreshTokens(context.Background(), tokens.RefreshToken, "127.0.0.1", "test-agent")
	assert.ErrorIs(t, err, service.ErrInvalidToken)
}

func TestLogout(t *testing.T) {
	svc, authStore := testAuthService(t)
	cleanupAuth(t, authStore)
	t.Cleanup(func() { cleanupAuth(t, authStore) })

	createTestUser(t, authStore, "logout@test.lk", "Test1234")

	_, tokens, err := svc.Login(context.Background(), "logout@test.lk", "Test1234", "127.0.0.1", "test-agent")
	require.NoError(t, err)

	require.NoError(t, svc.Logout(context.Background(), tokens.RefreshToken))

	_, _, err = svc.RefreshTokens(context.Background(), tokens.RefreshToken, "127.0.0.1", "test-agent")
	assert.ErrorIs(t, err, service.ErrInvalidToken)
}

func TestInviteAndAccept(t *testing.T) {
	svc, authStore := testAuthService(t)
	cleanupAuth(t, authStore)
	t.Cleanup(func() { cleanupAuth(t, authStore) })

	inviter := createTestUser(t, authStore, "inviter@test.lk", "Test1234")

	editorRole, err := authStore.GetRoleBySlug(context.Background(), model.RoleEditor)
	require.NoError(t, err)

	// Invite
	invited, token, err := svc.InviteUser(context.Background(), "newhire@test.lk", "New Hire", []string{editorRole.ID}, inviter.ID)
	require.NoError(t, err)
	assert.Equal(t, model.UserStatusInvited, invited.Status)
	assert.NotEmpty(t, token)

	// Accept
	accepted, err := svc.AcceptInvite(context.Background(), token, "NewPass123")
	require.NoError(t, err)
	assert.Equal(t, model.UserStatusActive, accepted.Status)

	// Token used — second accept should fail
	_, err = svc.AcceptInvite(context.Background(), token, "NewPass123")
	assert.ErrorIs(t, err, service.ErrInvalidToken)

	// Can login
	user, _, err := svc.Login(context.Background(), "newhire@test.lk", "NewPass123", "127.0.0.1", "test-agent")
	require.NoError(t, err)
	assert.Equal(t, "newhire@test.lk", user.Email)
}

func TestPasswordReset(t *testing.T) {
	svc, authStore := testAuthService(t)
	cleanupAuth(t, authStore)
	t.Cleanup(func() { cleanupAuth(t, authStore) })

	createTestUser(t, authStore, "reset@test.lk", "OldPass123")

	token, err := svc.RequestPasswordReset(context.Background(), "reset@test.lk")
	require.NoError(t, err)
	assert.NotEmpty(t, token)

	require.NoError(t, svc.ResetPassword(context.Background(), token, "NewPass456"))

	// Old password fails
	_, _, err = svc.Login(context.Background(), "reset@test.lk", "OldPass123", "127.0.0.1", "test-agent")
	assert.ErrorIs(t, err, service.ErrInvalidCredentials)

	// New password works
	_, _, err = svc.Login(context.Background(), "reset@test.lk", "NewPass456", "127.0.0.1", "test-agent")
	require.NoError(t, err)

	// Same token is consumed
	err = svc.ResetPassword(context.Background(), token, "Another789")
	assert.ErrorIs(t, err, service.ErrInvalidToken)
}

func TestPasswordResetNonExistentUser(t *testing.T) {
	svc, authStore := testAuthService(t)
	cleanupAuth(t, authStore)
	t.Cleanup(func() { cleanupAuth(t, authStore) })

	token, err := svc.RequestPasswordReset(context.Background(), "nobody@test.lk")
	require.NoError(t, err)
	assert.Empty(t, token)
}

func TestValidateAccessToken(t *testing.T) {
	svc, authStore := testAuthService(t)
	cleanupAuth(t, authStore)
	t.Cleanup(func() { cleanupAuth(t, authStore) })

	createTestUser(t, authStore, "jwt@test.lk", "Test1234")

	_, tokens, err := svc.Login(context.Background(), "jwt@test.lk", "Test1234", "127.0.0.1", "test-agent")
	require.NoError(t, err)

	claims, err := svc.ValidateAccessToken(tokens.AccessToken)
	require.NoError(t, err)
	assert.Equal(t, "jwt@test.lk", claims.Email)

	_, err = svc.ValidateAccessToken(tokens.AccessToken + "tampered")
	assert.ErrorIs(t, err, service.ErrInvalidToken)

	wrongSvc := service.NewAuthService(authStore, "wrong-secret", 15, 168)
	_, err = wrongSvc.ValidateAccessToken(tokens.AccessToken)
	assert.ErrorIs(t, err, service.ErrInvalidToken)
}
