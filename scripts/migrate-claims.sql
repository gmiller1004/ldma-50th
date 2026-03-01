-- Migration: Add claims table and claim_id to discussions
-- Run after migrate-member-notifications.sql

CREATE TABLE IF NOT EXISTS claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_slug TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  member_claim_names JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(camp_slug, slug)
);

CREATE INDEX IF NOT EXISTS idx_claims_camp_slug ON claims(camp_slug);

ALTER TABLE community_discussions ADD COLUMN IF NOT EXISTS claim_id UUID REFERENCES claims(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_discussions_claim_id ON community_discussions(claim_id);
