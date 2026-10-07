-- ResNexus payment credit carried over on import (no camp_payments row).
-- Net paid = camp_payments net + imported_paid_cents, so portal payments add on top of it.

ALTER TABLE camp_reservations
  ADD COLUMN IF NOT EXISTS imported_paid_cents INT NOT NULL DEFAULT 0
    CHECK (imported_paid_cents >= 0);

-- Backfill: the credit currently held only on billing periods (period paid beyond the ledger).
UPDATE camp_reservations r
SET imported_paid_cents = x.credit, updated_at = NOW()
FROM (
  SELECT r2.id,
    GREATEST(0,
      COALESCE((SELECT SUM(p.amount_paid_cents) FROM camp_billing_periods p
                WHERE p.reservation_id = r2.id AND p.status <> 'cancelled'), 0)
      - COALESCE((SELECT SUM(CASE WHEN c.payment_type = 'refund' THEN -c.amount_cents ELSE c.amount_cents END)
                  FROM camp_payments c
                  WHERE c.reservation_id = r2.id AND c.payment_type IN ('reservation', 'refund')), 0)
    )::int AS credit
  FROM camp_reservations r2
  WHERE r2.import_source = 'resnexus' AND r2.imported_paid_cents = 0
) x
WHERE r.id = x.id AND x.credit > 0;
