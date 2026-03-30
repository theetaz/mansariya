CREATE TABLE trip_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_hash TEXT NOT NULL,
    session_id TEXT NOT NULL UNIQUE,
    route_id TEXT,
    bus_number TEXT,
    crowd_level INTEGER,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ping_count INTEGER DEFAULT 0,
    has_metadata BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_trip_sessions_device ON trip_sessions(device_hash);
CREATE INDEX idx_trip_sessions_route ON trip_sessions(route_id);
CREATE INDEX idx_trip_sessions_started ON trip_sessions(started_at);
