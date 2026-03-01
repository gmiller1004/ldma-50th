-- Migration: Add refresh_token for Customer Account API (OAuth) tokens
-- OAuth returns access_token + refresh_token; we store both for token renewal

ALTER TABLE member_shopify_tokens
  ADD COLUMN IF NOT EXISTS refresh_token TEXT;

-- Backfill: existing rows without refresh_token are Storefront API tokens.
-- They will be cleared when expired; no backfill needed.