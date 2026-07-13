-- Caretaker can waive the site-fee cancellation fee; flag stays on the reservation for audit.

ALTER TABLE camp_reservations
  ADD COLUMN IF NOT EXISTS cancellation_fee_waived BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cancellation_fee_waived_cents INT,
  ADD COLUMN IF NOT EXISTS cancellation_fee_waived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_fee_waived_by_contact_id TEXT;

CREATE INDEX IF NOT EXISTS idx_camp_reservations_cancellation_fee_waived
  ON camp_reservations (camp_slug, cancellation_fee_waived)
  WHERE cancellation_fee_waived = TRUE;
