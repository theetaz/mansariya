-- Route patterns: GTFS trip-pattern analog
-- A route (e.g., 138) can have multiple patterns (Homagama, Kottawa, Maharagama)
CREATE TABLE route_patterns (
    id TEXT PRIMARY KEY,
    route_id TEXT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    headsign TEXT NOT NULL,
    direction SMALLINT DEFAULT 0,        -- 0=outbound, 1=inbound
    is_primary BOOLEAN DEFAULT FALSE,
    polyline GEOMETRY(LineString, 4326),
    polyline_confidence REAL DEFAULT 0.0,
    stop_count INTEGER DEFAULT 0,
    source TEXT DEFAULT 'bootstrap',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_rp_route ON route_patterns(route_id);
CREATE UNIQUE INDEX idx_rp_primary ON route_patterns(route_id) WHERE is_primary = TRUE;

-- Per-pattern stop sequences
CREATE TABLE pattern_stops (
    pattern_id TEXT NOT NULL REFERENCES route_patterns(id) ON DELETE CASCADE,
    stop_id TEXT NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
    stop_order INTEGER NOT NULL,
    distance_from_start_km REAL,
    typical_duration_min INTEGER,
    fare_from_start_lkr INTEGER,
    PRIMARY KEY (pattern_id, stop_order)
);
CREATE INDEX idx_ps_stop ON pattern_stops(stop_id);

-- Link timetable entries to patterns (nullable for backward compat)
ALTER TABLE timetables ADD COLUMN pattern_id TEXT REFERENCES route_patterns(id);

-- Fleet vehicles (placeholder for future vehicle tracking)
CREATE TABLE fleet_vehicles (
    id TEXT PRIMARY KEY,
    registration_number TEXT UNIQUE,
    route_id TEXT REFERENCES routes(id) ON DELETE SET NULL,
    capacity INTEGER,
    vehicle_type TEXT DEFAULT 'bus',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backfill: create a default pattern for every route that has stops
INSERT INTO route_patterns (id, route_id, headsign, direction, is_primary, polyline, polyline_confidence, stop_count, source)
SELECT
    'rt_' || r.id || '_default',
    r.id,
    COALESCE(
        (SELECT s.name_en FROM route_stops rs2 JOIN stops s ON s.id = rs2.stop_id
         WHERE rs2.route_id = r.id ORDER BY rs2.stop_order DESC LIMIT 1),
        NULLIF(split_part(r.name_en, ' - ', 2), ''),
        r.name_en
    ),
    0,
    TRUE,
    r.polyline,
    r.polyline_confidence,
    (SELECT COUNT(*) FROM route_stops rs3 WHERE rs3.route_id = r.id),
    'migration'
FROM routes r
WHERE EXISTS (SELECT 1 FROM route_stops WHERE route_id = r.id);

-- Copy existing route_stops into pattern_stops
INSERT INTO pattern_stops (pattern_id, stop_id, stop_order, distance_from_start_km, typical_duration_min, fare_from_start_lkr)
SELECT
    'rt_' || rs.route_id || '_default',
    rs.stop_id,
    rs.stop_order,
    rs.distance_from_start_km,
    rs.typical_duration_min,
    rs.fare_from_start_lkr
FROM route_stops rs
WHERE EXISTS (SELECT 1 FROM route_patterns WHERE id = 'rt_' || rs.route_id || '_default');
