-- Gibiyachin Platform — Migration 022: Smart Campus Lost & Found System
-- Creates:
--   1. lost_found_items: core items catalog (lost and found belongings)
--   2. lost_found_claims: verification and ownership claims
--   3. lost_found_matches: weighted automated match recommendations
-- Indexes, university tenant relationships, and audit-friendly timestamps.

BEGIN;

-- 1. Lost & Found Items Catalog
CREATE TABLE IF NOT EXISTS lost_found_items (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id               UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  reporter_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                        TEXT NOT NULL CHECK (type IN ('lost', 'found')),
  title                       TEXT NOT NULL,
  category                    TEXT NOT NULL,
  description                 TEXT NOT NULL,
  date_occurred               DATE NOT NULL DEFAULT CURRENT_DATE,
  location                    TEXT NOT NULL,
  images                      TEXT[] NOT NULL DEFAULT '{}',
  brand                       TEXT,
  color                       TEXT,
  identifying_characteristics TEXT,
  reward_amount               NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (reward_amount >= 0),
  private_details             TEXT, -- Confidential verification info (only visible to finder & admins)
  status                      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'matched', 'claim_pending', 'awaiting_handover', 'returned', 'closed', 'expired', 'removed')),
  resolved_at                 TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Lost & Found Claims
CREATE TABLE IF NOT EXISTS lost_found_claims (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id                         UUID NOT NULL REFERENCES lost_found_items(id) ON DELETE CASCADE,
  claimant_id                     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  university_id                   UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  message                         TEXT NOT NULL,
  private_proof                   TEXT NOT NULL, -- Private identifying information / serial / card details
  evidence_images                 TEXT[] NOT NULL DEFAULT '{}',
  status                          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'disputed', 'cancelled', 'completed')),
  review_notes                    TEXT,
  handover_confirmed_by_finder    BOOLEAN NOT NULL DEFAULT false,
  handover_confirmed_by_claimant  BOOLEAN NOT NULL DEFAULT false,
  dispute_reason                  TEXT,
  resolved_at                     TIMESTAMPTZ,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Automated Match Suggestions
CREATE TABLE IF NOT EXISTS lost_found_matches (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id         UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  lost_item_id          UUID NOT NULL REFERENCES lost_found_items(id) ON DELETE CASCADE,
  found_item_id         UUID NOT NULL REFERENCES lost_found_items(id) ON DELETE CASCADE,
  score                 INT NOT NULL CHECK (score >= 0 AND score <= 100),
  reasons               JSONB NOT NULL DEFAULT '[]',
  status                TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'dismissed', 'confirmed')),
  dismissed_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  notified_lost_owner   BOOLEAN NOT NULL DEFAULT false,
  notified_found_finder BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_lost_found_match_pair UNIQUE (lost_item_id, found_item_id)
);

-- Performance & Tenant Scoping Indexes
CREATE INDEX IF NOT EXISTS idx_lf_items_uni_status ON lost_found_items (university_id, status);
CREATE INDEX IF NOT EXISTS idx_lf_items_type ON lost_found_items (university_id, type, status);
CREATE INDEX IF NOT EXISTS idx_lf_items_category ON lost_found_items (university_id, category);
CREATE INDEX IF NOT EXISTS idx_lf_items_reporter ON lost_found_items (reporter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lf_items_created ON lost_found_items (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lf_items_title ON lost_found_items (title);

CREATE INDEX IF NOT EXISTS idx_lf_claims_item ON lost_found_claims (item_id, status);
CREATE INDEX IF NOT EXISTS idx_lf_claims_claimant ON lost_found_claims (claimant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lf_claims_uni ON lost_found_claims (university_id, status);

CREATE INDEX IF NOT EXISTS idx_lf_matches_lost ON lost_found_matches (lost_item_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_lf_matches_found ON lost_found_matches (found_item_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_lf_matches_uni ON lost_found_matches (university_id, score DESC);

COMMIT;
