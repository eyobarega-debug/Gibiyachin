-- Gibiyachin Platform — Migration 023: Connect Real-Time Messaging & Campus Dating
-- Creates:
--   1. conversations: multi-context conversation channels (general, marketplace, rental, lost_found, dating)
--   2. conversation_participants: conversation membership, unread badges, pinning, archiving
--   3. messages: message history, replies, edits, soft deletions, and attachments
--   4. message_receipts: delivered and read receipts
--   5. user_blocks: user blocking across messaging and dating
--   6. dating_profiles: opt-in 18+ student dating profiles
--   7. dating_preferences: discovery criteria (age range, gender preferences, university scope)
--   8. dating_swipes: swipe history (like / pass)
--   9. dating_matches: mutual-like matches linked to dating conversations
--  10. dating_reports: safety and moderation reporting

BEGIN;

-- ------------------------------------------------------------------
-- 1. Conversations
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id         UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  type                  TEXT NOT NULL CHECK (type IN ('general', 'marketplace', 'rental', 'lost_found', 'dating')),
  context_type          TEXT, -- 'product', 'listing', 'rental', 'lost_found_item', 'dating_match', or null
  context_id            TEXT, -- UUID or ID of the contextual entity
  context_data          JSONB NOT NULL DEFAULT '{}', -- Cached snapshot: { title, price, image, destinationUrl }
  created_by            UUID REFERENCES users(id) ON DELETE SET NULL,
  last_message_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_preview  TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------
-- 2. Conversation Participants
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id       UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  unread_count          INT NOT NULL DEFAULT 0 CHECK (unread_count >= 0),
  is_pinned             BOOLEAN NOT NULL DEFAULT false,
  is_archived           BOOLEAN NOT NULL DEFAULT false,
  is_muted              BOOLEAN NOT NULL DEFAULT false,
  joined_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

-- ------------------------------------------------------------------
-- 3. Messages
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id       UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content               TEXT,
  attachments           JSONB NOT NULL DEFAULT '[]', -- Array of { url, filename, type, size }
  reply_to_id           UUID REFERENCES messages(id) ON DELETE SET NULL,
  status                TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read')),
  is_edited             BOOLEAN NOT NULL DEFAULT false,
  edited_at             TIMESTAMPTZ,
  is_deleted            BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------
-- 4. Message Receipts
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS message_receipts (
  message_id            UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status                TEXT NOT NULL CHECK (status IN ('delivered', 'read')),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

-- ------------------------------------------------------------------
-- 5. User Blocks
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_blocks (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason                TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_block UNIQUE (blocker_id, blocked_id),
  CONSTRAINT chk_no_self_block CHECK (blocker_id <> blocked_id)
);

-- ------------------------------------------------------------------
-- 6. Dating Profiles (Strictly 18+)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dating_profiles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  university_id         UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  display_name          TEXT NOT NULL,
  age                   INT NOT NULL CHECK (age >= 18 AND age <= 100),
  birth_date            DATE, -- Kept private, never exposed
  bio                   TEXT NOT NULL,
  gender                TEXT, -- 'man', 'woman', 'non_binary', 'other'
  department            TEXT,
  academic_year         INT CHECK (academic_year >= 1 AND academic_year <= 7),
  interests             TEXT[] NOT NULL DEFAULT '{}',
  hobbies               TEXT[] NOT NULL DEFAULT '{}',
  favorite_music        TEXT,
  favorite_movies       TEXT,
  favorite_activities   TEXT,
  languages             TEXT[] NOT NULL DEFAULT '{}',
  avatar_url            TEXT NOT NULL,
  photos                TEXT[] NOT NULL DEFAULT '{}',
  privacy_settings      JSONB NOT NULL DEFAULT '{"show_age":true,"show_department":true,"show_year":true}',
  status                TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'hidden', 'deactivated')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------
-- 7. Dating Preferences
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dating_preferences (
  user_id               UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  min_age               INT NOT NULL DEFAULT 18 CHECK (min_age >= 18),
  max_age               INT NOT NULL DEFAULT 35 CHECK (max_age >= min_age),
  interested_in         TEXT[] NOT NULL DEFAULT '{"all"}', -- 'men', 'women', 'all', 'non_binary'
  same_university_only  BOOLEAN NOT NULL DEFAULT true,
  preferred_interests   TEXT[] NOT NULL DEFAULT '{}',
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------
-- 8. Dating Swipes
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dating_swipes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  swiper_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action                TEXT NOT NULL CHECK (action IN ('like', 'pass')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_dating_swipe UNIQUE (swiper_id, target_id),
  CONSTRAINT chk_no_self_swipe CHECK (swiper_id <> target_id)
);

-- ------------------------------------------------------------------
-- 9. Dating Matches
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dating_matches (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id       UUID REFERENCES conversations(id) ON DELETE SET NULL,
  status                TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unmatched', 'blocked')),
  unmatched_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  unmatched_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_dating_match_pair UNIQUE (user_a_id, user_b_id),
  CONSTRAINT chk_match_order CHECK (user_a_id < user_b_id)
);

-- ------------------------------------------------------------------
-- 10. Dating Reports & Safety Moderation
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dating_reports (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  university_id         UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  category              TEXT NOT NULL CHECK (category IN ('inappropriate_content', 'harassment', 'impersonation', 'underage', 'spam', 'other')),
  description           TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  admin_notes           TEXT,
  resolved_by           UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_no_self_dating_report CHECK (reporter_id <> target_user_id)
);

-- ------------------------------------------------------------------
-- Indexes for High Performance & Tenant Scoping
-- ------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_conversations_uni_type ON conversations (university_id, type);
CREATE INDEX IF NOT EXISTS idx_conversations_last_msg ON conversations (last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_context ON conversations (context_type, context_id);

CREATE INDEX IF NOT EXISTS idx_conv_part_user ON conversation_participants (user_id, is_archived, last_read_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_part_conv ON conversation_participants (conversation_id);

CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages (conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages (sender_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks (blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks (blocked_id);

CREATE INDEX IF NOT EXISTS idx_dating_profiles_uni_status ON dating_profiles (university_id, status);
CREATE INDEX IF NOT EXISTS idx_dating_profiles_age ON dating_profiles (age);

CREATE INDEX IF NOT EXISTS idx_dating_swipes_swiper ON dating_swipes (swiper_id, action);
CREATE INDEX IF NOT EXISTS idx_dating_swipes_target ON dating_swipes (target_id, action);

CREATE INDEX IF NOT EXISTS idx_dating_matches_users ON dating_matches (user_a_id, user_b_id, status);
CREATE INDEX IF NOT EXISTS idx_dating_matches_conv ON dating_matches (conversation_id);

CREATE INDEX IF NOT EXISTS idx_dating_reports_uni ON dating_reports (university_id, status);

COMMIT;
