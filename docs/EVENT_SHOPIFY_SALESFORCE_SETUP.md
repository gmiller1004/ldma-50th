# Shopify event sync → Salesforce (implementation checklist)

This app syncs **paid event registrations** from Shopify into **Salesforce Campaigns** using:

- **Admin API** (orders, products, variants, collection `events`)
- **`POST /api/webhooks/shopify`** (HMAC-verified)
- **Optional OAuth:** `GET /api/shopify/oauth/start` → `GET /api/shopify/oauth/callback` (stores offline token in Postgres)

See **`EVENTS_SALESFORCE_SYNC_ROADMAP.md`** for product intent and phases.

---

## 1. Salesforce custom fields

Create these on the **Campaign** object:

| API name | Type | Notes |
|----------|------|--------|
| `Shopify_Product_Id__c` | Text, **External ID**, unique (case-insensitive) | Numeric Shopify product id as string (matches REST `product_id`). |

Optional:

| API name | Type | Notes |
|----------|------|--------|
| `Capacity__c` | Number | Future: sync from Shopify inventory. |

Create these on **Campaign Member**:

| API name | Type | Notes |
|----------|------|--------|
| `Shopify_Order_Line_Key__c` | Text, **External ID**, unique | Format `"{orderId}_{lineItemId}"` (no spaces). |
| `Shopify_Order_Id__c` | Text | Used to cancel all members when order is fully refunded. |
| `Shopify_Line_Item_Id__c` | Text | Shopify line item id. |
| `Registration_Type__c` | Picklist | Values: `LDMA`, `NON_LDMA` (exact spelling). |
| `Cancelled__c` | Checkbox | `true` when order fully refunded. |
| `Seat_Count__c` | Number | Defaults from line item `quantity`. |

If your org uses different API names, set env vars (see below).

**Integration user** must be able to **create** and update **Contact**, **Campaign**, and **Campaign Member** (Contact auto-create is on by default for registrants).

**Contacts**

- If no Contact matches the order email, the sync **creates** a Contact using Shopify `customer` / `billing_address` names when possible (`FirstName` / `LastName`; **LastName** defaults to `Customer` if missing).
- Disable with `SF_EVENT_SYNC_CREATE_CONTACTS=false`.
- Optional: set `SF_EVENT_SYNC_CONTACT_DESCRIPTION` to populate Contact **Description** (otherwise the field is left blank).

---

## 2. Environment variables (Vercel / `.env.local`)

### Shopify store (existing)

| Variable | Example |
|----------|---------|
| `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN` | `myldmastore.myshopify.com` |

### Admin app (Dev Dashboard)

| Variable | Purpose |
|----------|---------|
| `SHOPIFY_ADMIN_API_CLIENT_ID` | OAuth client id |
| `SHOPIFY_ADMIN_API_CLIENT_SECRET` | OAuth secret; **also used to verify Admin webhooks** (HMAC) unless overridden below |
| `SHOPIFY_ADMIN_WEBHOOK_SECRET` | Optional; use if you want the webhook HMAC key separate from the client secret |
| `SHOPIFY_ADMIN_ACCESS_TOKEN` | Optional: offline Admin token (skips DB + client-credentials if set) |
| `SHOPIFY_ADMIN_API_VERSION` | Optional; default `2026-04` |
| `SHOPIFY_ADMIN_OAUTH_SCOPES` | Optional; default `read_products,read_all_orders` |
| `SHOPIFY_OAUTH_REDIRECT_URI` | Must match Dev Dashboard allowlist exactly, e.g. `https://myldma.com/api/shopify/oauth/callback` |
| `NEXT_PUBLIC_SITE_URL` | Production origin, e.g. `https://myldma.com` (used if redirect URI not explicit) |
| `SHOPIFY_WEBHOOK_SECRET` | **Only** used if neither `SHOPIFY_ADMIN_WEBHOOK_SECRET` nor `SHOPIFY_ADMIN_API_CLIENT_SECRET` is set. For this app, HMAC must match the **Shopify custom app’s client secret**, so an unrelated `SHOPIFY_WEBHOOK_SECRET` will cause **401 Invalid HMAC** unless you duplicate the app secret there or rely on `SHOPIFY_ADMIN_API_CLIENT_SECRET`. |

### Salesforce event sync (optional)

| Variable | Purpose |
|----------|---------|
| `SF_EVENT_SYNC_CREATE_CONTACTS` | Default on; set `false` or `0` to skip creating Contacts |
| `SF_EVENT_SYNC_CONTACT_DESCRIPTION` | If set, saved on new Contacts (max 255 chars) |

### Salesforce (existing member integration)

Same Connected App vars as `lib/salesforce.ts` (`SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET`, etc.).

Optional overrides:

| Variable | Default |
|----------|---------|
| `SALESFORCE_API_VERSION` | `v59.0` |
| `SF_CAMPAIGN_SHOPIFY_PRODUCT_FIELD` | `Shopify_Product_Id__c` |
| `SF_CM_ORDER_LINE_KEY_FIELD` | `Shopify_Order_Line_Key__c` |
| `SF_CM_ORDER_ID_FIELD` | `Shopify_Order_Id__c` |
| `SF_CM_LINE_ITEM_ID_FIELD` | `Shopify_Line_Item_Id__c` |
| `SF_CM_REGISTRATION_TYPE_FIELD` | `Registration_Type__c` |
| `SF_CM_CANCELLED_FIELD` | `Cancelled__c` |
| `SF_CM_SEAT_COUNT_FIELD` | `Seat_Count__c` |

---

## 3. Database migration

OAuth token storage uses Postgres:

```bash
npm run db:migrate
```

Uses `.env.local` (or your shell env) for `STORAGE_DATABASE_URL` / `POSTGRES_URL` / `DATABASE_URL`. Run from your machine or any environment that can reach Neon.

Includes `scripts/migrate-shopify-admin-session.sql` (`shopify_admin_session` table).

If you only use **`SHOPIFY_ADMIN_ACCESS_TOKEN`** or **client credentials** (same Shopify org) and never OAuth, the table can remain empty.

---

## 4. Historical backfill (production-safe, idempotent)

After deploy, you can replay paid orders without touching Shopify.

**Single order (smallest test)** — numeric Shopify order id from Admin URL or order export:

`GET /api/cron/shopify-event-backfill?order_id=5678901234`

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "https://myldma.com/api/cron/shopify-event-backfill?order_id=5678901234"
```

**Date range** — paginates `orders.json` since `created_at_min`:

`GET /api/cron/shopify-event-backfill?created_at_min=2026-01-01T00:00:00Z&max_orders=500`

- Requires **`Authorization: Bearer <CRON_SECRET>`** when `CRON_SECRET` is set (same pattern as other crons).
- Adjust `created_at_min` to your seed window; raise `max_orders` cautiously (each order runs full sync logic).
- Response includes counts and sample rows with messages (e.g. classification skips on mixed carts).

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "https://myldma.com/api/cron/shopify-event-backfill?created_at_min=2026-05-01T00:00:00Z&max_orders=200"
```

---

## 5. Install & OAuth

1. Release app version in Dev Dashboard with scopes **`read_products`**, **`read_all_orders`** (or equivalent).
2. Add allowed redirect URL(s), e.g. `https://myldma.com/api/shopify/oauth/callback`.
3. Visit (logged in as store staff):

   `https://myldma.com/api/shopify/oauth/start?shop=myldmastore`

   (Shop must match `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN`.)

4. Approve; callback stores token and redirects back to Shopify admin.

---

## 6. Webhooks

In **Shopify admin → Settings → Notifications → Webhooks** (or Partner app webhook UI), point to:

`https://myldma.com/api/webhooks/shopify`

Recommended topics:

- `orders/paid` (and/or `orders/updated`)
- `refunds/create`

Format: **JSON**. The handler verifies **`X-Shopify-Hmac-Sha256`** using, in order: **`SHOPIFY_ADMIN_WEBHOOK_SECRET`**, then **`SHOPIFY_ADMIN_API_CLIENT_SECRET`**, then **`SHOPIFY_WEBHOOK_SECRET`**.

---

## 7. Behaviour summary

- Only line items whose **product** is in the Shopify collection **`events`** (same handle as `EVENT_COLLECTION_HANDLE` in code) are synced.
- **VIP upsell** product handle `VIP_UPSELL_PRODUCT_HANDLE` (`lib/events-config.ts`) is skipped.
- **LDMA vs NON_LDMA** from `custom.price_level` variant metafield when present, else variant title heuristics (`lib/event-registration-classify.ts`).
- **Fully refunded** orders set **`Cancelled__c`** on all Campaign Members sharing that **`Shopify_Order_Id__c`**.
- **Idempotent** upsert on **`Shopify_Order_Line_Key__c`**.

---

## 8. Notes

- Sandbox is optional: logic is **upsert** + Contact create; worst case you get duplicate-prevented errors your duplicate rules already enforce. Many teams validate on production with a **narrow `created_at_min` backfill** and one test order first.
- Confirm the integration user’s **Contact create** permission and any **duplicate rules** (auto-created Contacts use the order email).

---
