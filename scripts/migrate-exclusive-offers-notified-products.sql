-- Track which exclusive-offers products we've already sent notification emails for.
-- Run via: npm run db:migrate (included in migrate-community.mjs)

CREATE TABLE IF NOT EXISTS exclusive_offers_notified_products (
  shopify_product_id TEXT PRIMARY KEY,
  notified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
