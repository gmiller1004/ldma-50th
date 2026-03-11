-- Camp sites: bookable sites per camp. Seed from CSV (e.g. data/camp-sites/burnt-river-sites.csv).
-- camp_slug matches directory camp slugs (e.g. burnt-river-oregon).

CREATE TABLE IF NOT EXISTS camp_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_slug TEXT NOT NULL,
  name TEXT NOT NULL,
  site_type TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  member_rate_daily NUMERIC(10, 2),
  non_member_rate_daily NUMERIC(10, 2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_camp_sites_camp_name ON camp_sites(camp_slug, name);
CREATE INDEX IF NOT EXISTS idx_camp_sites_camp ON camp_sites(camp_slug);
CREATE INDEX IF NOT EXISTS idx_camp_sites_camp_sort ON camp_sites(camp_slug, sort_order);
