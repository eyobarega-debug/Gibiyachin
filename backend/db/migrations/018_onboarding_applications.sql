-- Gibiychin (CampusHub) — Migration 018: Merchant & Event Organizer onboarding
--
-- Adds the platform terms/agreement infrastructure and the organizer
-- application flow that mirrors the existing merchant application flow:
--
--   1. agreement_versions  — versioned platform terms (merchant + organizer)
--   2. application_agreements — immutable record of which terms a user
--                               accepted, tied to the application it was
--                               accepted for
--   3. organizer_applications  — organizer onboarding applications
--   4. merchant_applications   — adds submitted_at / reviewed_by columns
--   5. tenant triggers extended to the new tables
--
-- Safe to run on live databases and completely idempotent (re-running is a
-- no-op, including the seeded terms).

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Versioned platform terms
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agreement_versions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_type TEXT NOT NULL,               -- 'merchant_terms' | 'organizer_terms'
  version        TEXT NOT NULL,               -- e.g. '1.0', '2.0'
  title          TEXT NOT NULL,
  intro          TEXT NOT NULL DEFAULT '',
  content        JSONB NOT NULL DEFAULT '[]', -- [{ heading, items: [...] }]
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_by     UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT agreement_versions_type_chk CHECK (agreement_type IN ('merchant_terms', 'organizer_terms')),
  CONSTRAINT agreement_versions_unique UNIQUE (agreement_type, version)
);

-- Only one active version per agreement type at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uq_agreement_versions_active
  ON agreement_versions (agreement_type) WHERE is_active;

-- Seed Merchant Terms v1.0 (platform draft — must be reviewed/finalized by
-- the project owner or legal advisor before real-world launch).
INSERT INTO agreement_versions (agreement_type, version, title, intro, content, is_active)
SELECT 'merchant_terms', '1.0', 'Gibiychin Merchant Terms v1.0',
  'These terms govern selling on the Gibiychin (ግቢያችን) campus marketplace. They are platform terms provided as a starting point and should be reviewed and finalized by the project owner or a legal advisor before real-world launch. The platform commission rate applied to your sales is shown above and is configured by platform administrators.',
  '[
    {"heading":"1. Platform commission","items":[
      "Gibiychin charges a commission on each completed sale. The current commission rate is displayed with these terms and is configured by platform administrators — it is not fixed permanently.",
      "The commission is deducted automatically from the sale amount before your payout.",
      "Commission rates may change; you will be notified of material changes and continued use of the platform constitutes acceptance of the updated rate for new sales."
    ]},
    {"heading":"2. Payment and settlement","items":[
      "Buyers pay through Gibiychin''s supported payment methods. You must keep a valid payout account (e.g. CBE, Telebirr, Awash) in your merchant settings.",
      "Settlements are processed by campus administrators according to the platform payout schedule.",
      "You are responsible for any taxes or fees arising from your sales under applicable law."
    ]},
    {"heading":"3. Product listing responsibilities","items":[
      "Listings must be accurate: title, description, price, stock quantity and images must match the actual product.",
      "You must maintain adequate stock and update listings promptly when availability changes.",
      "Duplicate or misleading listings are prohibited."
    ]},
    {"heading":"4. Product authenticity","items":[
      "You may only sell genuine, lawful products. Counterfeit or replica goods are strictly prohibited.",
      "You must be able to provide proof of authenticity or sourcing upon request by campus administrators."
    ]},
    {"heading":"5. Prohibited products","items":[
      "The following may not be sold: weapons, drugs, alcohol, tobacco/vaping products, stolen goods, academic materials that violate copyright (e.g. pirated textbooks), explicit material, or any item prohibited by Ethiopian law or university policy.",
      "Gibiychin may remove prohibited listings immediately and suspend the associated account."
    ]},
    {"heading":"6. Order fulfillment","items":[
      "You must confirm orders promptly and hand over products to buyers within the timeframe stated in your listing or as agreed.",
      "Failure to fulfill orders may result in penalties, refunds charged to you, or suspension."
    ]},
    {"heading":"7. Cancellation rules","items":[
      "Buyers may request cancellation before handover. You must honor reasonable cancellation requests.",
      "Repeated seller-side cancellations without cause may lead to penalties or suspension."
    ]},
    {"heading":"8. Refund rules","items":[
      "If a product is not as described, defective, or never delivered, the buyer is entitled to a refund.",
      "Refunds are issued through the platform and may be deducted from your balance or future payouts.",
      "Gibiychin may decide refund disputes where the parties cannot agree."
    ]},
    {"heading":"9. Customer disputes","items":[
      "Disputes between you and buyers must be handled in good faith through the platform.",
      "Campus administrators may review evidence and make binding decisions within the platform (including refunds and sanctions)."
    ]},
    {"heading":"10. Customer privacy","items":[
      "You may use buyer information solely for fulfilling the order. Sharing or misusing customer data is prohibited.",
      "You must delete buyer personal data once it is no longer needed for order fulfillment or legal compliance."
    ]},
    {"heading":"11. Platform conduct","items":[
      "You must not manipulate reviews, spam buyers, circumvent the platform''s payment flow, or misrepresent your identity or business.",
      "All interactions on the platform must remain respectful and non-discriminatory."
    ]},
    {"heading":"12. Account suspension","items":[
      "Gibiychin may suspend accounts for policy violations, fraud risk, or legal requirements.",
      "Serious or repeated violations may lead to permanent termination."
    ]},
    {"heading":"13. Termination","items":[
      "You may close your merchant account at any time; outstanding obligations (refunds, disputes) survive termination.",
      "Gibiychin may terminate merchant access per the suspension rules above."
    ]},
    {"heading":"14. Fraud prevention","items":[
      "Fraudulent transactions, price manipulation, fake orders, or money-laundering behaviour are strictly prohibited and will result in immediate suspension and reporting where required."
    ]},
    {"heading":"15. Compliance with applicable laws","items":[
      "You must comply with Ethiopian law, university regulations, and any licensing requirements applicable to your products.",
      "Gibiychin may report unlawful activity to the relevant authorities."
    ]}
  ]'::jsonb,
  true
ON CONFLICT (agreement_type, version) DO NOTHING;

-- Seed Organizer Terms v1.0 (same disclaimer).
INSERT INTO agreement_versions (agreement_type, version, title, intro, content, is_active)
SELECT 'organizer_terms', '1.0', 'Gibiychin Organizer Terms v1.0',
  'These terms govern hosting events and selling tickets on Gibiychin (ግቢያችን). They are platform terms provided as a starting point and should be reviewed and finalized by the project owner or a legal advisor before real-world launch. The current ticket commission rate is shown above and is configured by platform administrators.',
  '[
    {"heading":"1. Ticket commission","items":[
      "Gibiychin charges a commission on each paid ticket sold through the platform. The current commission rate is displayed with these terms and is configured by platform administrators — it is not fixed permanently.",
      "The commission is deducted automatically from ticket revenue before your payout.",
      "Free tickets are not commissionable."
    ]},
    {"heading":"2. Payment settlement","items":[
      "Ticket payments are collected by Gibiychin and settled to organizers through the platform payout process.",
      "You must keep a valid payout account in your organizer settings to receive settlements.",
      "You are responsible for any taxes or fees arising from ticket revenue under applicable law."
    ]},
    {"heading":"3. Event information accuracy","items":[
      "Event title, description, date, time, venue, capacity and ticket details must be accurate and not misleading.",
      "You must update or postpone the event through the platform if plans change."
    ]},
    {"heading":"4. Event cancellation","items":[
      "If you cancel an event, ticket holders are entitled to refunds of amounts paid.",
      "Repeated or bad-faith cancellations may lead to sanctions on your organizer account."
    ]},
    {"heading":"5. Ticket refunds","items":[
      "Refund eligibility follows the policy stated on the event page and applicable consumer rules.",
      "Approved refunds are processed through the platform and may be deducted from your balance or future payouts."
    ]},
    {"heading":"6. Event postponement","items":[
      "Postponed events must be updated on the platform with the new date. Ticket holders must be notified through the platform.",
      "Ticket holders may request a refund if the new date does not suit them."
    ]},
    {"heading":"7. QR ticket responsibility","items":[
      "Each ticket carries a signed QR code. You are responsible for verifying QR codes at the gate using the official Gibiychin scanner.",
      "Screenshots or photocopies of QR codes must be rejected; only scans through the platform scanner count as valid verification."
    ]},
    {"heading":"8. Fraudulent and duplicate tickets","items":[
      "Creating, distributing, selling or using fraudulent or duplicate tickets is strictly prohibited.",
      "Selling tickets off-platform to circumvent commission is prohibited while your event is listed on Gibiychin."
    ]},
    {"heading":"9. Organizer responsibility for the event","items":[
      "You are the event organizer and remain responsible for the event''s safety, legality, permits, and conduct towards attendees.",
      "Gibiychin is a ticketing and discovery platform and is not the event producer unless stated otherwise."
    ]},
    {"heading":"10. Attendee information and privacy","items":[
      "Attendee information (name, email) is provided to you solely for running the event.",
      "You must not sell or misuse attendee data and must delete it when it is no longer needed."
    ]},
    {"heading":"11. Customer disputes","items":[
      "Disputes with attendees must be handled in good faith through the platform.",
      "Campus administrators may review evidence and make binding decisions within the platform."
    ]},
    {"heading":"12. Platform conduct","items":[
      "You must not manipulate ticket sales, publish deceptive events, spam users, or circumvent the platform''s payment flow."
    ]},
    {"heading":"13. Account suspension","items":[
      "Gibiychin may suspend organizer accounts for policy violations, fraud risk, or legal requirements.",
      "Serious or repeated violations may lead to permanent termination."
    ]},
    {"heading":"14. Termination","items":[
      "You may stop hosting events at any time; obligations for scheduled events and pending refunds survive termination.",
      "Gibiychin may terminate organizer access per the suspension rules above."
    ]},
    {"heading":"15. Compliance with applicable laws","items":[
      "Events must comply with Ethiopian law, university regulations, and any permits required for the activity.",
      "Gibiychin may report unlawful activity to the relevant authorities."
    ]}
  ]'::jsonb,
  true
ON CONFLICT (agreement_type, version) DO NOTHING;

-- ---------------------------------------------------------------------
-- 2. Agreement records (immutable, versioned)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS application_agreements (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  university_id    UUID REFERENCES universities(id),
  application_type TEXT NOT NULL,             -- 'merchant' | 'organizer'
  application_id   UUID NOT NULL,             -- polymorphic: merchant_applications.id or organizer_applications.id
  agreement_type   TEXT NOT NULL,             -- 'merchant_terms' | 'organizer_terms'
  agreement_version TEXT NOT NULL,
  commission_rate  NUMERIC(6,4),              -- snapshot of the configured rate at acceptance time
  agreed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT application_agreements_type_chk CHECK (application_type IN ('merchant', 'organizer')),
  CONSTRAINT application_agreements_agreement_chk CHECK (agreement_type IN ('merchant_terms', 'organizer_terms'))
);

CREATE INDEX IF NOT EXISTS idx_application_agreements_user
  ON application_agreements (user_id, application_type, agreed_at DESC);
CREATE INDEX IF NOT EXISTS idx_application_agreements_app
  ON application_agreements (application_id);

-- ---------------------------------------------------------------------
-- 3. Organizer applications (mirrors merchant_applications)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizer_applications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  university_id     UUID REFERENCES universities(id),
  organizer_name    TEXT NOT NULL,
  organization_name TEXT,
  description       TEXT,
  phone             TEXT,
  organizer_type    TEXT NOT NULL DEFAULT 'individual',
  document_urls     TEXT[] DEFAULT '{}',
  status            TEXT NOT NULL DEFAULT 'pending_review', -- pending_review | approved | rejected
  reason            TEXT,
  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at        TIMESTAMPTZ,
  reviewed_at       TIMESTAMPTZ,
  reviewed_by       UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT organizer_applications_status_chk CHECK (status IN ('pending_review', 'approved', 'rejected')),
  CONSTRAINT organizer_applications_type_chk CHECK (organizer_type IN ('club', 'association', 'department', 'individual', 'other'))
);

-- Environments that ran an earlier copy of this migration only need the ALTER.
ALTER TABLE organizer_applications ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_organizer_applications_user ON organizer_applications (user_id, status);
CREATE INDEX IF NOT EXISTS idx_organizer_applications_university ON organizer_applications (university_id, status);
CREATE INDEX IF NOT EXISTS idx_organizer_applications_status ON organizer_applications (status, created_at DESC);

-- ---------------------------------------------------------------------
-- 4. Merchant applications: review metadata
-- ---------------------------------------------------------------------
ALTER TABLE merchant_applications ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE merchant_applications ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id);
ALTER TABLE merchant_applications ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

UPDATE merchant_applications SET submitted_at = created_at WHERE submitted_at IS NULL;

-- ---------------------------------------------------------------------
-- 5. Tenant derivation triggers for the new tables
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cn_set_university_id() RETURNS trigger AS $$
DECLARE
  uid UUID;
BEGIN
  -- 1. On UPDATE: strictly enforce immutability of university_id once assigned
  IF TG_OP = 'UPDATE' THEN
    IF OLD.university_id IS NOT NULL AND NEW.university_id IS DISTINCT FROM OLD.university_id THEN
      RAISE EXCEPTION 'TENANT_IMMUTABLE: Changing university_id on existing records is prohibited on table % (old: %, new: %)',
        TG_TABLE_NAME, OLD.university_id, NEW.university_id;
    END IF;
  END IF;

  -- 2. Derive authoritative university_id from parent or owner
  CASE TG_TABLE_NAME
    WHEN 'stores'                THEN SELECT university_id INTO uid FROM users  WHERE id = NEW.merchant_id;
    WHEN 'merchant_applications' THEN SELECT university_id INTO uid FROM users  WHERE id = NEW.user_id;
    WHEN 'organizer_applications' THEN SELECT university_id INTO uid FROM users WHERE id = NEW.user_id;
    WHEN 'application_agreements' THEN SELECT university_id INTO uid FROM users WHERE id = NEW.user_id;
    WHEN 'p2p_listings'          THEN SELECT university_id INTO uid FROM users  WHERE id = NEW.seller_id;
    WHEN 'rental_items'          THEN SELECT university_id INTO uid FROM users  WHERE id = NEW.owner_id;
    WHEN 'reports'               THEN IF NEW.reporter_id IS NOT NULL THEN SELECT university_id INTO uid FROM users WHERE id = NEW.reporter_id; END IF;
    WHEN 'audit_logs'            THEN IF NEW.actor_id IS NOT NULL THEN SELECT university_id INTO uid FROM users WHERE id = NEW.actor_id; END IF;
    WHEN 'orders'                THEN SELECT university_id INTO uid FROM stores WHERE id = NEW.store_id;
    WHEN 'p2p_orders'            THEN SELECT university_id INTO uid FROM p2p_listings WHERE id = NEW.listing_id;
    WHEN 'events'                THEN SELECT university_id INTO uid FROM clubs  WHERE id = NEW.club_id;
    WHEN 'waitlist_entries'      THEN SELECT university_id INTO uid FROM events WHERE id = NEW.event_id;
    WHEN 'rental_bookings'       THEN SELECT university_id INTO uid FROM rental_items WHERE id = NEW.rental_item_id;
    WHEN 'ticket_types'          THEN SELECT university_id INTO uid FROM events WHERE id = NEW.event_id;
    WHEN 'tickets'               THEN SELECT university_id INTO uid FROM events WHERE id = NEW.event_id;
    WHEN 'payout_accounts'       THEN SELECT university_id INTO uid FROM users  WHERE id = NEW.owner_id;
    WHEN 'payment_proofs'        THEN SELECT university_id INTO uid FROM payments WHERE id = NEW.payment_id;
    WHEN 'disputes'              THEN SELECT ri.university_id INTO uid FROM rental_bookings b JOIN rental_items ri ON ri.id = b.rental_item_id WHERE b.id = NEW.booking_id;
    WHEN 'commissions'           THEN SELECT university_id INTO uid FROM payments WHERE id = NEW.payment_id;
    WHEN 'order_status_history'  THEN SELECT university_id INTO uid FROM orders WHERE id = NEW.order_id;
    WHEN 'verification_requests' THEN SELECT university_id INTO uid FROM users WHERE id = NEW.user_id;
    WHEN 'reviews' THEN
      IF NEW.target_type = 'product' THEN
        SELECT s.university_id INTO uid FROM products pr JOIN stores s ON s.id = pr.store_id WHERE pr.id = NEW.target_id;
      ELSIF NEW.target_type = 'store' THEN
        SELECT university_id INTO uid FROM stores WHERE id = NEW.target_id;
      ELSIF NEW.target_type = 'listing' THEN
        SELECT university_id INTO uid FROM p2p_listings WHERE id = NEW.target_id;
      ELSIF NEW.target_type = 'user' THEN
        SELECT university_id INTO uid FROM users WHERE id = NEW.target_id;
      END IF;
      IF uid IS NULL THEN
        SELECT university_id INTO uid FROM users WHERE id = NEW.author_id;
      END IF;
    WHEN 'payments' THEN
      IF NEW.transaction_type = 'order' THEN
        SELECT university_id INTO uid FROM orders WHERE id = NEW.transaction_id;
      ELSIF NEW.transaction_type = 'booking' THEN
        SELECT university_id INTO uid FROM rental_bookings WHERE id = NEW.transaction_id;
        IF uid IS NULL THEN
          SELECT ri.university_id INTO uid FROM rental_bookings b JOIN rental_items ri ON ri.id = b.rental_item_id WHERE b.id = NEW.transaction_id;
        END IF;
      ELSIF NEW.transaction_type = 'ticket' THEN
        SELECT university_id INTO uid FROM tickets WHERE id = NEW.transaction_id;
        IF uid IS NULL THEN
          SELECT e.university_id INTO uid FROM tickets t JOIN events e ON e.id = t.event_id WHERE t.id = NEW.transaction_id;
        END IF;
      ELSIF NEW.transaction_type = 'promotion' THEN
        SELECT s.university_id INTO uid FROM products pr JOIN stores s ON s.id = pr.store_id WHERE pr.id = NEW.transaction_id;
      ELSIF NEW.transaction_type = 'p2p_order' THEN
        SELECT university_id INTO uid FROM p2p_orders WHERE id = NEW.transaction_id;
      END IF;
    ELSE uid := NULL;
  END CASE;

  -- 3. On UPDATE: prevent moving the record to a parent belonging to a different university
  IF TG_OP = 'UPDATE' THEN
    IF OLD.university_id IS NOT NULL AND uid IS NOT NULL AND uid <> OLD.university_id THEN
      RAISE EXCEPTION 'TENANT_MISMATCH: Changing parent reference to another university is prohibited on table % (record tenant: %, new parent tenant: %)',
        TG_TABLE_NAME, OLD.university_id, uid;
    END IF;
    -- Preserve original university_id on update
    IF OLD.university_id IS NOT NULL THEN
      NEW.university_id := OLD.university_id;
      RETURN NEW;
    END IF;
  END IF;

  -- 4. On INSERT (or UPDATE where OLD.university_id was null):
  IF uid IS NOT NULL THEN
    -- If caller supplied explicit university_id, validate that it matches the authoritative parent
    IF NEW.university_id IS NOT NULL AND NEW.university_id <> uid THEN
      RAISE EXCEPTION 'TENANT_MISMATCH: Provided university_id (%) does not match authoritative parent (%) on table %',
        NEW.university_id, uid, TG_TABLE_NAME;
    END IF;
    -- Set or preserve authoritative university_id
    NEW.university_id := uid;
  ELSE
    -- If no authoritative parent exists (e.g. platform-wide record), do not assign an arbitrary tenant
    NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach BEFORE INSERT OR UPDATE triggers across all tenant operational tables
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'stores', 'merchant_applications', 'p2p_listings', 'rental_items', 'orders',
    'events', 'payments', 'reports', 'disputes', 'audit_logs', 'p2p_orders',
    'waitlist_entries', 'rental_bookings', 'ticket_types', 'tickets',
    'payout_accounts', 'payment_proofs', 'reviews',
    'commissions', 'order_status_history', 'verification_requests',
    'organizer_applications', 'application_agreements'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_tenant ON %1$I', t);
    EXECUTE format('CREATE TRIGGER trg_%1$s_tenant BEFORE INSERT OR UPDATE ON %1$I
                    FOR EACH ROW EXECUTE FUNCTION cn_set_university_id()', t);
  END LOOP;
END $$;

COMMIT;
