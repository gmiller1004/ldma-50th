/**
 * Events page configuration.
 * See EVENTS_SHOPIFY_SETUP.md for how to structure products and collections in Shopify.
 */

/** Collection handle for event products. Only products in this collection are shown on the Events page. */
export const EVENT_COLLECTION_HANDLE =
  process.env.EVENT_COLLECTION_HANDLE?.trim() || "events";

/** Event type filter values — match against product tags/titles (see lib/event-display.ts) */
export const EVENT_TYPES = [
  { id: "all", label: "All Events" },
  { id: "gold_diggings", label: "Gold Diggin's" },
  { id: "dirt_party", label: "Dirt Party" },
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

/** Handle for the event VIP Gold Package add-on. Shown when user adds a Gold Diggin's / Dirt Party event to cart. */
export const VIP_UPSELL_PRODUCT_HANDLE = "2026-event-vip-gold-package";

/**
 * Event products that include a free dry site and optional hookup upgrade.
 * Used for caretaker "event participant" reservations so we document and restrict to these events.
 * Add new events here when they offer included/upgrade sites (e.g. Dirt Fest at each camp).
 */
export const EVENT_RESERVATION_PRODUCTS: { handle: string; label: string }[] = [
  { handle: "dirtfest-stanton-2026-march", label: "Dirt Fest Stanton 2026 (Mar)" },
  { handle: "dirtfest-burnt-river-2026", label: "Dirt Fest Burnt River 2026" },
  // Add more as needed (e.g. fall Dirt Fest, other camps)
];
