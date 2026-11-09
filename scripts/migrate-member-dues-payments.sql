-- Member self-service dues payments (Stripe) that Member Services applies in Salesforce.
CREATE TABLE IF NOT EXISTS member_dues_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id TEXT NOT NULL,
  member_number TEXT,
  member_name TEXT,
  member_email TEXT,
  maintenance_choice TEXT,
  membership_choice TEXT,
  maintenance_label TEXT,
  membership_label TEXT,
  maintenance_cents INTEGER NOT NULL DEFAULT 0,
  membership_cents INTEGER NOT NULL DEFAULT 0,
  amount_cents INTEGER NOT NULL,
  balances_before JSONB,
  on_autopay BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'pending_payment',
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  paid_at TIMESTAMPTZ,
  staff_notified_at TIMESTAMPTZ,
  member_receipt_sent_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS member_dues_payments_contact_idx ON member_dues_payments (contact_id, status, paid_at);
