-- Mansariya: Audit log for auth events and privileged actions
-- THE-117: Audit trail for auth events and privileged actions

CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    actor_id TEXT,                                 -- user ID or 'system' or 'api-key'
    actor_email TEXT,                              -- denormalized for readability
    action TEXT NOT NULL,                          -- e.g., 'auth.login', 'user.disable', 'role.assign'
    target_type TEXT,                              -- e.g., 'user', 'route', 'session'
    target_id TEXT,                                -- ID of the target entity
    metadata JSONB DEFAULT '{}',                   -- safe additional context
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_target ON audit_logs(target_type, target_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
