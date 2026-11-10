-- LDMA Detector Academy interest questionnaire submissions and their follow-up tracking.
CREATE TABLE IF NOT EXISTS detector_academy_interest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT,
  contact_method TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  owns_detector BOOLEAN NOT NULL,
  detector_brand TEXT,
  garrett_model TEXT,
  sf_contact_id TEXT,
  sf_task_id TEXT,
  staff_notified_at TIMESTAMPTZ,
  klaviyo_synced_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS detector_academy_interest_created_idx ON detector_academy_interest (created_at);
