-- Mansariya: Initial schema
-- PostgreSQL 16 + PostGIS

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============ ROUTE DATA ============

CREATE TABLE routes (
    id TEXT PRIMARY KEY,                        -- e.g., '001', '138', '1-3'
    name_en TEXT NOT NULL,                      -- 'Colombo - Kandy'
    name_si TEXT NOT NULL,                      -- 'කොළඹ - මහනුවර'
    name_ta TEXT NOT NULL,                      -- 'கொழும்பு - கண்டி'
    operator TEXT,                              -- 'SLTB' | 'Private' | 'NTC'
    service_type TEXT,                          -- 'Normal' | 'Semi Luxury' | 'AC Luxury'
    fare_lkr INTEGER,                           -- Base fare in LKR
    frequency_minutes INTEGER,                  -- Approximate headway
    operating_hours TEXT,                        -- e.g., '05:00-22:00'
    polyline GEOMETRY(LineString, 4326),         -- Route shape on road network
    polyline_confidence REAL DEFAULT 0.0,       -- 0 = estimated, 1 = crowdsource-verified
    source TEXT DEFAULT 'ntc_geocoded',         -- Data provenance
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_routes_polyline ON routes USING GIST(polyline);

CREATE TABLE stops (
    id TEXT PRIMARY KEY,                        -- UUID
    name_en TEXT NOT NULL,
    name_si TEXT,
    name_ta TEXT,
    location GEOMETRY(Point, 4326) NOT NULL,
    source TEXT DEFAULT 'geocoded',             -- 'geocoded' | 'crowdsourced' | 'osm' | 'manual'
    confidence REAL DEFAULT 0.0,
    observation_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stops_location ON stops USING GIST(location);
CREATE INDEX idx_stops_name_en ON stops USING GIN(name_en gin_trgm_ops);
CREATE INDEX idx_stops_name_si ON stops USING GIN(name_si gin_trgm_ops);

CREATE TABLE route_stops (
    route_id TEXT REFERENCES routes(id) ON DELETE CASCADE,
    stop_id TEXT REFERENCES stops(id) ON DELETE CASCADE,
    stop_order INTEGER NOT NULL,
    distance_from_start_km REAL,
    typical_arrival_offset_min INTEGER,
    PRIMARY KEY (route_id, stop_id, stop_order)
);

-- ============ REAL-TIME TRACKING ============

CREATE TABLE active_vehicles (
    virtual_id TEXT PRIMARY KEY,
    route_id TEXT REFERENCES routes(id) ON DELETE SET NULL,
    current_position GEOMETRY(Point, 4326),
    speed_kmh REAL,
    bearing REAL,
    contributor_count INTEGER DEFAULT 1,
    confidence TEXT DEFAULT 'low',              -- 'low' | 'good' | 'verified'
    last_update TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_active_vehicles_position ON active_vehicles USING GIST(current_position);
CREATE INDEX idx_active_vehicles_route ON active_vehicles(route_id);

-- ============ HISTORICAL DATA (for ETA learning) ============

CREATE TABLE trip_segments (
    id BIGSERIAL PRIMARY KEY,
    route_id TEXT REFERENCES routes(id) ON DELETE SET NULL,
    from_stop_id TEXT,
    to_stop_id TEXT,
    travel_time_seconds INTEGER,
    speed_kmh REAL,
    hour_of_day SMALLINT,                       -- 0-23
    day_of_week SMALLINT,                       -- 0=Monday, 6=Sunday
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trip_segments_lookup ON trip_segments(route_id, from_stop_id, to_stop_id, hour_of_day);

-- ============ CROWDSOURCE CONTRIBUTIONS ============

CREATE TABLE gps_traces (
    id BIGSERIAL PRIMARY KEY,
    device_hash TEXT NOT NULL,
    session_id TEXT NOT NULL,
    route_id TEXT,
    trace GEOMETRY(LineString, 4326),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    point_count INTEGER,
    avg_speed_kmh REAL
);

CREATE INDEX idx_gps_traces_route ON gps_traces(route_id);
CREATE INDEX idx_gps_traces_time ON gps_traces(started_at);

CREATE TABLE discovered_stops (
    id TEXT PRIMARY KEY,
    location GEOMETRY(Point, 4326) NOT NULL,
    observation_count INTEGER DEFAULT 1,
    avg_dwell_seconds REAL,
    nearest_route_ids TEXT[],
    status TEXT DEFAULT 'candidate',            -- 'candidate' | 'confirmed' | 'rejected'
    promoted_to_stop_id TEXT,
    first_seen TIMESTAMPTZ DEFAULT NOW(),
    last_seen TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_discovered_stops_location ON discovered_stops USING GIST(location);
CREATE INDEX idx_discovered_stops_status ON discovered_stops(status);
