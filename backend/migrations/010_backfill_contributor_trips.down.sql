-- Rollback: Clear backfilled contributor_id (only those set by backfill, not by live data)
-- No safe way to distinguish backfilled vs live — this is a no-op by design
-- The backfill can be re-run at any time
SELECT 1;
