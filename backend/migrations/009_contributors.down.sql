-- Rollback: Contributor identity, telemetry, and leaderboard

DROP TABLE IF EXISTS contributor_routes CASCADE;
DROP TABLE IF EXISTS contributor_daily_activity CASCADE;
DROP TABLE IF EXISTS contributor_sessions CASCADE;
DROP TABLE IF EXISTS contribution_stats CASCADE;
DROP TABLE IF EXISTS contributor_device_hashes CASCADE;
ALTER TABLE trip_sessions DROP COLUMN IF EXISTS contributor_id;
DROP TABLE IF EXISTS contributors CASCADE;

DELETE FROM role_permissions WHERE permission_id IN (
    SELECT id FROM permissions WHERE family = 'contributors'
);
DELETE FROM permissions WHERE family = 'contributors';
