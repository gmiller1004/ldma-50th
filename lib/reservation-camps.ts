/**
 * Which camps use the site reservation system (sites + reservations).
 * Other camps keep the legacy check-in-only flow.
 */

export const RESERVATION_PILOT_CAMP_SLUG = "burnt-river-oregon";

export function campUsesReservations(campSlug: string): boolean {
  return campSlug === RESERVATION_PILOT_CAMP_SLUG;
}

/** True if site_type indicates a hookup site (30/50 amp, full hookup, etc.). Used for event upgrade vs included dry. */
export function isHookupSiteType(siteType: string): boolean {
  const t = (siteType || "").toLowerCase();
  return /hook|30\s*amp|50\s*amp|amp\s*\/|electric|water\s*hook/.test(t);
}
