-- Add code_verifier for PKCE (public client) OAuth flow
-- Headless channel may be configured as Public client; PKCE produces shcat_ tokens

ALTER TABLE oauth_state ADD COLUMN IF NOT EXISTS code_verifier TEXT;
