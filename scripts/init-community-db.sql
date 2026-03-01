-- Community directory schema for LDMA Phase 3 & 4
-- Run against your Postgres (Neon) database after connecting via Vercel Marketplace

-- Members: synced from Salesforce when user logs in; used for attribution when gating
CREATE TABLE IF NOT EXISTS community_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salesforce_contact_id TEXT UNIQUE,
  member_number TEXT,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Discussions: trip reports, find reports, camp updates — each starts a thread
CREATE TABLE IF NOT EXISTS community_discussions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_slug TEXT NOT NULL,
  author_member_id UUID REFERENCES community_members(id) ON DELETE SET NULL,
  author_display_name TEXT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discussions_camp_slug ON community_discussions(camp_slug);
CREATE INDEX IF NOT EXISTS idx_discussions_created_at ON community_discussions(created_at DESC);

-- Comments: nested replies on discussions
CREATE TABLE IF NOT EXISTS community_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id UUID NOT NULL REFERENCES community_discussions(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES community_comments(id) ON DELETE CASCADE,
  author_member_id UUID REFERENCES community_members(id) ON DELETE SET NULL,
  author_display_name TEXT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_discussion_id ON community_comments(discussion_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON community_comments(parent_id);

-- Photos: attached to discussions or comments, stored in Vercel Blob
CREATE TABLE IF NOT EXISTS community_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id UUID REFERENCES community_discussions(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES community_comments(id) ON DELETE CASCADE,
  blob_url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT photo_ref CHECK (discussion_id IS NOT NULL OR comment_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_photos_discussion_id ON community_photos(discussion_id);
CREATE INDEX IF NOT EXISTS idx_photos_comment_id ON community_photos(comment_id);

-- Video links: YouTube/Vimeo embeds (URLs only)
CREATE TABLE IF NOT EXISTS community_video_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id UUID REFERENCES community_discussions(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES community_comments(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT video_ref CHECK (discussion_id IS NOT NULL OR comment_id IS NOT NULL)
);
