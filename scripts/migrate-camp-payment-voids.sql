-- Voided cash entries: snapshot of the removed camp_payments row plus who voided it and why.

CREATE TABLE IF NOT EXISTS camp_payment_voids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_payment_id UUID NOT NULL UNIQUE,
  camp_slug TEXT NOT NULL,
  reservation_id UUID REFERENCES camp_reservations(id) ON DELETE SET NULL,
  payment_type TEXT NOT NULL,
  method TEXT NOT NULL,
  amount_cents INT NOT NULL,
  original_created_at TIMESTAMPTZ NOT NULL,
  original_created_by_contact_id TEXT,
  payment_snapshot JSONB NOT NULL,
  reason TEXT NOT NULL,
  voided_by_contact_id TEXT NOT NULL,
  voided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_camp_payment_voids_reservation ON camp_payment_voids(reservation_id);
CREATE INDEX IF NOT EXISTS idx_camp_payment_voids_camp ON camp_payment_voids(camp_slug, voided_at);
