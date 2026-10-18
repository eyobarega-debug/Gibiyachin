-- Gibiyachin — Migration 019: Password Reset Token Lookup Index
--
-- Adds a partial index on users(password_reset_token) for non-null tokens
-- to optimize password reset token lookup and verification.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_users_password_reset_token
  ON users (password_reset_token)
  WHERE password_reset_token IS NOT NULL;

COMMIT;

