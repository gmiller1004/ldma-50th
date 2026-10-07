/**
 * Which billing schedule a reservation uses (see BillingMode in reservation-pricing).
 */

import type { BillingMode } from "@/lib/reservation-pricing";

const CALENDAR_MONTH_CAMPS = new Set(["stanton-arizona"]);

/** Schedule for new reservations at this camp. */
export function campDefaultBillingMode(campSlug?: string | null): BillingMode {
  return campSlug && CALENDAR_MONTH_CAMPS.has(campSlug) ? "calendar_month" : "rolling_30";
}

/** Stored schedule for an existing reservation; legacy rows (NULL) stay on rolling 30-day periods. */
export function reservationBillingMode(stored: unknown): BillingMode {
  return stored === "calendar_month" ? "calendar_month" : "rolling_30";
}
