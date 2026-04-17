-- Mansariya: Contributor identity, telemetry, and leaderboard
-- Separate identity domain from operator users (per ADR)

-- ============ CONTRIBUTORS ============

CREATE TABLE contributors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contributor_id TEXT NOT NULL UNIQUE,           -- SHA-256 from mobile install secret, stable
    display_name TEXT,                              -- NULL until claimed
    password_hash TEXT,                             -- NULL until claimed
    status TEXT NOT NULL DEFAULT 'anonymous'
        CHECK (status IN ('anonymous', 'claimed', 'disabled')),
    claimed_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contributors_status ON contributors(status);
CREATE INDEX idx_contributors_last_seen ON contributors(last_seen_at);
CREATE INDEX idx_contributors_display_name ON contributors(display_name) WHERE display_name IS NOT NULL;

-- ============ CONTRIBUTOR DEVICE HASHES ============
-- Maps rotating device_hash values back to stable contributor_id

CREATE TABLE contributor_device_hashes (
    device_hash TEXT PRIMARY KEY,
    contributor_id TEXT NOT NULL REFERENCES contributors(contributor_id) ON DELETE CASCADE,
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cdh_contributor ON contributor_device_hashes(contributor_id);

-- ============ CONTRIBUTION STATS ============
-- Aggregated telemetry per contributor (updated by batch job)

CREATE TABLE contribution_stats (
    contributor_id TEXT PRIMARY KEY REFERENCES contributors(contributor_id) ON DELETE CASCADE,
    total_trips INTEGER DEFAULT 0,
    total_pings BIGINT DEFAULT 0,
    total_distance_km NUMERIC(10,2) DEFAULT 0,
    quality_score NUMERIC(5,2) DEFAULT 0,          -- 0-100 scale
    noise_count INTEGER DEFAULT 0,
    potential_count INTEGER DEFAULT 0,
    cluster_count INTEGER DEFAULT 0,
    confirmed_count INTEGER DEFAULT 0,
    routes_contributed INTEGER DEFAULT 0,
    stops_discovered INTEGER DEFAULT 0,
    active_days INTEGER DEFAULT 0,
    first_contribution_at TIMESTAMPTZ,
    last_contribution_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ CONTRIBUTOR SESSIONS (AUTH) ============

CREATE TABLE contributor_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contributor_id TEXT NOT NULL REFERENCES contributors(contributor_id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    ip_address TEXT,
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_csess_contributor ON contributor_sessions(contributor_id);
CREATE INDEX idx_csess_expires ON contributor_sessions(expires_at);

-- ============ ADD contributor_id TO trip_sessions ============

ALTER TABLE trip_sessions ADD COLUMN IF NOT EXISTS contributor_id TEXT;
CREATE INDEX IF NOT EXISTS idx_trip_sessions_contributor ON trip_sessions(contributor_id);

-- ============ CONTRIBUTOR DAILY ACTIVITY ============

CREATE TABLE contributor_daily_activity (
    contributor_id TEXT NOT NULL REFERENCES contributors(contributor_id) ON DELETE CASCADE,
    activity_date DATE NOT NULL,
    ping_count INTEGER DEFAULT 0,
    trip_count INTEGER DEFAULT 0,
    PRIMARY KEY (contributor_id, activity_date)
);

-- ============ CONTRIBUTOR ROUTE CONTRIBUTIONS ============

CREATE TABLE contributor_routes (
    contributor_id TEXT NOT NULL REFERENCES contributors(contributor_id) ON DELETE CASCADE,
    route_id TEXT NOT NULL,
    trip_count INTEGER DEFAULT 1,
    total_pings INTEGER DEFAULT 0,
    first_contributed_at TIMESTAMPTZ DEFAULT NOW(),
    last_contributed_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (contributor_id, route_id)
);

CREATE INDEX idx_cr_route ON contributor_routes(route_id);

-- ============ NEW PERMISSIONS ============

INSERT INTO permissions (slug, name, family) VALUES
    ('contributors.view',   'View contributors',   'contributors'),
    ('contributors.manage', 'Manage contributors', 'contributors'),
    ('leaderboard.view',    'View leaderboard',    'contributors')
ON CONFLICT (slug) DO NOTHING;

-- super_admin gets all contributor permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.slug = 'super_admin' AND p.family = 'contributors'
ON CONFLICT DO NOTHING;

-- editor gets view permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.slug = 'editor' AND p.slug IN ('contributors.view', 'leaderboard.view')
ON CONFLICT DO NOTHING;
