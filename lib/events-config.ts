/**
 * Events page configuration.
 * See EVENTS_SHOPIFY_SETUP.md for how to structure products and collections in Shopify.
 */

/** Collection handle for event products. Only products in this collection are shown on the Events page. */
export const EVENT_COLLECTION_HANDLE = "events";

/** Event type filter values — match against product tags (case-insensitive) */
export const EVENT_TYPES = [
  { id: "all", label: "All Events" },
  { id: "dirtfest", label: "Dirt Fest" },
  { id: "detector", label: "Detector Events" },
  { id: "other", label: "Other" },
] as const;

/** Camp slugs for filtering — match against product tags (e.g. camp:stanton-arizona or stanton) */
export const CAMP_FILTERS = [
  { id: "all", label: "All Camps" },
  { id: "stanton-arizona", label: "Stanton, AZ" },
  { id: "italian-bar-california", label: "Italian Bar, CA" },
  { id: "duisenburg-california", label: "Duisenburg, CA" },
  { id: "blue-bucket-oregon", label: "Blue Bucket, OR" },
  { id: "burnt-river-oregon", label: "Burnt River, OR" },
  { id: "oconee-south-carolina", label: "Oconee, SC" },
  { id: "loud-mine-georgia", label: "Loud Mine, GA" },
  { id: "vein-mountain-north-carolina", label: "Vein Mountain, NC" },
] as const;

export type EventTypeId = (typeof EVENT_TYPES)[number]["id"];
export type CampFilterId = (typeof CAMP_FILTERS)[number]["id"];

/**
 * Variant metafield used to distinguish member vs non-member pricing.
 * Set this metafield on each variant to "member" or "non member" (case-insensitive).
 * When not logged in: only variants with "non member" are shown (plus variants with no metafield).
 * When logged in as a member: only variants with "member" are shown (fallback to all if none match).
 * The metafield must be exposed to the Storefront API (MetafieldStorefrontVisibility).
 */
export const PRICE_LEVEL_METAFIELD = {
  namespace: "custom",
  key: "price_level",
} as const;

/** Handle for the Dirt Fest VIP Gold Package add-on. Shown as upsell when user adds a Dirt Fest event to cart. */
export const VIP_UPSELL_PRODUCT_HANDLE = "2026-event-vip-gold-package";
