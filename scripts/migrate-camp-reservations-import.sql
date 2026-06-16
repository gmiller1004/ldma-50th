-- ResNexus import metadata on reservations.
-- Run after migrate-camp-billing-periods.sql.

ALTER TABLE camp_reservations
  ADD COLUMN IF NOT EXISTS external_res_number TEXT,
  ADD COLUMN IF NOT EXISTS import_source TEXT,
  ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_camp_reservations_resnexus_import
  ON camp_reservations (camp_slug, external_res_number)
  WHERE external_res_number IS NOT NULL AND import_source = 'resnexus';

CREATE UNIQUE INDEX IF NOT EXISTS idx_camp_billing_periods_reservation_start
  ON camp_billing_periods (reservation_id, period_start);
