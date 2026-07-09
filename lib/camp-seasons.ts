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
    const summary = campOpenSeasonSummary(campSlug);
    return {
      ok: false,
      error: summary
        ? `Selected dates include nights when this camp is closed for the season. ${summary}`
        : "Selected dates include nights when this camp is closed for the season.",
    };
  }
  return { ok: true };
}

function monthLong(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleString("en-US", { month: "long" });
}

function lastDayOfMonth(month: number): number {
  return new Date(2000, month, 0).getDate();
}

/** User-facing open/closed season summary for seasonal camps. */
export function campOpenSeasonSummary(campSlug: string): string | null {
  const rule = CAMP_SEASON_RULES[campSlug];
  if (!rule) return null;

  const closedEndMonth = rule.openMonth === 1 ? 12 : rule.openMonth - 1;
  const closedEndDay =
    rule.openDay === 1 ? lastDayOfMonth(closedEndMonth) : rule.openDay - 1;

  const openEndMonth = rule.closedMonth === 1 ? 12 : rule.closedMonth - 1;
  const openEndDay =
    rule.closedDay === 1 ? lastDayOfMonth(openEndMonth) : rule.closedDay - 1;

  return `Open ${monthLong(rule.openMonth)} ${rule.openDay} – ${monthLong(openEndMonth)} ${openEndDay}. Closed ${monthLong(rule.closedMonth)} ${rule.closedDay} – ${monthLong(closedEndMonth)} ${closedEndDay}.`;
}

export function campHasSeasonalClosure(campSlug: string): boolean {
  return campSlug in CAMP_SEASON_RULES;
}

/** @deprecated Use campOpenSeasonSummary */
export function campSeasonDescription(campSlug: string): string | null {
  return campOpenSeasonSummary(campSlug);
}
