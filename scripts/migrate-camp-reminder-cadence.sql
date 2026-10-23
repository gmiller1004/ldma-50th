-- Balance reminder cadence: 5 days before the due date, then on the due date if still unpaid.
ALTER TABLE camp_reservations
  ADD COLUMN IF NOT EXISTS balance_reminder_5d_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS balance_reminder_due_sent_at TIMESTAMPTZ;

ALTER TABLE camp_billing_periods
  ADD COLUMN IF NOT EXISTS balance_reminder_5d_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS balance_reminder_due_sent_at TIMESTAMPTZ;
