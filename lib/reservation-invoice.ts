/**
 * Per-camp sequential invoice numbers for reservations.
 */

import { sql, hasDb } from "@/lib/db";

/** Short prefix per camp slug for human-readable invoice numbers. */
export const CAMP_INVOICE_PREFIX: Record<string, string> = {
  "stanton-arizona": "STA",
  "italian-bar-california": "IB",
  "duisenburg-california": "DU",
  "blue-bucket-oregon": "BB",
  "burnt-river-oregon": "BR",
  "oconee-south-carolina": "OC",
  "loud-mine-georgia": "LM",
  "vein-mountain-north-carolina": "VM",
};

export function formatInvoiceNumber(campSlug: string, year: number, sequence: number): string {
  const prefix = CAMP_INVOICE_PREFIX[campSlug] ?? campSlug.slice(0, 3).toUpperCase();
  return `${prefix}-${year}-${String(sequence).padStart(4, "0")}`;
}

/** Allocate next invoice number for a camp (atomic per camp+year). */
export async function allocateReservationInvoiceNumber(campSlug: string): Promise<string | null> {
  if (!hasDb() || !sql) return null;
  const year = new Date().getFullYear();

  const rows = await sql`
    INSERT INTO camp_invoice_sequences (camp_slug, year, last_number)
    VALUES (${campSlug}, ${year}, 1)
    ON CONFLICT (camp_slug, year) DO UPDATE
      SET last_number = camp_invoice_sequences.last_number + 1
    RETURNING last_number
  `;
  const seq = (Array.isArray(rows) ? rows[0] : undefined) as { last_number: number } | undefined;
  if (!seq?.last_number) return null;
  return formatInvoiceNumber(campSlug, year, seq.last_number);
}
