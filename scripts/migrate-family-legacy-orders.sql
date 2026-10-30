-- $600 Complete Family Legacy offer orders (Stripe), with Salesforce follow-up tracking.
CREATE TABLE IF NOT EXISTS family_legacy_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id TEXT NOT NULL,
  member_number TEXT,
  member_name TEXT,
  member_email TEXT,
  sf_checkboxes_before TEXT,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_payment',
  companion_name TEXT,
  companion_relationship TEXT,
  heir_name TEXT,
  heir_relationship TEXT,
  notes TEXT,
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  paid_at TIMESTAMPTZ,
  sf_status_updated_at TIMESTAMPTZ,
  sf_task_id TEXT,
  sf_task_owner_id TEXT,
  owner_name TEXT,
  owner_email TEXT,
  owner_notified_at TIMESTAMPTZ,
  member_confirmation_sent_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS family_legacy_orders_contact_idx ON family_legacy_orders (contact_id, status);
