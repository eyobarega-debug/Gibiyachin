-- Migration 026: Smart Anonymous Identity System for Gibiyachin Confessions
-- Assigns every registered student a persistent, unique anonymous identifier (e.g. "Anonymous #104")
-- per university. Never exposes sequential database user IDs.

CREATE TABLE IF NOT EXISTS confession_user_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  identity_number INT NOT NULL,
  identity_code VARCHAR(60) NOT NULL,
  avatar_seed VARCHAR(60) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure identity_number is unique per university so students at the same campus never collide
CREATE UNIQUE INDEX IF NOT EXISTS idx_confession_identities_uni_num ON confession_user_identities(university_id, identity_number);
CREATE INDEX IF NOT EXISTS idx_confession_identities_user ON confession_user_identities(user_id);
CREATE INDEX IF NOT EXISTS idx_confession_identities_uni ON confession_user_identities(university_id);

-- Backfill existing registered users with unique, non-sequential random identifiers
DO $$
DECLARE
  r RECORD;
  rand_num INT;
  taken BOOLEAN;
  attempts INT;
BEGIN
  FOR r IN SELECT id, university_id FROM users WHERE university_id IS NOT NULL LOOP
    -- Only generate if user does not already have an identity
    IF NOT EXISTS (SELECT 1 FROM confession_user_identities WHERE user_id = r.id) THEN
      attempts := 0;
      LOOP
        attempts := attempts + 1;
        -- Generate random number between 101 and 9999
        rand_num := floor(random() * (9999 - 101 + 1) + 101)::INT;
        
        -- If attempted many times, expand range to avoid infinite loop
        IF attempts > 100 THEN
          rand_num := floor(random() * (999999 - 10000 + 1) + 10000)::INT;
        END IF;

        SELECT EXISTS(
          SELECT 1 FROM confession_user_identities 
          WHERE university_id = r.university_id AND identity_number = rand_num
        ) INTO taken;

        IF NOT taken THEN
          INSERT INTO confession_user_identities (user_id, university_id, identity_number, identity_code, avatar_seed)
          VALUES (r.id, r.university_id, rand_num, 'Anonymous #' || rand_num, 'seed_' || rand_num)
          ON CONFLICT (user_id) DO NOTHING;
          EXIT;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END $$;
