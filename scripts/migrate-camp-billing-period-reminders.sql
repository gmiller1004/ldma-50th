-- Billing-period balance reminder sent-at columns (months 2+ on long stays).
ALTER TABLE camp_billing_periods
  ADD COLUMN IF NOT EXISTS balance_reminder_14d_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS balance_reminder_7d_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS balance_reminder_3d_sent_at TIMESTAMPTZ;
