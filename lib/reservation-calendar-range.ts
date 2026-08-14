/**
 * Calendar range helpers for caretaker calendar view.
 * Native date inputs (Safari/Firefox) emit empty or partial values while typing;
 * those must never reach date-fns format(), which throws RangeError: Invalid time value.
 */

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True only for a real calendar day like 2026-08-14 (rejects "", "2026-08", 2026-02-31). */
export function isCompleteDateOnly(value: string): boolean {
  const match = DATE_ONLY_RE.exec(typeof value === "string" ? value.trim() : "");
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function todayDateOnlyLocal(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Always returns local midnight for a valid day so calendar column formatting cannot throw. */
export function resolveCalendarRangeStart(startDate: string, now = new Date()): Date {
  if (isCompleteDateOnly(startDate)) {
    const [year, month, day] = startDate.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
