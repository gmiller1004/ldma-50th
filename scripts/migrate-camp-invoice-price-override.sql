-- Invoice numbers + price override audit on reservations; invoice copy on payments.

CREATE TABLE IF NOT EXISTS camp_invoice_sequences (
  camp_slug TEXT NOT NULL,
  year INT NOT NULL,
  last_number INT NOT NULL DEFAULT 0,
  PRIMARY KEY (camp_slug, year)
);

ALTER TABLE camp_reservations
  ADD COLUMN IF NOT EXISTS invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS calculated_total_cents INT,
  ADD COLUMN IF NOT EXISTS amount_override_cents INT,
  ADD COLUMN IF NOT EXISTS override_reason TEXT,
  ADD COLUMN IF NOT EXISTS price_override_flag BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_camp_reservations_invoice_number
  ON camp_reservations (camp_slug, invoice_number)
  WHERE invoice_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_camp_reservations_price_override
  ON camp_reservations (camp_slug, price_override_flag)
  WHERE price_override_flag = TRUE;

ALTER TABLE camp_payments
  ADD COLUMN IF NOT EXISTS invoice_number TEXT;
