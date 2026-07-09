-- Public web self-service camp reservations: confirmation email tracking + booked type label.
-- Run after migrate-camp-reservations-import.sql

ALTER TABLE camp_reservations
  ADD COLUMN IF NOT EXISTS confirmation_email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS booked_site_type_label TEXT;

CREATE INDEX IF NOT EXISTS idx_camp_reservations_public_confirmation_pending
  ON camp_reservations (created_at)
  WHERE import_source = 'public_web' AND confirmation_email_sent_at IS NULL;
