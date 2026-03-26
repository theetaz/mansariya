-- Timetable: scheduled departure times from origin stop
CREATE TABLE timetables (
    id SERIAL PRIMARY KEY,
    route_id TEXT REFERENCES routes(id) ON DELETE CASCADE,
    departure_time TIME NOT NULL,
    days TEXT[] DEFAULT '{MON,TUE,WED,THU,FRI,SAT,SUN}',
    service_type TEXT DEFAULT 'Normal',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_timetables_route ON timetables(route_id);
CREATE INDEX idx_timetables_departure ON timetables(departure_time);

-- Enrich route_stops with timing and fare data
ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS
    typical_duration_min INTEGER;
ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS
    fare_from_start_lkr INTEGER;

-- Add origin/destination stop references to routes
ALTER TABLE routes ADD COLUMN IF NOT EXISTS
    origin_stop_id TEXT;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS
    destination_stop_id TEXT;

-- Add validation tracking to routes
ALTER TABLE routes ADD COLUMN IF NOT EXISTS
    validated_by TEXT;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS
    validated_at TIMESTAMPTZ;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS
    data_source TEXT DEFAULT 'scraped';

-- Enrich stops with location context
ALTER TABLE stops ADD COLUMN IF NOT EXISTS
    road_name TEXT;
ALTER TABLE stops ADD COLUMN IF NOT EXISTS
    landmark TEXT;
ALTER TABLE stops ADD COLUMN IF NOT EXISTS
    is_terminal BOOLEAN DEFAULT FALSE;
ALTER TABLE stops ADD COLUMN IF NOT EXISTS
    routes_count INTEGER DEFAULT 0;

-- Index for journey search: find routes passing through a stop
CREATE INDEX IF NOT EXISTS idx_route_stops_stop ON route_stops(stop_id);

-- Mark major terminals
UPDATE stops SET is_terminal = TRUE
WHERE name_en IN (
    'Colombo Fort', 'Kandy', 'Galle', 'Matara', 'Jaffna',
    'Kurunegala', 'Anuradhapura', 'Negombo', 'Ratnapura', 'Badulla',
    'Trincomalee', 'Batticaloa', 'Hambantota', 'Nuwara Eliya'
);

-- Update routes_count on stops (how many routes pass through each stop)
UPDATE stops s SET routes_count = (
    SELECT COUNT(DISTINCT route_id) FROM route_stops rs WHERE rs.stop_id = s.id
);
