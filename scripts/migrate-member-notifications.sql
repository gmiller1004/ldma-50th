-- Migration: Add member notification preferences for daily comment digest
-- Run after migrate-member-avatars.sql

CREATE TABLE IF NOT EXISTS member_notification_preferences (
  member_number TEXT PRIMARY KEY,
  comment_digest_enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
