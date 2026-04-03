package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/masariya/backend/internal/model"
)

var (
	ErrContributorNotFound  = errors.New("contributor not found")
	ErrContributorNotClaimed = errors.New("contributor has not been claimed")
	ErrAlreadyClaimed       = errors.New("contributor is already claimed")
	ErrDisplayNameTaken     = errors.New("display name is already taken")
)

// ContributorStoreInterface abstracts the contributor store to avoid import cycles.
type ContributorStoreInterface interface {
	GetByContributorID(ctx context.Context, contributorID string) (*model.Contributor, error)
	GetByDisplayName(ctx context.Context, displayName string) (*model.Contributor, error)
	ClaimContributor(ctx context.Context, contributorID, displayName, passwordHash string) error
	CreateSession(ctx context.Context, sess *model.ContributorSession) error
	GetSessionByTokenHash(ctx context.Context, tokenHash string) (*model.ContributorSession, error)
	DeleteSession(ctx context.Context, sessionID string) error
}

type ContributorClaims struct {
	ContributorID string `json:"cid"`
	Domain        string `json:"domain"` // always "contributor"
	jwt.RegisteredClaims
}

type ContributorTokenPair struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresAt    time.Time `json:"expires_at"`
}

type ContributorAuthService struct {
	store              ContributorStoreInterface
	jwtSecret          []byte
	accessTokenExpiry  time.Duration
	refreshTokenExpiry time.Duration
}

func NewContributorAuthService(cs ContributorStoreInterface, jwtSecret string, accessExpiryMin, refreshExpiryHr int) *ContributorAuthService {
	return &ContributorAuthService{
		store:              cs,
		jwtSecret:          []byte(jwtSecret),
		accessTokenExpiry:  time.Duration(accessExpiryMin) * time.Minute,
		refreshTokenExpiry: time.Duration(refreshExpiryHr) * time.Hour,
	}
}

// ── Claim ────────────────────────────────────────────────────────────────

func (s *ContributorAuthService) Claim(ctx context.Context, contributorID, displayName, password string) (*model.Contributor, error) {
	c, err := s.store.GetByContributorID(ctx, contributorID)
	if err != nil {
		return nil, fmt.Errorf("get contributor: %w", err)
	}
	if c == nil {
		return nil, ErrContributorNotFound
	}
	if c.Status == model.ContributorStatusClaimed {
		return nil, ErrAlreadyClaimed
	}

	// Check display name uniqueness
	existing, err := s.store.GetByDisplayName(ctx, displayName)
	if err != nil {
		return nil, fmt.Errorf("check display name: %w", err)
	}
	if existing != nil {
		return nil, ErrDisplayNameTaken
	}

	// Hash password
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}

	if err := s.store.ClaimContributor(ctx, contributorID, displayName, string(hash)); err != nil {
		return nil, fmt.Errorf("claim: %w", err)
	}

	// Re-fetch to get updated record
	c, err = s.store.GetByContributorID(ctx, contributorID)
	if err != nil {
		return nil, fmt.Errorf("get claimed contributor: %w", err)
	}
	return c, nil
}

// ── Login ────────────────────────────────────────────────────────────────

func (s *ContributorAuthService) Login(ctx context.Context, displayName, password, ip, ua string) (*model.Contributor, *ContributorTokenPair, error) {
	c, err := s.store.GetByDisplayName(ctx, displayName)
	if err != nil {
		return nil, nil, ErrInvalidCredentials
	}
	if c == nil {
		return nil, nil, ErrInvalidCredentials
	}
	if c.Status != model.ContributorStatusClaimed {
		return nil, nil, ErrContributorNotClaimed
	}

	if err := bcrypt.CompareHashAndPassword([]byte(c.PasswordHash), []byte(password)); err != nil {
		return nil, nil, ErrInvalidCredentials
	}

	tokens, err := s.createTokenPair(ctx, c, ip, ua)
	if err != nil {
		return nil, nil, fmt.Errorf("create tokens: %w", err)
	}

	return c, tokens, nil
}

// ── Token management ─────────────────────────────────────────────────────

func (s *ContributorAuthService) createTokenPair(ctx context.Context, c *model.Contributor, ip, ua string) (*ContributorTokenPair, error) {
	now := time.Now()
	accessExpiry := now.Add(s.accessTokenExpiry)

	claims := &ContributorClaims{
		ContributorID: c.ContributorID,
		Domain:        "contributor",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(accessExpiry),
			IssuedAt:  jwt.NewNumericDate(now),
			Subject:   c.ContributorID,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	accessToken, err := token.SignedString(s.jwtSecret)
	if err != nil {
		return nil, fmt.Errorf("sign access token: %w", err)
	}

	// Refresh token
	refreshBytes := make([]byte, 32)
	if _, err := rand.Read(refreshBytes); err != nil {
		return nil, fmt.Errorf("generate refresh token: %w", err)
	}
	refreshToken := hex.EncodeToString(refreshBytes)
	refreshHash := sha256.Sum256([]byte(refreshToken))

	sess := &model.ContributorSession{
		ContributorID: c.ContributorID,
		TokenHash:     hex.EncodeToString(refreshHash[:]),
		IPAddress:     ip,
		UserAgent:     ua,
		ExpiresAt:     now.Add(s.refreshTokenExpiry),
	}
	if err := s.store.CreateSession(ctx, sess); err != nil {
		return nil, fmt.Errorf("create session: %w", err)
	}

	return &ContributorTokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresAt:    accessExpiry,
	}, nil
}

func (s *ContributorAuthService) ValidateContributorToken(tokenStr string) (*ContributorClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &ContributorClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return s.jwtSecret, nil
	})
	if err != nil {
		return nil, ErrInvalidToken
	}

	claims, ok := token.Claims.(*ContributorClaims)
	if !ok || !token.Valid || claims.Domain != "contributor" {
		return nil, ErrInvalidToken
	}
	return claims, nil
}

func (s *ContributorAuthService) RefreshTokens(ctx context.Context, refreshToken, ip, ua string) (*model.Contributor, *ContributorTokenPair, error) {
	h := sha256.Sum256([]byte(refreshToken))
	tokenHash := hex.EncodeToString(h[:])

	sess, err := s.store.GetSessionByTokenHash(ctx, tokenHash)
	if err != nil {
		return nil, nil, fmt.Errorf("get session: %w", err)
	}
	if sess == nil {
		return nil, nil, ErrInvalidToken
	}

	c, err := s.store.GetByContributorID(ctx, sess.ContributorID)
	if err != nil || c == nil {
		return nil, nil, ErrContributorNotFound
	}

	// Rotate: delete old, create new
	_ = s.store.DeleteSession(ctx, sess.ID)

	tokens, err := s.createTokenPair(ctx, c, ip, ua)
	if err != nil {
		return nil, nil, fmt.Errorf("create tokens: %w", err)
	}

	return c, tokens, nil
}

func (s *ContributorAuthService) Logout(ctx context.Context, refreshToken string) error {
	h := sha256.Sum256([]byte(refreshToken))
	tokenHash := hex.EncodeToString(h[:])

	sess, err := s.store.GetSessionByTokenHash(ctx, tokenHash)
	if err != nil || sess == nil {
		return nil
	}
	return s.store.DeleteSession(ctx, sess.ID)
}

// ValidateWSToken validates a contributor JWT for WebSocket (satisfies WSTokenValidator).
func (s *ContributorAuthService) ValidateWSToken(token string) error {
	_, err := s.ValidateContributorToken(token)
	return err
}
