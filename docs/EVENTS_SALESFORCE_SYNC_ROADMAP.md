# Event registrations: Shopify → Salesforce roadmap

This document is the reference plan for syncing **paid event registrations** from **Shopify** (financial source of truth) into **Salesforce Campaigns** and **Campaign Members**, without relying on the member-relations Excel sheet for counts.

**Goals (initial scope)**

- One **Campaign** per **event product** (one Shopify product per event instance, per existing site conventions).
- **Registered count** and **capacity** visible in Salesforce for reporting.
- Among registered members, classify **LDMA vs non-LDMA** only (skip VIP upgrade attribution until a reliable event key exists on those orders).
- **Full refund** on the order sets a **cancelled** (or equivalent) flag on the related Campaign Members.
- **Idempotent** sync: safe replays and backfills using Shopify order + line item identifiers.

**Non-goals (for now)**

- Reporting which **VIP** purchase belongs to which event when the customer attends multiple events (requires explicit linkage on the order or a later design).
- Matching the spreadsheet’s LDMA / GPAA / NON columns (Shopify + variant rules replace that for this pipeline).

---

## What already exists in this repo (leverage)

| Area | Location | Use |
|------|----------|-----|
| Event catalog (Storefront) | `getEventProducts()` in `lib/shopify.ts` | Reads the **`events`** collection (`EVENT_COLLECTION_HANDLE` in `lib/events-config.ts`), variant **`custom.price_level`** metafield, tags, event date metafields. Use for **campaign seed lists** and consistent product IDs with the public Events page. |
| Event / VIP config | `lib/events-config.ts` | `PRICE_LEVEL_METAFIELD` for member vs non-member when set; `VIP_UPSELL_PRODUCT_HANDLE` to **exclude** standalone VIP products from Campaign Member creation until linkage is designed. |
| Shopify setup docs | `docs/EVENTS_SHOPIFY_SETUP.md` | One product per event instance; VIP as **separate product**; tags and `event.start_date` / `event.end_date` metafields. |
| Salesforce OAuth + Contact API | `lib/salesforce.ts` | Reuse the same OAuth client pattern; add **separate** modules for Campaign / CampaignMember so Contact lookup/update flows stay isolated. |
| Webhook pattern | `app/api/webhooks/stripe/route.ts` | Model for **raw body** + signature verification + idempotent writes. |
| Cron pattern | `vercel.json` → `/api/cron/*` | Optional **reconciliation** or replay jobs later. |

**Implementation (in repo):** See **`docs/EVENT_SHOPIFY_SALESFORCE_SETUP.md`** for env vars, Salesforce fields, OAuth URLs, and webhooks. Code: `lib/shopify-admin-auth.ts`, `lib/salesforce-event-sync.ts`, `app/api/webhooks/shopify/route.ts`, `app/api/shopify/oauth/start`, `app/api/shopify/oauth/callback`.

---

## Phase 0 — Salesforce data model and permissions

**Campaign (one per event product)**

- Stable link to Shopify: custom field such as `Shopify_Product_GID__c` or numeric id + shop domain.
- Optional `Capacity__c`: synced from Shopify total sellable inventory across registration variants, or maintained manually per event.

**Campaign Member**

- `Shopify_Order_Id__c` + `Shopify_Line_Item_Id__c` (or single external id) for **idempotency** and refund matching.
- `Registration_Type__c` picklist: `LDMA` | `NON_LDMA` (from metafield and/or title rules; see Phase 1).
- **Cancelled** reporting: `Cancelled__c` and/or standard **Status** (org preference).

**Contact matching**

- Primary match: **order email** → Contact. Document behavior when no Contact exists (e.g. skip Campaign Member vs staging object — choose one and stay consistent).

**Integration user**

- Must be allowed to create/update **Campaign**, **Campaign Member**, and read/update **Contact** as designed. Confirm **Marketing User** or equivalent if required for Campaign Members in your org.

Deliverable: sandbox objects, reports (capacity, headcount, LDMA vs non, active vs cancelled).

---

## Phase 1 — Classification rules (shared, testable)

Implement something like `lib/event-registration-classify.ts` (name can vary):

1. **Primary:** If the line item variant has Storefront-exposed **`custom.price_level`** (`PRICE_LEVEL_METAFIELD` in `lib/events-config.ts`), map `member` / `non member` → `LDMA` / `NON_LDMA` (same idea as the Events UI).
2. **Fallback:** Ordered **title heuristics** on variant title (case-insensitive), e.g. tokens for Non-LDMA / Non-Member / General Admission vs LDMA Member / Member Entrance, with **non-guessable** unknowns → log + skip or queue.
3. **Override table:** Optional map **variant GID → type** for one-off products (JSON in repo, env, or Salesforce Custom Metadata read by the sync job).

**Exclusions**

- Do not create Campaign Members for standalone VIP / upgrade products: use `VIP_UPSELL_PRODUCT_HANDLE` and/or product tags such as `upgrade` / `vip` per `docs/EVENTS_SHOPIFY_SETUP.md`.

Add **unit tests** using real variant title examples from production.

---

## Phase 2 — Salesforce write path (isolated module)

- Add a dedicated module (for example `lib/salesforce-event-registrations.ts`) that wraps REST calls: upsert Campaign by Shopify product id, upsert Campaign Member by order + line item id, bulk-cancel members for an order on full refund.
- Reuse OAuth from `lib/salesforce.ts` via a small shared helper to avoid duplicating token fetch logic; **do not** fold Campaign logic into Contact `lookupMember` / `updateContact` paths.

Deliverable: callable from a script and from a webhook; verified in sandbox.

---

## Phase 3 — Shopify Admin API and webhooks

- Create/configure a **Shopify Custom App** with at least **`read_orders`** and **`read_products`** (exact scopes depend on whether catalog is always read via Storefront vs Admin for line items).
- Register webhooks, for example:
  - **`orders/paid`** (or `orders/create` with filter on financial status),
  - **`orders/updated`** and/or **`refunds/create`** to detect **fully refunded** orders and set cancelled on members.
- Add **`POST /api/webhooks/shopify`**: verify `X-Shopify-Hmac-Sha256` against **raw body** (same discipline as Stripe), then process line items.

**Lazy campaign creation**

- If no Campaign exists for the product id on first qualifying order, create Campaign from product title + documented date fields. Still run Phase 4 so Campaigns usually exist before the first sale.

---

## Phase 4 — Pre-create Campaigns for future events (script)

- Script (for example `scripts/sync-event-campaigns-from-shopify.mjs` or a TS script): list products in the **`events`** collection (same handle as `EVENT_COLLECTION_HANDLE`), filter to **future** events using `event.start_date` / tags from `docs/EVENTS_SHOPIFY_SETUP.md`.
- Upsert Salesforce Campaign per product with stable external key = Shopify product GID.

Run manually when new event products are published, or from CI if desired.

---

## Phase 5 — Optional historical backfill

- Paginate Admin API orders (cursor / `created_at` filters), filter to event product variant ids, apply the same classifier and Campaign Member upsert keys.
- Idempotent; safe to re-run. Omit if historical Salesforce reporting is not required.

---

## Phase 6 — Hardening (optional)

- **Reconciliation cron** using existing `vercel.json` cron pattern: compare Shopify paid seat counts vs Salesforce per mapped product; alert on drift.
- Structured logging and a small queue or “unknown variant” report for ops.
- Short **runbook**: rotating webhook secrets, SF integration user, how to register a new event product.

---

## Critical path order

`Phase 0 (Salesforce schema + permissions)` → `Phase 1 (classification)` → `Phase 2 (SF writes)` → `Phase 3 (Shopify Admin + webhooks)`.

**Phase 4** (campaign seed script) can start once Phase 2 works; it should run before or in parallel with going live on webhooks.

---

## Design principles for a smooth upgrade

1. Keep **event sync code separate** from `lib/salesforce.ts` Contact flows used by member auth and profile.
2. Align “what is an event product” and “what is VIP-only” with **`lib/events-config.ts`** and **`docs/EVENTS_SHOPIFY_SETUP.md`** so the storefront and Salesforce stay consistent.
3. Mirror proven patterns: **`app/api/webhooks/stripe/route.ts`** for verification and body handling; **`vercel.json`** for optional scheduled reconciliation.

---

## Related files (quick index)

- `lib/shopify.ts` — Storefront `getEventProducts()`, event fragment, `price_level` metafield on variants.
- `lib/events-config.ts` — `EVENT_COLLECTION_HANDLE`, `PRICE_LEVEL_METAFIELD`, `VIP_UPSELL_PRODUCT_HANDLE`.
- `docs/EVENTS_SHOPIFY_SETUP.md` — Product structure, tags, metafields, VIP as separate product.
- `lib/salesforce.ts` — OAuth; extend via new modules, not by overloading Contact helpers.
- `app/api/webhooks/stripe/route.ts` — Webhook handler pattern.
- `vercel.json` — Cron routes.

This roadmap was captured from implementation planning in May 2026; adjust phases if Salesforce or Shopify org policies require different objects or scopes.
