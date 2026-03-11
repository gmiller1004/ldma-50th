/**
 * Which camps use the site reservation system (sites + reservations).
 * Other camps keep the legacy check-in-only flow.
 */

export const RESERVATION_PILOT_CAMP_SLUG = "burnt-river-oregon";

export function campUsesReservations(campSlug: string): boolean {
  return campSlug === RESERVATION_PILOT_CAMP_SLUG;
}
