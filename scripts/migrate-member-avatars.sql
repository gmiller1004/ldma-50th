-- Migration: Add member_avatars table for profile pictures
-- Run after migrate-community-edit-reactions.sql

CREATE TABLE IF NOT EXISTS member_avatars (
  contact_id TEXT PRIMARY KEY,
  avatar_url TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
