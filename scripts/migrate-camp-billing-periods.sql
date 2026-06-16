-- Billing periods for rolling 30-day site-fee collection on reservations.
-- Run after migrate-camp-reservations.sql and migrate-camp-payments.sql.

CREATE TABLE IF NOT EXISTS camp_billing_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES camp_reservations(id) ON DELETE CASCADE,
  period_index INT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  nights INT NOT NULL CHECK (nights > 0),
  amount_due_cents INT NOT NULL CHECK (amount_due_cents >= 0),
  amount_paid_cents INT NOT NULL DEFAULT 0 CHECK (amount_paid_cents >= 0),
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (status IN ('unpaid', 'partial', 'paid', 'waived', 'cancelled')),
  pricing_basis TEXT NOT NULL
    CHECK (pricing_basis IN ('member_monthly_prorated', 'member_daily', 'guest_daily')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (reservation_id, period_index)
);

CREATE INDEX IF NOT EXISTS idx_camp_billing_periods_reservation
  ON camp_billing_periods (reservation_id);
CREATE INDEX IF NOT EXISTS idx_camp_billing_periods_due
  ON camp_billing_periods (due_date, status);

ALTER TABLE camp_payments
  ADD COLUMN IF NOT EXISTS billing_period_id UUID REFERENCES camp_billing_periods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

CREATE INDEX IF NOT EXISTS idx_camp_payments_billing_period
  ON camp_payments (billing_period_id)
  WHERE billing_period_id IS NOT NULL;
