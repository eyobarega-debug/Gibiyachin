-- Gibiyachin Platform — Migration 021: Actionable Notifications Schema Extensions
-- Adds deep linking metadata columns to notifications:
--   target_route: relative URL path with query parameters (e.g. /orders?orderId=...)
--   target_entity_type: type of entity (e.g. order, payment, ticket, event, rental_booking, etc.)
--   target_entity_id: identifier of the entity (e.g. order UUID, ticket UUID)
-- Adds performance indexes for user notifications and target entity lookups.

BEGIN;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS target_route TEXT,
  ADD COLUMN IF NOT EXISTS target_entity_type TEXT,
  ADD COLUMN IF NOT EXISTS target_entity_id TEXT;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_target ON notifications (target_entity_type, target_entity_id);

COMMIT;

