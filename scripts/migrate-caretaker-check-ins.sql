-- Caretaker check-ins: member checked in at a camp (by caretaker), with dates and points awarded.
-- Run after migrate-member-rewards.sql. camp_slug matches directory camp slugs.

CREATE TABLE IF NOT EXISTS caretaker_check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_slug TEXT NOT NULL,
  member_contact_id TEXT NOT NULL,
  member_number TEXT NOT NULL,
  member_display_name TEXT,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  nights INT NOT NULL,
  points_awarded INT NOT NULL DEFAULT 0,
  created_by_contact_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_caretaker_check_ins_camp ON caretaker_check_ins(camp_slug);
CREATE INDEX IF NOT EXISTS idx_caretaker_check_ins_dates ON caretaker_check_ins(check_in_date, check_out_date);
CREATE INDEX IF NOT EXISTS idx_caretaker_check_ins_member ON caretaker_check_ins(member_contact_id);
