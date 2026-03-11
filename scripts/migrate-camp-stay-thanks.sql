-- Track thank-you emails sent for ended stays (reservations, member check-ins, guest check-ins).
-- Used by cron job to send one thank-you per stay after check-out and avoid duplicates.
-- Run after migrate-camp-reservations.sql and migrate-caretaker-guest-check-ins.sql.

CREATE TABLE IF NOT EXISTS camp_stay_thanks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stay_type TEXT NOT NULL CHECK (stay_type IN ('reservation', 'member_check_in', 'guest_check_in')),
  stay_id UUID NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (stay_type, stay_id)
);

CREATE INDEX IF NOT EXISTS idx_camp_stay_thanks_lookup ON camp_stay_thanks(stay_type, stay_id);
