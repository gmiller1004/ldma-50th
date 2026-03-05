-- Member rewards: points and tiers (backend-only; members-only perk)
-- Run after community schema exists. Keyed by Salesforce contact_id (logged-in member identity).

-- One row per member: balance, lifetime total, tier
CREATE TABLE IF NOT EXISTS member_rewards (
  contact_id TEXT PRIMARY KEY,
  points_balance INT NOT NULL DEFAULT 0,
  lifetime_points INT NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'camper' CHECK (tier IN ('camper', 'prospector', 'miner', 'sourdough')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log of every point grant (optional; enables idempotency and reporting)
CREATE TABLE IF NOT EXISTS member_point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id TEXT NOT NULL,
  points_delta INT NOT NULL,
  reason TEXT NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency: one transaction per (reference_type, reference_id) when both set
CREATE UNIQUE INDEX IF NOT EXISTS idx_point_tx_reference
  ON member_point_transactions (reference_type, reference_id)
  WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_point_tx_contact ON member_point_transactions(contact_id);
CREATE INDEX IF NOT EXISTS idx_point_tx_created ON member_point_transactions(created_at DESC);
