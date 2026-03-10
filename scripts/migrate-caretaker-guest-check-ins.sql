-- Caretaker guest check-ins: non-members checked in at a camp. No points. Separate table for guest marketing.
-- Run after migrate-caretaker-check-ins.sql. camp_slug matches directory camp slugs.

CREATE TABLE IF NOT EXISTS caretaker_guest_check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_slug TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  nights INT NOT NULL,
  created_by_contact_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_caretaker_guest_check_ins_camp ON caretaker_guest_check_ins(camp_slug);
CREATE INDEX IF NOT EXISTS idx_caretaker_guest_check_ins_dates ON caretaker_guest_check_ins(check_in_date, check_out_date);
CREATE INDEX IF NOT EXISTS idx_caretaker_guest_check_ins_email ON caretaker_guest_check_ins(email);
