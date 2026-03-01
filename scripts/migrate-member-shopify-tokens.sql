-- Migration: Store Shopify customer access tokens for purchase history
-- Links LDMA member to their MyLDMA store account for order display

CREATE TABLE IF NOT EXISTS member_shopify_tokens (
  member_number TEXT PRIMARY KEY,
  customer_access_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
