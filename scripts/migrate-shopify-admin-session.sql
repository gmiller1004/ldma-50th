-- Stores offline Admin API access token after OAuth install (optional if using client-credentials only).
CREATE TABLE IF NOT EXISTS shopify_admin_session (
  shop_domain TEXT PRIMARY KEY,
  access_token TEXT NOT NULL,
  scope TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
