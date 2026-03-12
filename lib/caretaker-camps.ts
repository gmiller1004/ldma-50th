/**
 * Map Salesforce Caretaker_At_Camp__c picklist values to our directory camp slugs.
 * Picklist values may be camp names (e.g. "Stanton", "Italian Bar"); we map to slug for API/DB.
 */

import { directoryCamps, getValidCampSlugs } from "./directory-camps";

const nameToSlug = new Map(
  directoryCamps.map((c) => [c.name.toLowerCase().trim(), c.slug])
);

/** Map Salesforce Caretaker_At_Camp__c value to our camp slug, or null if unknown. */
export function caretakerCampToSlug(picklistValue: string | null | undefined): string | null {
  if (!picklistValue || typeof picklistValue !== "string") return null;
  const normalized = picklistValue.trim();
  if (!normalized) return null;
  const lower = normalized.toLowerCase();
  let slug = nameToSlug.get(lower);
  if (slug) return slug;
  // Try name before comma (e.g. "Vein Mountain, NC" -> "Vein Mountain")
  const beforeComma = normalized.split(",")[0].trim().toLowerCase();
  if (beforeComma) {
    slug = nameToSlug.get(beforeComma);
    if (slug) return slug;
  }
  if (getValidCampSlugs().includes(normalized)) return normalized;
  return null;
}

export { getValidCampSlugs };
