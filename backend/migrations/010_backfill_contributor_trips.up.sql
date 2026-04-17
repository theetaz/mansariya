-- Backfill: Link historical trip_sessions to contributors
-- Uses contributor_device_hashes mapping (populated by mobile app sending contributor_id)
-- Safe to run multiple times — only updates NULL contributor_id rows

UPDATE trip_sessions ts
SET contributor_id = cdh.contributor_id
FROM contributor_device_hashes cdh
WHERE ts.device_hash = cdh.device_hash
  AND ts.contributor_id IS NULL;
