DROP TABLE IF EXISTS timetables;

ALTER TABLE route_stops DROP COLUMN IF EXISTS typical_duration_min;
ALTER TABLE route_stops DROP COLUMN IF EXISTS fare_from_start_lkr;

ALTER TABLE routes DROP COLUMN IF EXISTS origin_stop_id;
ALTER TABLE routes DROP COLUMN IF EXISTS destination_stop_id;
ALTER TABLE routes DROP COLUMN IF EXISTS validated_by;
ALTER TABLE routes DROP COLUMN IF EXISTS validated_at;
ALTER TABLE routes DROP COLUMN IF EXISTS data_source;

ALTER TABLE stops DROP COLUMN IF EXISTS road_name;
ALTER TABLE stops DROP COLUMN IF EXISTS landmark;
ALTER TABLE stops DROP COLUMN IF EXISTS is_terminal;
ALTER TABLE stops DROP COLUMN IF EXISTS routes_count;

DROP INDEX IF EXISTS idx_route_stops_stop;
