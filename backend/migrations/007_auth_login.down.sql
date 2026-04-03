-- Rollback: Auth login tracking and sessions

DROP TABLE IF EXISTS sessions CASCADE;
ALTER TABLE users DROP COLUMN IF EXISTS failed_login_attempts;
ALTER TABLE users DROP COLUMN IF EXISTS locked_until;
