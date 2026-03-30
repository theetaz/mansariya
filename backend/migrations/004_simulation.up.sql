CREATE TABLE simulation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id TEXT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'stopped')),
    ping_interval_sec INTEGER NOT NULL DEFAULT 3,
    default_speed_min_kmh REAL NOT NULL DEFAULT 20,
    default_speed_max_kmh REAL NOT NULL DEFAULT 60,
    default_dwell_min_sec INTEGER NOT NULL DEFAULT 15,
    default_dwell_max_sec INTEGER NOT NULL DEFAULT 60,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE simulation_vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES simulation_jobs(id) ON DELETE CASCADE,
    vehicle_id TEXT NOT NULL,
    passenger_count INTEGER NOT NULL DEFAULT 1,
    speed_min_kmh REAL,
    speed_max_kmh REAL,
    dwell_min_sec INTEGER,
    dwell_max_sec INTEGER,
    start_stop_id TEXT,
    start_lat REAL,
    start_lng REAL,
    ping_interval_sec INTEGER
);

CREATE INDEX idx_simulation_vehicles_job ON simulation_vehicles(job_id);
CREATE INDEX idx_simulation_jobs_status ON simulation_jobs(status);
