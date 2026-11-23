-- LDMA Detector Academy "Apply for a Discount" questionnaire submissions.
CREATE TABLE IF NOT EXISTS detector_academy_discount (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT,
  email TEXT NOT NULL,
  membership TEXT NOT NULL,
  qualifier TEXT NOT NULL,
  bring_detector TEXT NOT NULL,
  experience TEXT NOT NULL,
  heard_about TEXT NOT NULL,
  camping TEXT NOT NULL,
  qualifies BOOLEAN NOT NULL DEFAULT FALSE,
  klaviyo_synced_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS detector_academy_discount_created_idx ON detector_academy_discount (created_at);
CREATE INDEX IF NOT EXISTS detector_academy_discount_email_idx ON detector_academy_discount (email);
