-- ==================================================================
-- Migration 025: Gibiyachin Confessions & Moderation Audit System
-- Description: Extends social_posts with confession categories, adds
--              is_anonymous flags, and introduces an audit log for
--              authorized moderator identity disclosures.
-- ==================================================================

BEGIN;

-- 1. Extend category check constraint on social_posts
ALTER TABLE social_posts DROP CONSTRAINT IF EXISTS social_posts_category_check;
ALTER TABLE social_posts ADD CONSTRAINT social_posts_category_check CHECK (category IN (
  -- Legacy categories
  'General', 'Technology', 'Education', 'Entertainment', 'Sports',
  'Business', 'Events', 'Questions', 'Campus Life', 'Announcements',
  -- Gibiyachin Confessions categories
  'Love & Relationships', 'Funny Confessions', 'University Life', 'Heartbreak',
  'Secrets', 'Rants & Frustrations', 'Random Thoughts', 'Hot Takes',
  'Academic Life', 'Other'
));

-- 2. Add is_anonymous columns defaulting to true
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE social_comments ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT true;

-- 3. Confession Moderation Identity Disclosure Audit Trail
-- Tracks when an authorized campus moderator accesses the private identity of an
-- anonymous confession/comment author for severe abuse/safety investigations.
CREATE TABLE IF NOT EXISTS confession_moderation_audit_logs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id         UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  moderator_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type           TEXT NOT NULL CHECK (target_type IN ('post', 'comment')),
  target_id             UUID NOT NULL,
  disclosed_user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason                TEXT NOT NULL,
  ip_address            TEXT,
  user_agent            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_confession_audit_uni ON confession_moderation_audit_logs (university_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_confession_audit_moderator ON confession_moderation_audit_logs (moderator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_confession_audit_target ON confession_moderation_audit_logs (target_type, target_id);

COMMIT;
