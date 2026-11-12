-- "Questions about LDMA Membership?" form submissions and their follow-up tracking.
CREATE TABLE IF NOT EXISTS membership_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT,
  contact_method TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  questions TEXT,
  sf_contact_id TEXT,
  sf_task_id TEXT,
  staff_notified_at TIMESTAMPTZ,
  klaviyo_synced_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS membership_questions_created_idx ON membership_questions (created_at);
