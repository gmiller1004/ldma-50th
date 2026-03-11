-- Event-participant reservations: free included dry site or upgrade to hookup (e.g. Dirt Fest).
-- Run after migrate-camp-reservations.sql.

ALTER TABLE camp_reservations
  ADD COLUMN IF NOT EXISTS event_product_handle TEXT,
  ADD COLUMN IF NOT EXISTS event_site_type TEXT;

-- Only allow event_site_type when event_product_handle is set (enforced in app; optional DB constraint)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_camp_reservations_event_site_type'
  ) THEN
    ALTER TABLE camp_reservations
      ADD CONSTRAINT chk_camp_reservations_event_site_type
      CHECK (event_site_type IS NULL OR (event_product_handle IS NOT NULL AND event_site_type IN ('included_dry', 'upgrade_hookup')));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_camp_reservations_event ON camp_reservations(event_product_handle) WHERE event_product_handle IS NOT NULL;
