/**
 * Which camps use the site reservation system (sites + reservations).
 * Other camps keep the legacy check-in-only flow.
 */

export const RESERVATION_PILOT_CAMP_SLUG = "burnt-river-oregon";

/** Camp slugs that have site reservations enabled (caretaker portal: create/list reservations, site availability). */
const CAMPS_WITH_RESERVATIONS = new Set([
  "burnt-river-oregon",
  "vein-mountain-north-carolina",
]);

export function campUsesReservations(campSlug: string): boolean {
  return CAMPS_WITH_RESERVATIONS.has(campSlug);
}

/**
 * Camp-specific site names that should never be bookable.
 * Used for caretaker-only spaces (e.g. Vein Mountain "Upper 1").
 */
const NON_BOOKABLE_SITE_NAMES_BY_CAMP: Record<string, Set<string>> = {
  "vein-mountain-north-carolina": new Set(["Upper 1"]),
};

export function isNonBookableSiteName(campSlug: string, siteName: string): boolean {
  const blocked = NON_BOOKABLE_SITE_NAMES_BY_CAMP[campSlug];
  if (!blocked) return false;
  return blocked.has((siteName || "").trim());
}

/** True if site_type indicates a hookup site (30/50 amp, full hookup, etc.). Used for event upgrade vs included dry. */
export function isHookupSiteType(siteType: string): boolean {
  const t = (siteType || "").toLowerCase();
  return /hook|30\s*amp|50\s*amp|amp\s*\/|electric|water\s*hook/.test(t);
}
