# Events — Shopify Setup Guide

This document explains how to structure event products and collections in Shopify so they display correctly on the Events page.

## Handling Multiple Instances (e.g., Spring vs Fall Dirt Fest)

Create **separate products** for each event instance. Example:

- **Dirt Fest Stanton 2026 - March 16-22** (spring)
- **Dirt Fest Stanton 2026 - October 5-11** (fall)

The date range distinguishes them and appears on the event card. Each product has its own registration, price, and dates.

---

## Dates

Dates are displayed under the event title on each card. The site supports three methods (in order of preference):

### 1. Metafields (recommended)

Create product metafields with **Storefront API access** enabled:

| Namespace | Key        | Type | Example    |
|-----------|------------|------|------------|
| `event`   | `start_date` | date | 2026-03-16 |
| `event`   | `end_date`   | date | 2026-03-22 |

- In Shopify Admin: **Settings → Custom data → Products → Add definition**
- Name: "Event start date" / "Event end date"
- Type: Date (or Date and time)
- Namespace and key: `event.start_date` and `event.end_date`
- **Expose to Storefront API:** Yes

### 2. Tags (no setup required)

Add tags in these formats:

| Tag format   | Purpose   | Example          |
|-------------|-----------|------------------|
| `date:YYYY-MM-DD` | Start date | `date:2026-03-16` |
| `date-end:YYYY-MM-DD` | End date | `date-end:2026-03-22` |

Use ISO format (YYYY-MM-DD). For single-day events, only add the start date.

### 3. Title (fallback)

Include the date range in the product title, e.g. **Dirt Fest Stanton 2026 - March 16-22**. The site will try to parse patterns like "March 16-22" or "Oct 5 – 11" from the title when metafields/tags are not available.

---

## Collection

The Events page **only** shows products from the collection with handle `events`. Create an **Events** collection and add all event products to it. Products in other collections (e.g. `dirtfest`, `detector-events`) are not displayed on the Events page.

---

## Product Structure

### One product per event instance

Create a separate product for each event and date, for example:

- `DirtFest 2026 - Stanton AZ`
- `DirtFest 2026 - Italian Bar CA`
- `Gold N BBQ 2026 - Oconee SC`
- `Minelab Detector Day - Vein Mountain NC`

### Required

- **Title** — Shown on the event card (e.g., "DirtFest 2026 - Stanton AZ")
- **Price** — Base registration price
- **Image** — Featured image for the card
- **Variants** — At least one variant (default is used for Add to Cart)

### Optional but recommended

- **Tags** — Used for filtering on the Events page

---

## Tags for Filtering

Tags control how events appear in the **Event type** and **Camp** filters.

### Event type

| Tag | Filter |
|-----|--------|
| `dirtfest` or `dirt-fest` | Dirt Fest |
| `detector` | Detector Events |
| (no match) | Other |

### Camp / location

Use tags that include the camp slug. The site matches these slugs (case‑insensitive):

| Camp slug | Camp |
|-----------|------|
| `stanton-arizona` | Stanton, AZ |
| `italian-bar-california` | Italian Bar, CA |
| `duisenburg-california` | Duisenburg, CA |
| `blue-bucket-oregon` | Blue Bucket, OR |
| `burnt-river-oregon` | Burnt River, OR |
| `oconee-south-carolina` | Oconee, SC |
| `loud-mine-georgia` | Loud Mine, GA |
| `vein-mountain-north-carolina` | Vein Mountain, NC |

**Examples (all valid):**

- `camp:stanton-arizona`
- `stanton-arizona`
- `stanton arizona`
- `oconee` (matches `oconee-south-carolina`)
- `stanton` (matches `stanton-arizona`)

Tags are matched case-insensitive. A tag can contain the full slug, the slug without hyphens, or be the leading part of a slug (e.g. `oconee` for Oconee).

---

## Example Product Setup

**Product:** Dirt Fest Stanton 2026 - March 16-22

- **Title:** Dirt Fest Stanton 2026 - March 16-22  
- **Handle:** dirtfest-stanton-2026-march  
- **Price:** $XX.XX  
- **Tags:** `dirtfest`, `camp:stanton-arizona`, `date:2026-03-16`, `date-end:2026-03-22`  
- **Metafields (optional):** `event.start_date` = 2026-03-16, `event.end_date` = 2026-03-22  
- **Image:** Event or camp image  

---

## Event Upgrades (e.g., VIP Package)

Create upgrades as **separate products**, for example:

- **Product:** DirtFest VIP Package  
- **Tags:** `dirtfest`, `upgrade`, `vip`

On the product page or in the cart, add copy such as:  
*"Add to your DirtFest registration."*

The Events page shows base event products. Upgrades can be:

- Linked from event product descriptions  
- Shown as a cart upsell  
- Listed in a separate "Add‑ons" section  

---

## Storefront API Access

**Product tags** enable event-type and camp filtering. The Events page requests `tags` and `metafields` in the GraphQL query. **You must enable the Storefront API scope** for tags to work.

**If using the Headless channel:**
1. **Sales channels → Headless** → select your storefront
2. Click **Edit** next to **Storefront API permissions**
3. Enable **Read product tags**
4. Click **Save**

**If using a custom app:**
1. **Settings → Apps and sales channels → Develop apps** → your app
2. **Configure Storefront API scopes** → enable **Read product tags** (`unauthenticated_read_product_tags`)

Without this scope, the `tags` field will be empty. Events will still appear, but filtering by type/camp and tag-based dates will not work. The site will fall back to title-based matching when tags are missing (e.g. "Dirt Fest Stanton 2026" → Dirt Fest + Stanton).
