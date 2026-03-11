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

/** True if site_type indicates a hookup site (30/50 amp, full hookup, etc.). Used for event upgrade vs included dry. */
export function isHookupSiteType(siteType: string): boolean {
  const t = (siteType || "").toLowerCase();
  return /hook|30\s*amp|50\s*amp|amp\s*\/|electric|water\s*hook/.test(t);
}
