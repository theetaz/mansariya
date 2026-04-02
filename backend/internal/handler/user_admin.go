package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/masariya/backend/internal/model"
	"github.com/masariya/backend/internal/service"
)

type UserAdminHandler struct {
	auth  *service.AuthService
	store service.AuthStoreInterface
	audit AuditLogger
}

func NewUserAdminHandler(auth *service.AuthService, st service.AuthStoreInterface, audit AuditLogger) *UserAdminHandler {
	return &UserAdminHandler{auth: auth, store: st, audit: audit}
}

func (h *UserAdminHandler) logAudit(r *http.Request, action, targetType, targetID string, meta map[string]string) {
	if h.audit == nil {
		return
	}
	metaJSON, _ := json.Marshal(meta)
	_ = h.audit.LogAudit(r.Context(), UserIDFromContext(r.Context()), "", action, targetType, targetID, r.RemoteAddr, r.UserAgent(), metaJSON)
}

// ── List users ───────────────────────────────────────────────────────────

func (h *UserAdminHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.store.ListUsers(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "list_users_failed", "Could not load users.", "")
		return
	}

	// Enrich each user with roles
	type userView struct {
		ID          string      `json:"id"`
		Email       string      `json:"email"`
		DisplayName string      `json:"display_name"`
		Status      string      `json:"status"`
		LastLoginAt interface{} `json:"last_login_at"`
		CreatedAt   string      `json:"created_at"`
		Roles       interface{} `json:"roles"`
	}
	views := make([]userView, len(users))
	for i, u := range users {
		roles, _ := h.store.GetUserRoles(r.Context(), u.ID)
		var lastLogin interface{}
		if u.LastLoginAt != nil {
			lastLogin = u.LastLoginAt.Format("2006-01-02T15:04:05Z")
		}
		views[i] = userView{
			ID:          u.ID,
			Email:       u.Email,
			DisplayName: u.DisplayName,
			Status:      u.Status,
			LastLoginAt: lastLogin,
			CreatedAt:   u.CreatedAt.Format("2006-01-02T15:04:05Z"),
			Roles:       roles,
		}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"users": views, "count": len(views)})
}

// ── Invite user ──────────────────────────────────────────────────────────

type inviteUserRequest struct {
	Email       string   `json:"email"`
	DisplayName string   `json:"display_name"`
	RoleIDs     []string `json:"role_ids"`
}

func (h *UserAdminHandler) InviteUser(w http.ResponseWriter, r *http.Request) {
	var req inviteUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "Invalid request body.", "")
		return
	}
	if req.Email == "" || req.DisplayName == "" {
		writeError(w, http.StatusBadRequest, "validation_failed", "Email and display name are required.", "")
		return
	}

	inviterID := UserIDFromContext(r.Context())
	user, token, err := h.auth.InviteUser(r.Context(), req.Email, req.DisplayName, req.RoleIDs, inviterID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "invite_failed", "Could not invite user.", "")
		return
	}

	h.logAudit(r, "user.invited", "user", user.ID, map[string]string{"email": req.Email})
	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"user":         user,
		"invite_token": token,
	})
}

// ── Update user status ───────────────────────────────────────────────────

type updateStatusRequest struct {
	Status string `json:"status"` // "active" or "disabled"
}

func (h *UserAdminHandler) UpdateUserStatus(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "userID")

	var req updateStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "Invalid request body.", "")
		return
	}
	if req.Status != "active" && req.Status != "disabled" {
		writeError(w, http.StatusBadRequest, "validation_failed", "Status must be 'active' or 'disabled'.", "status")
		return
	}

	user, err := h.store.GetUserByID(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusNotFound, "user_not_found", "User not found.", "")
		return
	}

	user.Status = req.Status
	if err := h.store.UpdateUser(r.Context(), user); err != nil {
		writeError(w, http.StatusInternalServerError, "update_failed", "Could not update user.", "")
		return
	}

	// If disabling, revoke all sessions
	if req.Status == "disabled" {
		_ = h.store.DeleteUserSessions(r.Context(), userID)
	}

	h.logAudit(r, "user.status_changed", "user", userID, map[string]string{"status": req.Status})
	writeJSON(w, http.StatusOK, map[string]string{"status": req.Status})
}

// ── Assign role ──────────────────────────────────────────────────────────

type assignRoleRequest struct {
	RoleID string `json:"role_id"`
}

func (h *UserAdminHandler) AssignRole(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "userID")

	var req assignRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.RoleID == "" {
		writeError(w, http.StatusBadRequest, "validation_failed", "role_id is required.", "role_id")
		return
	}

	assignerID := UserIDFromContext(r.Context())
	if err := h.store.AssignRole(r.Context(), userID, req.RoleID, &assignerID); err != nil {
		writeError(w, http.StatusInternalServerError, "assign_failed", "Could not assign role.", "")
		return
	}

	h.logAudit(r, "role.assigned", "user", userID, map[string]string{"role_id": req.RoleID})
	writeJSON(w, http.StatusOK, map[string]string{"status": "assigned"})
}

// ── Remove role ──────────────────────────────────────────────────────────

func (h *UserAdminHandler) RemoveRole(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "userID")
	roleID := chi.URLParam(r, "roleID")

	if err := h.store.RemoveRole(r.Context(), userID, roleID); err != nil {
		writeError(w, http.StatusInternalServerError, "remove_failed", "Could not remove role.", "")
		return
	}

	h.logAudit(r, "role.removed", "user", userID, map[string]string{"role_id": roleID})
	writeJSON(w, http.StatusOK, map[string]string{"status": "removed"})
}

// ── List roles ───────────────────────────────────────────────────────────

func (h *UserAdminHandler) ListRoles(w http.ResponseWriter, r *http.Request) {
	roles, err := h.store.ListRoles(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "list_roles_failed", "Could not load roles.", "")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"roles": roles})
}

// ── Role CRUD ────────────────────────────────────────────────────────────

func (h *UserAdminHandler) CreateRole(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Slug        string `json:"slug"`
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteAPIErr(w, r, ErrValidation("invalid_body", "validation.invalid_body", ""))
		return
	}
	if req.Slug == "" || req.Name == "" {
		WriteAPIErr(w, r, ErrValidation("validation_failed", "validation.required", "slug,name"))
		return
	}

	role, err := h.store.CreateRole(r.Context(), req.Slug, req.Name, req.Description)
	if err != nil {
		WriteAPIErr(w, r, ErrInternal(err))
		return
	}

	h.logAudit(r, "role.created", "role", role.ID, map[string]string{"slug": req.Slug})
	writeJSON(w, http.StatusCreated, role)
}

func (h *UserAdminHandler) UpdateRoleInfo(w http.ResponseWriter, r *http.Request) {
	roleID := chi.URLParam(r, "roleID")
	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteAPIErr(w, r, ErrValidation("invalid_body", "validation.invalid_body", ""))
		return
	}

	if err := h.store.UpdateRole(r.Context(), roleID, req.Name, req.Description); err != nil {
		WriteAPIErr(w, r, ErrInternal(err))
		return
	}

	h.logAudit(r, "role.updated", "role", roleID, nil)
	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *UserAdminHandler) DeleteRoleHandler(w http.ResponseWriter, r *http.Request) {
	roleID := chi.URLParam(r, "roleID")

	if err := h.store.DeleteRole(r.Context(), roleID); err != nil {
		WriteAPIErr(w, r, ErrInternal(err))
		return
	}

	h.logAudit(r, "role.deleted", "role", roleID, nil)
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// ── Role permissions ─────────────────────────────────────────────────────

func (h *UserAdminHandler) GetRolePermissions(w http.ResponseWriter, r *http.Request) {
	roleID := chi.URLParam(r, "roleID")

	perms, err := h.store.GetRolePermissions(r.Context(), roleID)
	if err != nil {
		WriteAPIErr(w, r, ErrInternal(err))
		return
	}
	if perms == nil {
		perms = []model.Permission{}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"permissions": perms})
}

func (h *UserAdminHandler) SetRolePermissions(w http.ResponseWriter, r *http.Request) {
	roleID := chi.URLParam(r, "roleID")

	var req struct {
		PermissionIDs []string `json:"permission_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteAPIErr(w, r, ErrValidation("invalid_body", "validation.invalid_body", ""))
		return
	}

	if err := h.store.SetRolePermissions(r.Context(), roleID, req.PermissionIDs); err != nil {
		WriteAPIErr(w, r, ErrInternal(err))
		return
	}

	h.logAudit(r, "role.permissions_updated", "role", roleID, nil)
	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *UserAdminHandler) ListPermissions(w http.ResponseWriter, r *http.Request) {
	perms, err := h.store.ListPermissions(r.Context())
	if err != nil {
		WriteAPIErr(w, r, ErrInternal(err))
		return
	}
	if perms == nil {
		perms = []model.Permission{}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"permissions": perms})
}

// ── User sessions ────────────────────────────────────────────────────────

func (h *UserAdminHandler) ListUserSessions(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "userID")

	sessions, err := h.store.ListUserSessions(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "list_sessions_failed", "Could not load sessions.", "")
		return
	}

	type sessionView struct {
		ID         string `json:"id"`
		IPAddress  string `json:"ip_address"`
		UserAgent  string `json:"user_agent"`
		CreatedAt  string `json:"created_at"`
		LastUsedAt string `json:"last_used_at"`
		ExpiresAt  string `json:"expires_at"`
	}
	views := make([]sessionView, len(sessions))
	for i, s := range sessions {
		views[i] = sessionView{
			ID:         s.ID,
			IPAddress:  s.IPAddress,
			UserAgent:  s.UserAgent,
			CreatedAt:  s.CreatedAt.Format("2006-01-02T15:04:05Z"),
			LastUsedAt: s.LastUsedAt.Format("2006-01-02T15:04:05Z"),
			ExpiresAt:  s.ExpiresAt.Format("2006-01-02T15:04:05Z"),
		}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"sessions": views, "count": len(views)})
}

func (h *UserAdminHandler) RevokeUserSession(w http.ResponseWriter, r *http.Request) {
	sessionID := chi.URLParam(r, "sessionID")

	if err := h.store.DeleteSession(r.Context(), sessionID); err != nil {
		writeError(w, http.StatusInternalServerError, "revoke_failed", "Could not revoke session.", "")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "revoked"})
}

func (h *UserAdminHandler) RevokeAllUserSessions(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "userID")

	if err := h.store.DeleteUserSessions(r.Context(), userID); err != nil {
		writeError(w, http.StatusInternalServerError, "revoke_failed", "Could not revoke sessions.", "")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "all_revoked"})
}

// ── Password reset by admin ──────────────────────────────────────────────

func (h *UserAdminHandler) AdminResetPassword(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "userID")

	user, err := h.store.GetUserByID(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusNotFound, "user_not_found", "User not found.", "")
		return
	}

	token, err := h.auth.RequestPasswordReset(r.Context(), user.Email)
	if err != nil || token == "" {
		writeError(w, http.StatusInternalServerError, "reset_failed", "Could not generate reset token.", "")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"reset_token": token})
}

