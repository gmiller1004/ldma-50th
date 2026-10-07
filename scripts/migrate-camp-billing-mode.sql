-- Per-reservation billing schedule. NULL = legacy rolling 30-day periods.
-- New reservations store their camp's default (lib/camp-billing-mode.ts).

ALTER TABLE camp_reservations
  ADD COLUMN IF NOT EXISTS billing_mode TEXT
    CHECK (billing_mode IS NULL OR billing_mode IN ('rolling_30', 'calendar_month'));
