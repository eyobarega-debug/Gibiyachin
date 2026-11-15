-- Gibiyachin Platform — Migration 024: Social Feed, Campus Communities & Announcements
-- Creates:
--   1. communities: university-scoped student communities (public, private, official)
--   2. community_members: community membership and roles (owner, moderator, member)
--   3. community_join_requests: approval queue for private communities
--   4. social_posts: social feed posts (text, images, questions, polls, announcements)
--   5. social_polls: poll questions attached to posts
--   6. social_poll_options: options for polls with real-time vote tallies
--   7. social_poll_votes: single-vote constraint per user per poll
--   8. social_likes: post likes with duplicate prevention
--   9. social_comments: threaded discussions (comments & replies)
--  10. social_comment_likes: comment likes
--  11. social_bookmarks: saved/bookmarked posts
--  12. social_reports: moderation reporting for posts, comments, communities

BEGIN;

-- ------------------------------------------------------------------
-- 1. Communities
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS communities (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id         UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  slug                  TEXT NOT NULL,
  description           TEXT,
  category              TEXT NOT NULL DEFAULT 'General',
  type                  TEXT NOT NULL DEFAULT 'public' CHECK (type IN ('public', 'private', 'official')),
  avatar_url            TEXT,
  banner_url            TEXT,
  rules                 TEXT,
  creator_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  members_count         INT NOT NULL DEFAULT 1 CHECK (members_count >= 0),
  posts_count           INT NOT NULL DEFAULT 0 CHECK (posts_count >= 0),
  is_verified           BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (university_id, slug)
);

-- ------------------------------------------------------------------
-- 2. Community Members
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS community_members (
  community_id          UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role                  TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'moderator', 'member')),
  joined_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (community_id, user_id)
);

-- ------------------------------------------------------------------
-- 3. Community Join Requests
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS community_join_requests (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id          UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by           UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (community_id, user_id)
);

-- ------------------------------------------------------------------
-- 4. Social Posts
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS social_posts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id         UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  author_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  community_id          UUID REFERENCES communities(id) ON DELETE CASCADE,
  content               TEXT NOT NULL,
  images                TEXT[] NOT NULL DEFAULT '{}',
  location              TEXT,
  category              TEXT NOT NULL DEFAULT 'General' CHECK (category IN (
                          'General', 'Technology', 'Education', 'Entertainment',
                          'Sports', 'Business', 'Events', 'Questions', 'Campus Life', 'Announcements'
                        )),
  post_type             TEXT NOT NULL DEFAULT 'post' CHECK (post_type IN ('post', 'poll', 'announcement', 'question')),
  audience              TEXT NOT NULL DEFAULT 'university' CHECK (audience IN ('university', 'community', 'private')),
  is_official           BOOLEAN NOT NULL DEFAULT false,
  is_pinned             BOOLEAN NOT NULL DEFAULT false,
  status                TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden', 'draft', 'deleted')),
  likes_count           INT NOT NULL DEFAULT 0 CHECK (likes_count >= 0),
  comments_count        INT NOT NULL DEFAULT 0 CHECK (comments_count >= 0),
  shares_count          INT NOT NULL DEFAULT 0 CHECK (shares_count >= 0),
  bookmarks_count       INT NOT NULL DEFAULT 0 CHECK (bookmarks_count >= 0),
  expires_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------
-- 5. Social Polls
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS social_polls (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id               UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE UNIQUE,
  question              TEXT NOT NULL,
  expires_at            TIMESTAMPTZ,
  total_votes           INT NOT NULL DEFAULT 0 CHECK (total_votes >= 0),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------
-- 6. Social Poll Options
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS social_poll_options (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id               UUID NOT NULL REFERENCES social_polls(id) ON DELETE CASCADE,
  option_text           TEXT NOT NULL,
  vote_count            INT NOT NULL DEFAULT 0 CHECK (vote_count >= 0),
  sort_order            INT NOT NULL DEFAULT 0
);

-- ------------------------------------------------------------------
-- 7. Social Poll Votes (One vote per user per poll)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS social_poll_votes (
  poll_id               UUID NOT NULL REFERENCES social_polls(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  option_id             UUID NOT NULL REFERENCES social_poll_options(id) ON DELETE CASCADE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, user_id)
);

-- ------------------------------------------------------------------
-- 8. Social Likes
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS social_likes (
  post_id               UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

-- ------------------------------------------------------------------
-- 9. Social Comments & Replies
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS social_comments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id               UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  author_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_comment_id     UUID REFERENCES social_comments(id) ON DELETE CASCADE,
  content               TEXT NOT NULL,
  likes_count           INT NOT NULL DEFAULT 0 CHECK (likes_count >= 0),
  is_edited             BOOLEAN NOT NULL DEFAULT false,
  is_deleted            BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------
-- 10. Social Comment Likes
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS social_comment_likes (
  comment_id            UUID NOT NULL REFERENCES social_comments(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

-- ------------------------------------------------------------------
-- 11. Social Bookmarks
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS social_bookmarks (
  post_id               UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

-- ------------------------------------------------------------------
-- 12. Social Reports
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS social_reports (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id         UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  reporter_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type           TEXT NOT NULL CHECK (target_type IN ('post', 'comment', 'community', 'image')),
  target_id             UUID NOT NULL,
  category              TEXT NOT NULL CHECK (category IN (
                          'harassment', 'bullying', 'spam', 'fraud',
                          'impersonation', 'inappropriate_content', 'hate_or_abusive', 'other'
                        )),
  description           TEXT,
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'action_taken')),
  reviewed_by           UUID REFERENCES users(id) ON DELETE SET NULL,
  action_taken_notes    TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------
-- Indexes for High Performance Feeds and Search
-- ------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_social_posts_feed ON social_posts (university_id, status, is_pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_posts_community ON social_posts (community_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_posts_author ON social_posts (author_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_posts_category ON social_posts (university_id, category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_posts_official ON social_posts (university_id, is_official, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_communities_university ON communities (university_id, type, members_count DESC);
CREATE INDEX IF NOT EXISTS idx_community_members_user ON community_members (user_id);
CREATE INDEX IF NOT EXISTS idx_social_comments_post ON social_comments (post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_social_comments_parent ON social_comments (parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_social_bookmarks_user ON social_bookmarks (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_reports_status ON social_reports (university_id, status, created_at DESC);

COMMIT;
