-- Camp sites v2: site_code, monthly member rate, special type (from camp-reservations master).
-- Run after migrate-camp-sites.sql.

ALTER TABLE camp_sites
  ADD COLUMN IF NOT EXISTS site_code TEXT,
  ADD COLUMN IF NOT EXISTS member_rate_monthly NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS special_type TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_camp_sites_camp_site_code
  ON camp_sites (camp_slug, site_code)
  WHERE site_code IS NOT NULL;
