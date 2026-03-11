-- Camp payments: record of cash or card payments for reservations and/or past-due (maintenance/membership).
-- Run after migrate-camp-reservations.sql.

CREATE TABLE IF NOT EXISTS camp_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_slug TEXT NOT NULL,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('reservation', 'past_due')),
  method TEXT NOT NULL CHECK (method IN ('cash', 'card')),
  amount_cents INT NOT NULL CHECK (amount_cents > 0),
  stripe_checkout_session_id TEXT UNIQUE,
  reservation_id UUID REFERENCES camp_reservations(id) ON DELETE SET NULL,
  member_contact_id TEXT,
  member_number TEXT,
  member_email TEXT NOT NULL,
  recipient_display_name TEXT NOT NULL,
  maintenance_amount_cents INT,
  membership_amount_cents INT,
  created_by_contact_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  receipt_sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_camp_payments_camp ON camp_payments(camp_slug);
CREATE INDEX IF NOT EXISTS idx_camp_payments_reservation ON camp_payments(reservation_id);
CREATE INDEX IF NOT EXISTS idx_camp_payments_stripe ON camp_payments(stripe_checkout_session_id) WHERE stripe_checkout_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_camp_payments_created ON camp_payments(created_at);
