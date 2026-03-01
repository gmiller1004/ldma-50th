-- Migration: Add edit support (author_contact_id) and reactions (thumbs up/down)
-- Run after init-community-db.sql

-- Add author_contact_id for edit permission check
ALTER TABLE community_discussions ADD COLUMN IF NOT EXISTS author_contact_id TEXT;
ALTER TABLE community_comments ADD COLUMN IF NOT EXISTS author_contact_id TEXT;

-- Reactions: one per voter per target (discussion or comment)
CREATE TABLE IF NOT EXISTS community_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_discussion_id UUID REFERENCES community_discussions(id) ON DELETE CASCADE,
  target_comment_id UUID REFERENCES community_comments(id) ON DELETE CASCADE,
  voter_contact_id TEXT NOT NULL,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('up', 'down')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT reaction_target_check CHECK (
    (target_discussion_id IS NOT NULL AND target_comment_id IS NULL) OR
    (target_discussion_id IS NULL AND target_comment_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reactions_discussion_voter
  ON community_reactions (target_discussion_id, voter_contact_id)
  WHERE target_discussion_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reactions_comment_voter
  ON community_reactions (target_comment_id, voter_contact_id)
  WHERE target_comment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reactions_discussion ON community_reactions(target_discussion_id);
CREATE INDEX IF NOT EXISTS idx_reactions_comment ON community_reactions(target_comment_id);
