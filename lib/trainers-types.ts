/**
 * Shared contract for the LDMA Trainers directory (/trainers, /trainers/[slug], /admin/trainers).
 * Client-safe: types only, no server imports.
 *
 * Ownership:
 *  - Data layer (lib/trainers.ts, DB, API, admin, editor): backend agent
 *  - Public layout (app/trainers/**, components/trainers/**, .trainer-prose styles): design agent
 */

/** An event a trainer will be at. Picked from the Shopify Events collection and resolved at read time. */
export type TrainerEventLink = {
  /** Shopify product GID, e.g. gid://shopify/Product/9142497706055 (the stored reference). */
  productGid: string;
  /** Resolved live from Shopify; null if the product was removed or unpublished. */
  title: string | null;
  /** Storefront handle, used to link to /events/[handle]. */
  handle: string | null;
  /** Primary image URL if available. */
  imageUrl: string | null;
  /** Human-readable date/location line if it can be derived (may be null). */
  subtitle: string | null;
};

export type TrainerContact = {
  /** Every field is optional; the UI renders a contact item only when its value is non-empty. */
  email: string | null;
  phone: string | null;
  websiteUrl: string | null;
};

export type TrainerProfile = {
  id: string;
  /** URL slug, e.g. "john-mathis" -> /trainers/john-mathis */
  slug: string;
  name: string;
  /** Short title shown under the name, e.g. "Caretaker, LDMA Stanton Camp". */
  title: string | null;
  /** One or two sentence teaser for directory cards (plain text). */
  summary: string | null;
  /** Full bio as sanitized HTML (h1-h3, p, strong, em, u, a, ul/ol/li, blockquote, br). Render inside `.trainer-prose`. */
  bodyHtml: string;
  photoUrl: string | null;
  contact: TrainerContact;
  sortOrder: number;
  /** null = draft (not public). ISO timestamp when published. */
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Public detail payload. Events are resolved against Shopify. */
export type TrainerDetail = TrainerProfile & {
  events: TrainerEventLink[];
};

/**
 * Functions the data layer (lib/trainers.ts) must export for the public pages:
 *
 *   getPublishedTrainers(): Promise<TrainerProfile[]>          // published only, ordered by sortOrder, name
 *   getTrainerBySlug(slug: string): Promise<TrainerDetail | null>  // published only; events resolved from Shopify (cached)
 *
 * Both must return empty / null (never throw) when the database or Shopify is unavailable.
 */
