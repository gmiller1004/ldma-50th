/**
 * Collection handles that require member login. Unauthenticated users see a
 * prompt to log in instead of products.
 */
export const MEMBERS_ONLY_COLLECTION_HANDLES = [
  "exclusive-mining-gear",
  "members-only-savings",
] as const;

export function isMembersOnlyCollection(handle: string): boolean {
  return (MEMBERS_ONLY_COLLECTION_HANDLES as readonly string[]).includes(handle);
}

/**
 * Collection handles that represent campgrounds. Requests to /collections/[handle]
 * for these handles redirect to /campgrounds/[handle].
 */
export const CAMPGROUND_COLLECTION_HANDLES = [
  "blue-bucket-oregon",
  "burnt-river-oregon",
  "duisenburg-california",
  "italian-bar-california",
  "loud-mine-georgia",
  "oconee-south-carolina",
  "stanton-arizona",
  "vein-mountain-north-carolina",
] as const;

export function isCampgroundCollection(handle: string): boolean {
  return (CAMPGROUND_COLLECTION_HANDLES as readonly string[]).includes(handle);
}
