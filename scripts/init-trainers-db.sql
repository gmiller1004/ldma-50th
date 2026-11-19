-- LDMA Certified Trainers directory. Additive and safe to re-run.

CREATE TABLE IF NOT EXISTS trainers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  title TEXT,
  summary TEXT,
  body_html TEXT NOT NULL DEFAULT '',
  photo_url TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  website_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trainers_published
  ON trainers (sort_order, name)
  WHERE published_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trainers_sort
  ON trainers (sort_order, name);

CREATE TABLE IF NOT EXISTS trainer_events (
  trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  product_gid TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (trainer_id, product_gid)
);
