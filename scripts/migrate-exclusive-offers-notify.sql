-- Add exclusive offers email preference to member notification preferences
-- Run once: psql $POSTGRES_URL -f scripts/migrate-exclusive-offers-notify.sql
-- Or use your Neon SQL editor.

ALTER TABLE member_notification_preferences
  ADD COLUMN IF NOT EXISTS exclusive_offers_notify BOOLEAN NOT NULL DEFAULT false;
