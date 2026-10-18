-- Gibiyachin Platform — Migration 020: Ethiopian Universities Schema Extensions
-- Adds institutional classification fields (code, city, region, institution_type)
-- to the universities table to support nationwide higher-education institutions.

BEGIN;

ALTER TABLE universities
  ADD COLUMN IF NOT EXISTS code TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS institution_type TEXT NOT NULL DEFAULT 'public';

CREATE INDEX IF NOT EXISTS idx_universities_code ON universities (code);
CREATE INDEX IF NOT EXISTS idx_universities_region ON universities (region);

COMMIT;

