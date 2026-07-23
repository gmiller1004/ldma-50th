/**
 * Which camps use the site reservation system (sites + reservations).
 * Legacy check-in create flows are retired for these camps (Phase 4+).
 */

import { MASTER_CAMP_TO_SLUG } from "@/lib/camp-master";
import { addDays } from "@/lib/reservation-dates";

export const RESERVATION_PILOT_CAMP_SLUG = "burnt-river-oregon";

/** Max days in the past a caretaker may set check-in on create (backdated arrival). */
export const CARETAKER_BACKDATE_MAX_DAYS = 7;

/** All camps in the site master use reservations after Phase 4. */
const CAMPS_WITH_RESERVATIONS = new Set(Object.values(MASTER_CAMP_TO_SLUG));

export function campUsesReservations(campSlug: string): boolean {
  return CAMPS_WITH_RESERVATIONS.has(campSlug);
}

/**
 * Cash allowed when creating a reservation (or paying at create time).
 * Limited to future / same-day / backdated check-in within the caretaker backdate window
 * so old arrivals cannot be invented as cash-paid.
 */
export function caretakerAllowsCashCheckIn(checkInDate: string, today?: string): boolean {
  const t = today ?? new Date().toISOString().slice(0, 10);
  const earliest = addDays(t, -CARETAKER_BACKDATE_MAX_DAYS);
  return checkInDate >= earliest;
}

/**
 * Cash for site-fee collection on an existing reservation (balance due, date-edit add-on, site move).
 * Always allowed — long-term guests commonly pay later months in cash while already on site.
 */
export function caretakerAllowsCashExistingReservationPayment(): boolean {
  return true;
}

/** Earliest allowed check-in date for caretaker-created reservations. */
export function caretakerEarliestCheckInDate(today?: string): string {
  const t = today ?? new Date().toISOString().slice(0, 10);
  return addDays(t, -CARETAKER_BACKDATE_MAX_DAYS);
}

/**
 * When editing an existing reservation, keep its current check-in selectable even if it is
 * older than the create/backdate window (needed for mid-stay early check-out edits).
 */
export function caretakerEarliestCheckInDateForEdit(
  existingCheckInDate: string,
  today?: string
): string {
  const earliest = caretakerEarliestCheckInDate(today);
  const existing = existingCheckInDate.slice(0, 10);
  return existing < earliest ? existing : earliest;
}

/**
 * Camp-specific site names that should never be bookable.
 * Used for caretaker-only spaces (e.g. Vein Mountain "Upper 1" / UC-01).
 */
const NON_BOOKABLE_SITE_NAMES_BY_CAMP: Record<string, Set<string>> = {
  "vein-mountain-north-carolina": new Set(["Upper 1"]),
};

const NON_BOOKABLE_SITE_CODES_BY_CAMP: Record<string, Set<string>> = {
  "vein-mountain-north-carolina": new Set(["UC-01"]),
};

export function isNonBookableSiteName(campSlug: string, siteName: string): boolean {
  const blocked = NON_BOOKABLE_SITE_NAMES_BY_CAMP[campSlug];
  if (!blocked) return false;
  return blocked.has((siteName || "").trim());
}

/** Prefer site_code when available (master site list). */
export function isNonBookableSite(
  campSlug: string,
  siteName: string,
  siteCode?: string | null
): boolean {
  const codes = NON_BOOKABLE_SITE_CODES_BY_CAMP[campSlug];
  if (siteCode && codes?.has(siteCode.trim())) return true;
  return isNonBookableSiteName(campSlug, siteName);
}

/** True if site_type indicates a hookup site (30/50 amp, full hookup, etc.). Used for event upgrade vs included dry. */
export function isHookupSiteType(siteType: string): boolean {
  const t = (siteType || "").toLowerCase();
  return /hook|30\s*amp|50\s*amp|amp\s*\/|electric|water\s*hook/.test(t);
}

export type CapacitySiteFilter = "all" | "hookup" | "dry";

export function parseCapacitySiteFilter(value: string | null | undefined): CapacitySiteFilter {
  const v = (value || "").trim().toLowerCase();
  if (v === "hookup" || v === "dry") return v;
  return "all";
}

export function siteMatchesCapacityFilter(siteType: string, filter: CapacitySiteFilter): boolean {
  if (filter === "all") return true;
  const hookup = isHookupSiteType(siteType);
  return filter === "hookup" ? hookup : !hookup;
}
