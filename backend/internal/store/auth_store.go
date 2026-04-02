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

// ListUsersFiltered satisfies the service.AuthStoreInterface.
func (s *AuthStore) ListUsersFiltered(ctx context.Context, search, status, sortBy, sortDir string, limit, offset int) ([]model.User, int, error) {
	return s.listUsersFilteredInternal(ctx, UserFilter{
		Search: search, Status: status, SortBy: sortBy, SortDir: sortDir, Limit: limit, Offset: offset,
	})
}

type UserFilter struct {
	Search  string
	Status  string
	SortBy  string
	SortDir string
	Limit   int
	Offset  int
}

func (s *AuthStore) listUsersFilteredInternal(ctx context.Context, f UserFilter) ([]model.User, int, error) {
	if f.Limit <= 0 {
		f.Limit = 15
	}
	if f.Limit > 100 {
		f.Limit = 100
	}

	where := "WHERE 1=1"
	args := []interface{}{}
	n := 0

	if f.Search != "" {
		n++
		where += fmt.Sprintf(" AND (email ILIKE $%d OR display_name ILIKE $%d)", n, n)
		args = append(args, "%"+f.Search+"%")
	}
	if f.Status != "" {
		n++
		where += fmt.Sprintf(" AND status = $%d", n)
		args = append(args, f.Status)
	}

	var total int
	if err := s.pool.QueryRow(ctx, "SELECT COUNT(*) FROM users "+where, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count users: %w", err)
	}

	sortCols := map[string]string{
		"email": "email", "display_name": "display_name",
		"status": "status", "created_at": "created_at", "last_login_at": "last_login_at",
	}
	sortCol := "created_at"
	if col, ok := sortCols[f.SortBy]; ok {
		sortCol = col
	}
	sortDir := "DESC"
	if f.SortDir == "asc" {
		sortDir = "ASC"
	}

	n++
	args = append(args, f.Limit)
	limitP := fmt.Sprintf("$%d", n)
	n++
	args = append(args, f.Offset)
	offsetP := fmt.Sprintf("$%d", n)

	query := fmt.Sprintf(
		`SELECT id, email, display_name, status, last_login_at, created_at, updated_at
		 FROM users %s ORDER BY %s %s LIMIT %s OFFSET %s`,
		where, sortCol, sortDir, limitP, offsetP,
	)

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list users filtered: %w", err)
	}
	defer rows.Close()

	var users []model.User
	for rows.Next() {
		var u model.User
		if err := rows.Scan(&u.ID, &u.Email, &u.DisplayName, &u.Status, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, 0, fmt.Errorf("scan user: %w", err)
		}
		users = append(users, u)
	}
	if users == nil {
		users = []model.User{}
	}
	return users, total, rows.Err()
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

// ── Role CRUD ────────────────────────────────────────────────────────────

func (s *AuthStore) CreateRole(ctx context.Context, slug, name, description string) (*model.Role, error) {
	var r model.Role
	err := s.pool.QueryRow(ctx,
		`INSERT INTO roles (slug, name, description, is_system)
		 VALUES ($1, $2, $3, FALSE)
		 RETURNING id, slug, name, description, is_system, created_at, updated_at`,
		slug, name, description,
	).Scan(&r.ID, &r.Slug, &r.Name, &r.Description, &r.IsSystem, &r.CreatedAt, &r.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("create role: %w", err)
	}
	return &r, nil
}

func (s *AuthStore) UpdateRole(ctx context.Context, id, name, description string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE roles SET name = $2, description = $3, updated_at = NOW() WHERE id = $1 AND is_system = FALSE`,
		id, name, description,
	)
	if err != nil {
		return fmt.Errorf("update role: %w", err)
	}
	return nil
}

func (s *AuthStore) DeleteRole(ctx context.Context, id string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM roles WHERE id = $1 AND is_system = FALSE`, id)
	if err != nil {
		return fmt.Errorf("delete role: %w", err)
	}
	return nil
}

func (s *AuthStore) GetRolePermissions(ctx context.Context, roleID string) ([]model.Permission, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT p.id, p.slug, p.name, p.family, COALESCE(p.description, ''), p.created_at
		 FROM permissions p
		 JOIN role_permissions rp ON rp.permission_id = p.id
		 WHERE rp.role_id = $1
		 ORDER BY p.family, p.slug`, roleID,
	)
	if err != nil {
		return nil, fmt.Errorf("get role permissions: %w", err)
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

func (s *AuthStore) SetRolePermissions(ctx context.Context, roleID string, permissionIDs []string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// Remove all existing
	_, err = tx.Exec(ctx, `DELETE FROM role_permissions WHERE role_id = $1`, roleID)
	if err != nil {
		return fmt.Errorf("clear role permissions: %w", err)
	}

	// Insert new set
	for _, pid := range permissionIDs {
		_, err = tx.Exec(ctx,
			`INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
			roleID, pid,
		)
		if err != nil {
			return fmt.Errorf("assign permission %s: %w", pid, err)
		}
	}

	return tx.Commit(ctx)
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

// GetUserByResetToken retrieves a user by their password reset token.
func (s *AuthStore) GetUserByResetToken(ctx context.Context, token string) (*model.User, error) {
	var u model.User
	err := s.pool.QueryRow(ctx,
		`SELECT id, email, password_hash, display_name, status,
		        invite_token, invite_expires_at,
		        password_reset_token, password_reset_expires_at,
		        last_login_at, created_at, updated_at
		 FROM users
		 WHERE password_reset_token = $1 AND password_reset_expires_at > NOW()`, token,
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
		return nil, fmt.Errorf("get user by reset token: %w", err)
	}
	return &u, nil
}

// ── Login tracking ──────────────────────────────────────────────────────

func (s *AuthStore) RecordFailedLogin(ctx context.Context, userID string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE users SET
			failed_login_attempts = failed_login_attempts + 1,
			locked_until = CASE
				WHEN failed_login_attempts + 1 >= 5 THEN NOW() + INTERVAL '15 minutes'
				ELSE locked_until
			END,
			updated_at = NOW()
		 WHERE id = $1`, userID,
	)
	if err != nil {
		return fmt.Errorf("record failed login: %w", err)
	}
	return nil
}

func (s *AuthStore) ResetFailedLogins(ctx context.Context, userID string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW(), updated_at = NOW()
		 WHERE id = $1`, userID,
	)
	if err != nil {
		return fmt.Errorf("reset failed logins: %w", err)
	}
	return nil
}

func (s *AuthStore) IsUserLocked(ctx context.Context, userID string) (bool, error) {
	var locked bool
	err := s.pool.QueryRow(ctx,
		`SELECT locked_until IS NOT NULL AND locked_until > NOW() FROM users WHERE id = $1`, userID,
	).Scan(&locked)
	if err != nil {
		return false, fmt.Errorf("check user locked: %w", err)
	}
	return locked, nil
}

// ── Sessions ────────────────────────────────────────────────────────────

func (s *AuthStore) CreateSession(ctx context.Context, sess *model.Session) error {
	err := s.pool.QueryRow(ctx,
		`INSERT INTO sessions (user_id, token_hash, ip_address, user_agent, expires_at)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, created_at, last_used_at`,
		sess.UserID, sess.TokenHash, sess.IPAddress, sess.UserAgent, sess.ExpiresAt,
	).Scan(&sess.ID, &sess.CreatedAt, &sess.LastUsedAt)
	if err != nil {
		return fmt.Errorf("create session: %w", err)
	}
	return nil
}

func (s *AuthStore) GetSessionByTokenHash(ctx context.Context, tokenHash string) (*model.Session, error) {
	var sess model.Session
	err := s.pool.QueryRow(ctx,
		`SELECT id, user_id, token_hash, ip_address, user_agent, expires_at, created_at, last_used_at
		 FROM sessions WHERE token_hash = $1 AND expires_at > NOW()`, tokenHash,
	).Scan(&sess.ID, &sess.UserID, &sess.TokenHash, &sess.IPAddress, &sess.UserAgent,
		&sess.ExpiresAt, &sess.CreatedAt, &sess.LastUsedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get session: %w", err)
	}
	return &sess, nil
}

func (s *AuthStore) TouchSession(ctx context.Context, sessionID string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE sessions SET last_used_at = NOW() WHERE id = $1`, sessionID,
	)
	if err != nil {
		return fmt.Errorf("touch session: %w", err)
	}
	return nil
}

func (s *AuthStore) DeleteSession(ctx context.Context, sessionID string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM sessions WHERE id = $1`, sessionID)
	if err != nil {
		return fmt.Errorf("delete session: %w", err)
	}
	return nil
}

func (s *AuthStore) DeleteUserSessions(ctx context.Context, userID string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM sessions WHERE user_id = $1`, userID)
	if err != nil {
		return fmt.Errorf("delete user sessions: %w", err)
	}
	return nil
}

func (s *AuthStore) ListUserSessions(ctx context.Context, userID string) ([]model.Session, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, user_id, token_hash, ip_address, user_agent, expires_at, created_at, last_used_at
		 FROM sessions
		 WHERE user_id = $1 AND expires_at > NOW()
		 ORDER BY last_used_at DESC`, userID,
	)
	if err != nil {
		return nil, fmt.Errorf("list user sessions: %w", err)
	}
	defer rows.Close()

	var sessions []model.Session
	for rows.Next() {
		var s model.Session
		if err := rows.Scan(&s.ID, &s.UserID, &s.TokenHash, &s.IPAddress, &s.UserAgent,
			&s.ExpiresAt, &s.CreatedAt, &s.LastUsedAt); err != nil {
			return nil, fmt.Errorf("scan session: %w", err)
		}
		sessions = append(sessions, s)
	}
	return sessions, rows.Err()
}

func (s *AuthStore) DeleteOtherSessions(ctx context.Context, userID, keepSessionID string) (int64, error) {
	tag, err := s.pool.Exec(ctx,
		`DELETE FROM sessions WHERE user_id = $1 AND id != $2`,
		userID, keepSessionID,
	)
	if err != nil {
		return 0, fmt.Errorf("delete other sessions: %w", err)
	}
	return tag.RowsAffected(), nil
}

func (s *AuthStore) GetSessionByID(ctx context.Context, sessionID string) (*model.Session, error) {
	var sess model.Session
	err := s.pool.QueryRow(ctx,
		`SELECT id, user_id, token_hash, ip_address, user_agent, expires_at, created_at, last_used_at
		 FROM sessions WHERE id = $1`, sessionID,
	).Scan(&sess.ID, &sess.UserID, &sess.TokenHash, &sess.IPAddress, &sess.UserAgent,
		&sess.ExpiresAt, &sess.CreatedAt, &sess.LastUsedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get session by id: %w", err)
	}
	return &sess, nil
}

func (s *AuthStore) CleanExpiredSessions(ctx context.Context) (int64, error) {
	tag, err := s.pool.Exec(ctx, `DELETE FROM sessions WHERE expires_at < NOW()`)
	if err != nil {
		return 0, fmt.Errorf("clean expired sessions: %w", err)
	}
	return tag.RowsAffected(), nil
}

// CleanupTestData removes all auth data. Used in tests only.
func (s *AuthStore) CleanupTestData(ctx context.Context) {
	s.pool.Exec(ctx, `DELETE FROM sessions`)
	s.pool.Exec(ctx, `DELETE FROM user_roles`)
	s.pool.Exec(ctx, `DELETE FROM users`)
}
