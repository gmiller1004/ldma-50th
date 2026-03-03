# Exclusive Offers Email Notifications

Members can opt in on the **Exclusive Offers for LDMA Members** collection page to receive an email when new products are added to that collection. The cron runs **daily at 5:00 UTC** (~9pm Pacific). Emails are sent **only when there are new products** that haven’t been announced yet.

## Setup

### 1. Environment variables

Uses the same variables as the comment digest:

| Variable | Description |
|----------|-------------|
| `CRON_SECRET` | Used to authenticate cron requests. |
| `NEXT_PUBLIC_SITE_URL` | Base URL for links in emails. |
| `SENDGRID_API_KEY` | Required for sending emails. |
| `SENDGRID_FROM_EMAIL` | Sender address. |
| `SENDGRID_FROM_NAME` | Sender name (e.g. "LDMA"). |

### 2. Vercel Cron

The exclusive-offers cron is in `vercel.json`:

```json
{
  "path": "/api/cron/exclusive-offers-notify",
  "schedule": "0 5 * * *"
}
```

- Schedule: `0 5 * * *` = 5:00 UTC daily (~9pm Pacific).
- Same `CRON_SECRET` as the comment-digest cron.

### 3. Manual test

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-site.vercel.app/api/cron/exclusive-offers-notify
```

Returns one of:

- `{ ok: true, sent: N, newProducts: M, totalOptedIn: T }` when new products were found and emails sent.
- `{ ok: true, sent: 0, newProducts: 0, reason: "no_new_products" }` when the collection has no new products since last run.
- `{ ok: true, sent: 0, newProducts: 0, reason: "no_collection_or_products" }` when the collection is missing or empty.

### 4. Database

- **`member_notification_preferences.exclusive_offers_notify`** – opt-in flag (added by `migrate-exclusive-offers-notify.sql`).
- **`exclusive_offers_notified_products`** – stores Shopify product IDs we’ve already emailed about (created by `migrate-exclusive-offers-notified-products.sql`).

Both are applied when you run `npm run db:migrate`.

## Flow

1. Member checks “Email me when new offers become available” on the exclusive offers collection page.
2. Daily at 5:00 UTC, the cron runs.
3. Fetches the **Exclusive Offers for LDMA Members** collection from Shopify and compares product IDs to `exclusive_offers_notified_products`.
4. If there are new products: sends one email per opted-in member listing the new offers and links; then records those product IDs as notified.
5. If there are no new products: no emails are sent.
