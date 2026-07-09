/**
 * Recurring open/closed seasons for public campsite booking.
 * A stay is valid only when every occupied night falls in the open window.
 */

import { addDays, countNights } from "@/lib/reservation-dates";

/** Closed from closedMonth/closedDay (inclusive) until day before openMonth/openDay. */
export type CampSeasonRule = {
  closedMonth: number;
  closedDay: number;
  openMonth: number;
  openDay: number;
};

export const CAMP_SEASON_RULES: Record<string, CampSeasonRule> = {
  "stanton-arizona": { closedMonth: 6, closedDay: 1, openMonth: 10, openDay: 1 },
  "burnt-river-oregon": { closedMonth: 11, closedDay: 1, openMonth: 4, openDay: 1 },
  "blue-bucket-oregon": { closedMonth: 11, closedDay: 1, openMonth: 4, openDay: 1 },
};

function parseParts(iso: string): { month: number; day: number } {
  const [, m, d] = iso.slice(0, 10).split("-").map(Number);
  return { month: m, day: d };
}

function compareMonthDay(a: { month: number; day: number }, b: { month: number; day: number }): number {
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

/** True when calendar date falls in the annual closed window (inclusive of closed start). */
export function isDateInCampClosedSeason(campSlug: string, dateIso: string): boolean {
  const rule = CAMP_SEASON_RULES[campSlug];
  if (!rule) return false;

  const date = parseParts(dateIso);
  const closedStart = { month: rule.closedMonth, day: rule.closedDay };
  const openStart = { month: rule.openMonth, day: rule.openDay };

  if (compareMonthDay(closedStart, openStart) < 0) {
    // Same-calendar-year closure (e.g. Jun 1 – Sep 30 before Oct 1 open)
    return compareMonthDay(date, closedStart) >= 0 && compareMonthDay(date, openStart) < 0;
  }

  // Wraps year boundary (e.g. Nov 1 – Mar 31 before Apr 1 open)
  return compareMonthDay(date, closedStart) >= 0 || compareMonthDay(date, openStart) < 0;
}

export function eachOccupiedNight(checkIn: string, checkOut: string): string[] {
  const total = countNights(checkIn, checkOut);
  const nights: string[] = [];
  let d = checkIn;
  for (let i = 0; i < total; i++) {
    nights.push(d);
    d = addDays(d, 1);
  }
  return nights;
}

export function validateStayWithinOpenSeason(
  campSlug: string,
  checkIn: string,
  checkOut: string
): { ok: true } | { ok: false; error: string } {
  const closedNight = eachOccupiedNight(checkIn, checkOut).find((d) =>
    isDateInCampClosedSeason(campSlug, d)
  );
  if (closedNight) {
    return {
      ok: false,
      error: "Selected dates include nights when this camp is closed for the season.",
    };
  }
  return { ok: true };
}

export function campSeasonDescription(campSlug: string): string | null {
  const rule = CAMP_SEASON_RULES[campSlug];
  if (!rule) return null;
  const monthName = (m: number) =>
    new Date(2000, m - 1, 1).toLocaleString("en-US", { month: "long" });
  return `Open ${monthName(rule.openMonth)} ${rule.openDay} – ${monthName(
    rule.closedMonth === 1 ? 12 : rule.closedMonth - 1
  )} (closed ${monthName(rule.closedMonth)} ${rule.closedDay} – ${monthName(rule.openMonth)} ${rule.openDay - 1 || "end of month"})`;
}
