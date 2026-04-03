package model

import "time"

// User statuses
const (
	UserStatusInvited  = "invited"
	UserStatusActive   = "active"
	UserStatusDisabled = "disabled"
)

// Default role slugs
const (
	RoleSuperAdmin    = "super_admin"
	RoleEditor        = "editor"
	RoleMapContributor = "map_contributor"
)

type User struct {
	ID                     string     `json:"id"`
	Email                  string     `json:"email"`
	PasswordHash           string     `json:"-"`
	DisplayName            string     `json:"display_name"`
	Status                 string     `json:"status"`
	InviteToken            *string    `json:"-"`
	InviteExpiresAt        *time.Time `json:"-"`
	PasswordResetToken     *string    `json:"-"`
	PasswordResetExpiresAt *time.Time `json:"-"`
	LastLoginAt            *time.Time `json:"last_login_at,omitempty"`
	CreatedAt              time.Time  `json:"created_at"`
	UpdatedAt              time.Time  `json:"updated_at"`
	Roles                  []Role     `json:"roles,omitempty"`
}

type Role struct {
	ID          string    `json:"id"`
	Slug        string    `json:"slug"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	IsSystem    bool      `json:"is_system"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Permission struct {
	ID          string    `json:"id"`
	Slug        string    `json:"slug"`
	Name        string    `json:"name"`
	Family      string    `json:"family"`
	Description string    `json:"description,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

type UserRole struct {
	UserID     string    `json:"user_id"`
	RoleID     string    `json:"role_id"`
	AssignedAt time.Time `json:"assigned_at"`
	AssignedBy *string   `json:"assigned_by,omitempty"`
}

type Session struct {
	ID         string    `json:"id"`
	UserID     string    `json:"user_id"`
	TokenHash  string    `json:"-"`
	IPAddress  string    `json:"ip_address,omitempty"`
	UserAgent  string    `json:"user_agent,omitempty"`
	ExpiresAt  time.Time `json:"expires_at"`
	CreatedAt  time.Time `json:"created_at"`
	LastUsedAt time.Time `json:"last_used_at"`
}
