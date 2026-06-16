-- Cancellation refunds: refund payment type + reservation audit columns.

ALTER TABLE camp_payments DROP CONSTRAINT IF EXISTS camp_payments_payment_type_check;
ALTER TABLE camp_payments
  ADD CONSTRAINT camp_payments_payment_type_check
  CHECK (payment_type IN ('reservation', 'past_due', 'refund'));

ALTER TABLE camp_payments
  ADD COLUMN IF NOT EXISTS stripe_refund_id TEXT,
  ADD COLUMN IF NOT EXISTS refunded_payment_id UUID REFERENCES camp_payments(id) ON DELETE SET NULL;

ALTER TABLE camp_reservations
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_refund_cents INT;

CREATE INDEX IF NOT EXISTS idx_camp_payments_refund_reservation
  ON camp_payments (reservation_id)
  WHERE payment_type = 'refund';
