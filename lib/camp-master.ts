/**
 * Camp names in the site master spreadsheet → directory camp slugs.
 */

export const MASTER_CAMP_TO_SLUG: Record<string, string> = {
  Stanton: "stanton-arizona",
  "Italian Bar": "italian-bar-california",
  Duisenburg: "duisenburg-california",
  "Blue Bucket": "blue-bucket-oregon",
  "Burnt River": "burnt-river-oregon",
  Oconee: "oconee-south-carolina",
  "Loud Mine": "loud-mine-georgia",
  "Vein Mountain": "vein-mountain-north-carolina",
};

export function masterCampNameToSlug(campName: string): string | null {
  const trimmed = campName.trim();
  return MASTER_CAMP_TO_SLUG[trimmed] ?? null;
}

export type MasterSiteRow = {
  campSlug: string;
  campName: string;
  siteCode: string;
  specialType: string | null;
  siteType: string;
  memberRateMonthly: number | null;
  memberRateDaily: number | null;
  nonMemberRateDaily: number | null;
  sortOrder: number;
};

/** Display name for caretaker UI and legacy name-based matching. */
export function formatSiteDisplayName(siteCode: string, siteType: string, specialType: string | null): string {
  const parts = [siteCode];
  if (specialType) parts.push(specialType);
  if (siteType) parts.push(siteType.trim());
  return parts.join(" — ");
}
