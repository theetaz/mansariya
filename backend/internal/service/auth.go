package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"
	"unicode"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/masariya/backend/internal/model"
)

var (
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrAccountDisabled    = errors.New("account is disabled")
	ErrAccountLocked      = errors.New("account is temporarily locked")
	ErrAccountNotActive   = errors.New("account is not active")
	ErrInvalidToken       = errors.New("invalid or expired token")
	ErrWeakPassword       = errors.New("password does not meet requirements")
)

// AuthStoreInterface abstracts the auth store to avoid import cycles.
type AuthStoreInterface interface {
	GetUserByID(ctx context.Context, id string) (*model.User, error)
	GetUserByEmail(ctx context.Context, email string) (*model.User, error)
	GetUserByInviteToken(ctx context.Context, token string) (*model.User, error)
	GetUserByResetToken(ctx context.Context, token string) (*model.User, error)
	CreateUser(ctx context.Context, u *model.User) error
	UpdateUser(ctx context.Context, u *model.User) error

	ListUsers(ctx context.Context) ([]model.User, error)
	ListUsersFiltered(ctx context.Context, search, status, sortBy, sortDir string, limit, offset int) ([]model.User, int, error)

	GetUserRoles(ctx context.Context, userID string) ([]model.Role, error)
	ListRoles(ctx context.Context) ([]model.Role, error)
	CreateRole(ctx context.Context, slug, name, description string) (*model.Role, error)
	UpdateRole(ctx context.Context, id, name, description string) error
	DeleteRole(ctx context.Context, id string) error
	GetRolePermissions(ctx context.Context, roleID string) ([]model.Permission, error)
	SetRolePermissions(ctx context.Context, roleID string, permissionIDs []string) error
	ListPermissions(ctx context.Context) ([]model.Permission, error)
	AssignRole(ctx context.Context, userID, roleID string, assignedBy *string) error
	RemoveRole(ctx context.Context, userID, roleID string) error
	GetUserPermissions(ctx context.Context, userID string) ([]string, error)

	IsUserLocked(ctx context.Context, userID string) (bool, error)
	RecordFailedLogin(ctx context.Context, userID string) error
	ResetFailedLogins(ctx context.Context, userID string) error

	CreateSession(ctx context.Context, sess *model.Session) error
	GetSessionByTokenHash(ctx context.Context, tokenHash string) (*model.Session, error)
	GetSessionByID(ctx context.Context, sessionID string) (*model.Session, error)
	ListUserSessions(ctx context.Context, userID string) ([]model.Session, error)
	DeleteSession(ctx context.Context, sessionID string) error
	DeleteOtherSessions(ctx context.Context, userID, keepSessionID string) (int64, error)
	DeleteUserSessions(ctx context.Context, userID string) error
}

type TokenPair struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresAt    time.Time `json:"expires_at"`
}

type AuthClaims struct {
	UserID string `json:"uid"`
	Email  string `json:"email"`
	jwt.RegisteredClaims
}

type AuthService struct {
	store              AuthStoreInterface
	jwtSecret          []byte
	accessTokenExpiry  time.Duration
	refreshTokenExpiry time.Duration
}

func NewAuthService(authStore AuthStoreInterface, jwtSecret string, accessExpiryMin, refreshExpiryHr int) *AuthService {
	return &AuthService{
		store:              authStore,
		jwtSecret:          []byte(jwtSecret),
		accessTokenExpiry:  time.Duration(accessExpiryMin) * time.Minute,
		refreshTokenExpiry: time.Duration(refreshExpiryHr) * time.Hour,
	}
}

// ── Login ────────────────────────────────────────────────────────────────

func (s *AuthService) Login(ctx context.Context, email, password, ipAddress, userAgent string) (*model.User, *TokenPair, error) {
	user, err := s.store.GetUserByEmail(ctx, email)
	if err != nil {
		// Don't leak whether user exists
		return nil, nil, ErrInvalidCredentials
	}

	// Check if account is disabled
	if user.Status == model.UserStatusDisabled {
		return nil, nil, ErrAccountDisabled
	}

	// Check if account is not yet activated
	if user.Status == model.UserStatusInvited {
		return nil, nil, ErrAccountNotActive
	}

	// Check if account is locked
	locked, err := s.store.IsUserLocked(ctx, user.ID)
	if err != nil {
		return nil, nil, fmt.Errorf("check lock: %w", err)
	}
	if locked {
		return nil, nil, ErrAccountLocked
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		_ = s.store.RecordFailedLogin(ctx, user.ID)
		return nil, nil, ErrInvalidCredentials
	}

	// Success — reset failed attempts and record login
	if err := s.store.ResetFailedLogins(ctx, user.ID); err != nil {
		return nil, nil, fmt.Errorf("reset login tracking: %w", err)
	}

	// Generate tokens
	tokens, err := s.createTokenPair(ctx, user, ipAddress, userAgent)
	if err != nil {
		return nil, nil, fmt.Errorf("create tokens: %w", err)
	}

	// Load roles
	roles, err := s.store.GetUserRoles(ctx, user.ID)
	if err != nil {
		return nil, nil, fmt.Errorf("get roles: %w", err)
	}
	user.Roles = roles

	return user, tokens, nil
}

// ── Token management ─────────────────────────────────────────────────────

func (s *AuthService) createTokenPair(ctx context.Context, user *model.User, ipAddress, userAgent string) (*TokenPair, error) {
	now := time.Now()
	accessExpiry := now.Add(s.accessTokenExpiry)

	// Create access token (JWT)
	claims := &AuthClaims{
		UserID: user.ID,
		Email:  user.Email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(accessExpiry),
			IssuedAt:  jwt.NewNumericDate(now),
			Subject:   user.ID,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	accessToken, err := token.SignedString(s.jwtSecret)
	if err != nil {
		return nil, fmt.Errorf("sign access token: %w", err)
	}

	// Create refresh token (random + stored in DB)
	refreshToken, err := generateSecureToken(32)
	if err != nil {
		return nil, fmt.Errorf("generate refresh token: %w", err)
	}

	refreshExpiry := now.Add(s.refreshTokenExpiry)
	sess := &model.Session{
		UserID:    user.ID,
		TokenHash: hashToken(refreshToken),
		IPAddress: ipAddress,
		UserAgent: userAgent,
		ExpiresAt: refreshExpiry,
	}
	if err := s.store.CreateSession(ctx, sess); err != nil {
		return nil, fmt.Errorf("create session: %w", err)
	}

	return &TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresAt:    accessExpiry,
	}, nil
}

// RefreshTokens validates a refresh token and issues a new token pair.
func (s *AuthService) RefreshTokens(ctx context.Context, refreshToken, ipAddress, userAgent string) (*model.User, *TokenPair, error) {
	sess, err := s.store.GetSessionByTokenHash(ctx, hashToken(refreshToken))
	if err != nil {
		return nil, nil, fmt.Errorf("get session: %w", err)
	}
	if sess == nil {
		return nil, nil, ErrInvalidToken
	}

	user, err := s.store.GetUserByID(ctx, sess.UserID)
	if err != nil {
		return nil, nil, fmt.Errorf("get user: %w", err)
	}
	if user.Status != model.UserStatusActive {
		_ = s.store.DeleteSession(ctx, sess.ID)
		return nil, nil, ErrAccountDisabled
	}

	// Delete old session (rotation)
	if err := s.store.DeleteSession(ctx, sess.ID); err != nil {
		return nil, nil, fmt.Errorf("delete old session: %w", err)
	}

	// Issue new pair
	tokens, err := s.createTokenPair(ctx, user, ipAddress, userAgent)
	if err != nil {
		return nil, nil, fmt.Errorf("create tokens: %w", err)
	}

	roles, err := s.store.GetUserRoles(ctx, user.ID)
	if err != nil {
		return nil, nil, fmt.Errorf("get roles: %w", err)
	}
	user.Roles = roles

	return user, tokens, nil
}

// ValidateAccessToken parses and validates a JWT access token.
func (s *AuthService) ValidateAccessToken(tokenStr string) (*AuthClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &AuthClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return s.jwtSecret, nil
	})
	if err != nil {
		return nil, ErrInvalidToken
	}

	claims, ok := token.Claims.(*AuthClaims)
	if !ok || !token.Valid {
		return nil, ErrInvalidToken
	}
	return claims, nil
}

// ── Session management ───────────────────────────────────────────────────

// ListSessions returns all active sessions for a user.
func (s *AuthService) ListSessions(ctx context.Context, userID string) ([]model.Session, error) {
	sessions, err := s.store.ListUserSessions(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list sessions: %w", err)
	}
	return sessions, nil
}

// RevokeSession deletes a specific session. Only the session owner can revoke.
func (s *AuthService) RevokeSession(ctx context.Context, userID, sessionID string) error {
	sess, err := s.store.GetSessionByID(ctx, sessionID)
	if err != nil {
		return fmt.Errorf("get session: %w", err)
	}
	if sess == nil || sess.UserID != userID {
		return ErrInvalidToken
	}
	return s.store.DeleteSession(ctx, sess.ID)
}

// RevokeOtherSessions deletes all sessions except the one identified by currentRefreshToken.
func (s *AuthService) RevokeOtherSessions(ctx context.Context, userID, currentRefreshToken string) (int64, error) {
	sess, err := s.store.GetSessionByTokenHash(ctx, hashToken(currentRefreshToken))
	if err != nil {
		return 0, fmt.Errorf("get current session: %w", err)
	}
	if sess == nil || sess.UserID != userID {
		return 0, ErrInvalidToken
	}

	count, err := s.store.DeleteOtherSessions(ctx, userID, sess.ID)
	if err != nil {
		return 0, fmt.Errorf("delete other sessions: %w", err)
	}
	return count, nil
}

// ValidateWSToken validates a JWT for WebSocket connections (satisfies handler.WSTokenValidator).
func (s *AuthService) ValidateWSToken(token string) error {
	_, err := s.ValidateAccessToken(token)
	return err
}

// Logout deletes the session for the given refresh token.
func (s *AuthService) Logout(ctx context.Context, refreshToken string) error {
	sess, err := s.store.GetSessionByTokenHash(ctx, hashToken(refreshToken))
	if err != nil {
		return fmt.Errorf("get session: %w", err)
	}
	if sess == nil {
		return nil // already logged out
	}
	return s.store.DeleteSession(ctx, sess.ID)
}

// ── Current user ─────────────────────────────────────────────────────────

func (s *AuthService) GetCurrentUser(ctx context.Context, userID string) (*model.User, []string, error) {
	user, err := s.store.GetUserByID(ctx, userID)
	if err != nil {
		return nil, nil, fmt.Errorf("get user: %w", err)
	}

	roles, err := s.store.GetUserRoles(ctx, user.ID)
	if err != nil {
		return nil, nil, fmt.Errorf("get roles: %w", err)
	}
	user.Roles = roles

	perms, err := s.store.GetUserPermissions(ctx, user.ID)
	if err != nil {
		return nil, nil, fmt.Errorf("get permissions: %w", err)
	}

	return user, perms, nil
}

// ── Invite flow ──────────────────────────────────────────────────────────

func (s *AuthService) InviteUser(ctx context.Context, email, displayName string, roleIDs []string, inviterID string) (*model.User, string, error) {
	token, err := generateSecureToken(32)
	if err != nil {
		return nil, "", fmt.Errorf("generate invite token: %w", err)
	}

	expires := time.Now().Add(72 * time.Hour) // 3 days
	u := &model.User{
		Email:           email,
		DisplayName:     displayName,
		Status:          model.UserStatusInvited,
		InviteToken:     &token,
		InviteExpiresAt: &expires,
	}

	if err := s.store.CreateUser(ctx, u); err != nil {
		return nil, "", fmt.Errorf("create invited user: %w", err)
	}

	// Assign roles
	for _, roleID := range roleIDs {
		if err := s.store.AssignRole(ctx, u.ID, roleID, &inviterID); err != nil {
			return nil, "", fmt.Errorf("assign role %s: %w", roleID, err)
		}
	}

	return u, token, nil
}

func (s *AuthService) AcceptInvite(ctx context.Context, token, password string) (*model.User, error) {
	if err := validatePassword(password); err != nil {
		return nil, err
	}

	user, err := s.store.GetUserByInviteToken(ctx, token)
	if err != nil {
		return nil, fmt.Errorf("get invite: %w", err)
	}
	if user == nil {
		return nil, ErrInvalidToken
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}

	user.PasswordHash = string(hash)
	user.Status = model.UserStatusActive
	user.InviteToken = nil
	user.InviteExpiresAt = nil

	if err := s.store.UpdateUser(ctx, user); err != nil {
		return nil, fmt.Errorf("activate user: %w", err)
	}

	return user, nil
}

// ── Password reset ───────────────────────────────────────────────────────

func (s *AuthService) RequestPasswordReset(ctx context.Context, email string) (string, error) {
	user, err := s.store.GetUserByEmail(ctx, email)
	if err != nil {
		// Don't leak whether the user exists — return success silently
		return "", nil
	}
	if user.Status == model.UserStatusDisabled {
		return "", nil
	}

	token, err := generateSecureToken(32)
	if err != nil {
		return "", fmt.Errorf("generate reset token: %w", err)
	}

	expires := time.Now().Add(1 * time.Hour)
	user.PasswordResetToken = &token
	user.PasswordResetExpiresAt = &expires

	if err := s.store.UpdateUser(ctx, user); err != nil {
		return "", fmt.Errorf("save reset token: %w", err)
	}

	return token, nil
}

func (s *AuthService) ResetPassword(ctx context.Context, token, newPassword string) error {
	if err := validatePassword(newPassword); err != nil {
		return err
	}

	user, err := s.store.GetUserByResetToken(ctx, token)
	if err != nil {
		return fmt.Errorf("get reset: %w", err)
	}
	if user == nil {
		return ErrInvalidToken
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}

	user.PasswordHash = string(hash)
	user.PasswordResetToken = nil
	user.PasswordResetExpiresAt = nil

	if err := s.store.UpdateUser(ctx, user); err != nil {
		return fmt.Errorf("update password: %w", err)
	}

	// Invalidate all existing sessions for security
	if err := s.store.DeleteUserSessions(ctx, user.ID); err != nil {
		return fmt.Errorf("invalidate sessions: %w", err)
	}

	return nil
}

// ── Password validation ──────────────────────────────────────────────────

func validatePassword(password string) error {
	if len(password) < 8 {
		return fmt.Errorf("%w: must be at least 8 characters", ErrWeakPassword)
	}
	if len(password) > 128 {
		return fmt.Errorf("%w: must be at most 128 characters", ErrWeakPassword)
	}

	var hasUpper, hasLower, hasDigit bool
	for _, c := range password {
		switch {
		case unicode.IsUpper(c):
			hasUpper = true
		case unicode.IsLower(c):
			hasLower = true
		case unicode.IsDigit(c):
			hasDigit = true
		}
	}

	if !hasUpper || !hasLower || !hasDigit {
		return fmt.Errorf("%w: must contain uppercase, lowercase, and a digit", ErrWeakPassword)
	}
	return nil
}

// ── Helpers ──────────────────────────────────────────────────────────────

func generateSecureToken(bytes int) (string, error) {
	b := make([]byte, bytes)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}
