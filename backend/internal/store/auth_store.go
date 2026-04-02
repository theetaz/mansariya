package store

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/masariya/backend/internal/model"
)

type AuthStore struct {
	pool *pgxpool.Pool
}

func NewAuthStore(pool *pgxpool.Pool) *AuthStore {
	return &AuthStore{pool: pool}
}

// ── Users ────────────────────────────────────────────────────────────────

func (s *AuthStore) CreateUser(ctx context.Context, u *model.User) error {
	err := s.pool.QueryRow(ctx,
		`INSERT INTO users (email, password_hash, display_name, status, invite_token, invite_expires_at)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, created_at, updated_at`,
		u.Email, u.PasswordHash, u.DisplayName, u.Status, u.InviteToken, u.InviteExpiresAt,
	).Scan(&u.ID, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return fmt.Errorf("create user: %w", err)
	}
	return nil
}

func (s *AuthStore) GetUserByID(ctx context.Context, id string) (*model.User, error) {
	var u model.User
	err := s.pool.QueryRow(ctx,
		`SELECT id, email, password_hash, display_name, status,
		        invite_token, invite_expires_at,
		        password_reset_token, password_reset_expires_at,
		        last_login_at, created_at, updated_at
		 FROM users WHERE id = $1`, id,
	).Scan(
		&u.ID, &u.Email, &u.PasswordHash, &u.DisplayName, &u.Status,
		&u.InviteToken, &u.InviteExpiresAt,
		&u.PasswordResetToken, &u.PasswordResetExpiresAt,
		&u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("get user by id: %w", err)
	}
	return &u, nil
}

func (s *AuthStore) GetUserByEmail(ctx context.Context, email string) (*model.User, error) {
	var u model.User
	err := s.pool.QueryRow(ctx,
		`SELECT id, email, password_hash, display_name, status,
		        invite_token, invite_expires_at,
		        password_reset_token, password_reset_expires_at,
		        last_login_at, created_at, updated_at
		 FROM users WHERE email = $1`, email,
	).Scan(
		&u.ID, &u.Email, &u.PasswordHash, &u.DisplayName, &u.Status,
		&u.InviteToken, &u.InviteExpiresAt,
		&u.PasswordResetToken, &u.PasswordResetExpiresAt,
		&u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("get user by email: %w", err)
	}
	return &u, nil
}

func (s *AuthStore) UpdateUser(ctx context.Context, u *model.User) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE users SET
			email = $2, password_hash = $3, display_name = $4, status = $5,
			invite_token = $6, invite_expires_at = $7,
			password_reset_token = $8, password_reset_expires_at = $9,
			last_login_at = $10, updated_at = NOW()
		 WHERE id = $1`,
		u.ID, u.Email, u.PasswordHash, u.DisplayName, u.Status,
		u.InviteToken, u.InviteExpiresAt,
		u.PasswordResetToken, u.PasswordResetExpiresAt,
		u.LastLoginAt,
	)
	if err != nil {
		return fmt.Errorf("update user: %w", err)
	}
	return nil
}

func (s *AuthStore) ListUsers(ctx context.Context) ([]model.User, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, email, display_name, status, last_login_at, created_at, updated_at
		 FROM users ORDER BY created_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("list users: %w", err)
	}
	defer rows.Close()

	var users []model.User
	for rows.Next() {
		var u model.User
		if err := rows.Scan(&u.ID, &u.Email, &u.DisplayName, &u.Status, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan user: %w", err)
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

// ── Roles ────────────────────────────────────────────────────────────────

func (s *AuthStore) GetRoleBySlug(ctx context.Context, slug string) (*model.Role, error) {
	var r model.Role
	err := s.pool.QueryRow(ctx,
		`SELECT id, slug, name, description, is_system, created_at, updated_at
		 FROM roles WHERE slug = $1`, slug,
	).Scan(&r.ID, &r.Slug, &r.Name, &r.Description, &r.IsSystem, &r.CreatedAt, &r.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("get role by slug: %w", err)
	}
	return &r, nil
}

func (s *AuthStore) ListRoles(ctx context.Context) ([]model.Role, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, slug, name, description, is_system, created_at, updated_at
		 FROM roles ORDER BY slug`)
	if err != nil {
		return nil, fmt.Errorf("list roles: %w", err)
	}
	defer rows.Close()

	var roles []model.Role
	for rows.Next() {
		var r model.Role
		if err := rows.Scan(&r.ID, &r.Slug, &r.Name, &r.Description, &r.IsSystem, &r.CreatedAt, &r.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan role: %w", err)
		}
		roles = append(roles, r)
	}
	return roles, rows.Err()
}

// ── User-Role assignments ────────────────────────────────────────────────

func (s *AuthStore) AssignRole(ctx context.Context, userID, roleID string, assignedBy *string) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO user_roles (user_id, role_id, assigned_by)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (user_id, role_id) DO NOTHING`,
		userID, roleID, assignedBy,
	)
	if err != nil {
		return fmt.Errorf("assign role: %w", err)
	}
	return nil
}

func (s *AuthStore) RemoveRole(ctx context.Context, userID, roleID string) error {
	_, err := s.pool.Exec(ctx,
		`DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2`,
		userID, roleID,
	)
	if err != nil {
		return fmt.Errorf("remove role: %w", err)
	}
	return nil
}

func (s *AuthStore) GetUserRoles(ctx context.Context, userID string) ([]model.Role, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT r.id, r.slug, r.name, r.description, r.is_system, r.created_at, r.updated_at
		 FROM roles r
		 JOIN user_roles ur ON ur.role_id = r.id
		 WHERE ur.user_id = $1
		 ORDER BY r.slug`, userID,
	)
	if err != nil {
		return nil, fmt.Errorf("get user roles: %w", err)
	}
	defer rows.Close()

	var roles []model.Role
	for rows.Next() {
		var r model.Role
		if err := rows.Scan(&r.ID, &r.Slug, &r.Name, &r.Description, &r.IsSystem, &r.CreatedAt, &r.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan role: %w", err)
		}
		roles = append(roles, r)
	}
	return roles, rows.Err()
}

// ── Permissions ──────────────────────────────────────────────────────────

func (s *AuthStore) GetUserPermissions(ctx context.Context, userID string) ([]string, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT DISTINCT p.slug
		 FROM permissions p
		 JOIN role_permissions rp ON rp.permission_id = p.id
		 JOIN user_roles ur ON ur.role_id = rp.role_id
		 WHERE ur.user_id = $1
		 ORDER BY p.slug`, userID,
	)
	if err != nil {
		return nil, fmt.Errorf("get user permissions: %w", err)
	}
	defer rows.Close()

	var perms []string
	for rows.Next() {
		var slug string
		if err := rows.Scan(&slug); err != nil {
			return nil, fmt.Errorf("scan permission: %w", err)
		}
		perms = append(perms, slug)
	}
	return perms, rows.Err()
}

func (s *AuthStore) ListPermissions(ctx context.Context) ([]model.Permission, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, slug, name, family, COALESCE(description, ''), created_at
		 FROM permissions ORDER BY family, slug`)
	if err != nil {
		return nil, fmt.Errorf("list permissions: %w", err)
	}
	defer rows.Close()

	var perms []model.Permission
	for rows.Next() {
		var p model.Permission
		if err := rows.Scan(&p.ID, &p.Slug, &p.Name, &p.Family, &p.Description, &p.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan permission: %w", err)
		}
		perms = append(perms, p)
	}
	return perms, rows.Err()
}

// ── Bootstrap ────────────────────────────────────────────────────────────

// BootstrapSuperAdmin creates the first super admin user if no users exist.
// Returns the created user or nil if users already exist.
func (s *AuthStore) BootstrapSuperAdmin(ctx context.Context, email, passwordHash, displayName string) (*model.User, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// Only bootstrap if no users exist
	var count int
	err = tx.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&count)
	if err != nil {
		return nil, fmt.Errorf("count users: %w", err)
	}
	if count > 0 {
		return nil, nil
	}

	// Create the user
	var u model.User
	err = tx.QueryRow(ctx,
		`INSERT INTO users (email, password_hash, display_name, status)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, email, display_name, status, created_at, updated_at`,
		email, passwordHash, displayName, model.UserStatusActive,
	).Scan(&u.ID, &u.Email, &u.DisplayName, &u.Status, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("create bootstrap user: %w", err)
	}

	// Assign super_admin role
	_, err = tx.Exec(ctx,
		`INSERT INTO user_roles (user_id, role_id)
		 SELECT $1, id FROM roles WHERE slug = $2`,
		u.ID, model.RoleSuperAdmin,
	)
	if err != nil {
		return nil, fmt.Errorf("assign super_admin role: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit bootstrap: %w", err)
	}

	return &u, nil
}

// UserExists checks if any user exists in the database.
func (s *AuthStore) UserExists(ctx context.Context) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users)`).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("check user exists: %w", err)
	}
	return exists, nil
}

// GetUserByInviteToken retrieves a user by their invite token.
func (s *AuthStore) GetUserByInviteToken(ctx context.Context, token string) (*model.User, error) {
	var u model.User
	err := s.pool.QueryRow(ctx,
		`SELECT id, email, password_hash, display_name, status,
		        invite_token, invite_expires_at,
		        password_reset_token, password_reset_expires_at,
		        last_login_at, created_at, updated_at
		 FROM users
		 WHERE invite_token = $1 AND invite_expires_at > NOW()`, token,
	).Scan(
		&u.ID, &u.Email, &u.PasswordHash, &u.DisplayName, &u.Status,
		&u.InviteToken, &u.InviteExpiresAt,
		&u.PasswordResetToken, &u.PasswordResetExpiresAt,
		&u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get user by invite token: %w", err)
	}
	return &u, nil
}
