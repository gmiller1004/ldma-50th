-- Director Season Totals weekly snapshots (idempotent).
CREATE TABLE IF NOT EXISTS director_season_total_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_slug TEXT NOT NULL,
  season_from DATE NOT NULL,
  season_to DATE NOT NULL,
  snapshot_date DATE NOT NULL,
  site_nights_booked INTEGER NOT NULL,
  site_nights_available INTEGER NOT NULL,
  total_site_nights INTEGER NOT NULL,
  booked_percent NUMERIC(6, 1) NOT NULL,
  available_percent NUMERIC(6, 1) NOT NULL,
  revenue_collected_cents INTEGER NOT NULL,
  revenue_owed_cents INTEGER NOT NULL,
  total_reservations INTEGER NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_by_contact_id TEXT,
  CONSTRAINT director_season_total_snapshots_range_chk CHECK (season_from <= season_to)
);

CREATE UNIQUE INDEX IF NOT EXISTS director_season_total_snapshots_unique
  ON director_season_total_snapshots (camp_slug, season_from, season_to, snapshot_date);

CREATE INDEX IF NOT EXISTS director_season_total_snapshots_camp_season_idx
  ON director_season_total_snapshots (camp_slug, season_from, season_to, snapshot_date);
