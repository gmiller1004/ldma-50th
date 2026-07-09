/**
 * Date helpers for reservations (check-in / check-out as YYYY-MM-DD, checkout exclusive).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Parse YYYY-MM-DD as local noon to avoid DST edge cases. */
export function parseDateOnly(dateStr: string): Date {
  return new Date(`${dateStr.trim().slice(0, 10)}T12:00:00`);
}

/** Format a Date as YYYY-MM-DD using UTC (matches Postgres DATE via Neon). */
export function formatDateOnlyUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDateOnly(d: Date): string {
  if (Number.isNaN(d.getTime())) {
    throw new RangeError("Invalid time value");
  }
  return formatDateOnlyUtc(d);
}

/** Normalize a DB date (string or Date) to YYYY-MM-DD. Neon often returns Date objects. */
export function toDateOnlyStr(val: string | Date | null | undefined): string {
  if (val == null) return "";
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return formatDateOnlyUtc(parsed);
    return trimmed.slice(0, 10);
  }
  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) return "";
    return formatDateOnlyUtc(val);
  }
  return String(val).slice(0, 10);
}

/** Nights between check-in and check-out (checkout day exclusive). Matches caretaker APIs. */
export function countNights(checkInDate: string, checkOutDate: string): number {
  const checkIn = parseDateOnly(checkInDate);
  const checkOut = parseDateOnly(checkOutDate);
  if (checkOut <= checkIn) return 0;
  return Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / DAY_MS));
}

export function addDays(dateStr: string, days: number): string {
  const d = parseDateOnly(dateStr);
  d.setDate(d.getDate() + days);
  return formatDateOnly(d);
}
