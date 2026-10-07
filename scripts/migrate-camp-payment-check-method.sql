-- Allow caretakers to record payments made by check (handled like cash for refunds/voids).

ALTER TABLE camp_payments DROP CONSTRAINT IF EXISTS camp_payments_method_check;

ALTER TABLE camp_payments
  ADD CONSTRAINT camp_payments_method_check CHECK (method IN ('cash', 'card', 'check'));
