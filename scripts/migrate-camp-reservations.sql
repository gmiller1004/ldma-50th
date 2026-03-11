-- Camp reservations: site + dates + member or guest. One reservation per site per date range (no overlap).
-- Run after migrate-camp-sites.sql.

CREATE TABLE IF NOT EXISTS camp_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES camp_sites(id) ON DELETE RESTRICT,
  camp_slug TEXT NOT NULL,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  nights INT NOT NULL,
  reservation_type TEXT NOT NULL CHECK (reservation_type IN ('member', 'guest')),
  member_contact_id TEXT,
  member_number TEXT,
  member_display_name TEXT,
  guest_first_name TEXT,
  guest_last_name TEXT,
  guest_email TEXT,
  guest_phone TEXT,
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'checked_in', 'completed', 'cancelled')),
  checked_in_at TIMESTAMPTZ,
  created_by_contact_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_camp_reservations_site ON camp_reservations(site_id);
CREATE INDEX IF NOT EXISTS idx_camp_reservations_camp ON camp_reservations(camp_slug);
CREATE INDEX IF NOT EXISTS idx_camp_reservations_dates ON camp_reservations(check_in_date, check_out_date);
CREATE INDEX IF NOT EXISTS idx_camp_reservations_status ON camp_reservations(status);
-- Overlap (same site, overlapping dates, status != cancelled) is enforced in application on insert/update.
