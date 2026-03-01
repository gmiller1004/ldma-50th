-- Migration: OAuth state storage for Shopify callback
-- Cookies may not be sent when Shopify redirects to our callback (SameSite).
-- Store state -> member_number server-side so callback doesn't need the session.

CREATE TABLE IF NOT EXISTS oauth_state (
  state TEXT PRIMARY KEY,
  member_number TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

-- Optional: clean up old rows (run periodically or on lookup)
CREATE INDEX IF NOT EXISTS idx_oauth_state_expires ON oauth_state (expires_at);
