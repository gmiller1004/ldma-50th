-- Balance reminder tracking for camp reservations.
-- Run after migrate-camp-public-booking.sql

ALTER TABLE camp_reservations
  ADD COLUMN IF NOT EXISTS balance_reminder_14d_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS balance_reminder_7d_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS balance_reminder_3d_sent_at TIMESTAMPTZ;
