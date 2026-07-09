# Public Camp Booking — Team Ops Guide

One-page reference for how **self-service campsite reservations** work on myldma.com: customer flow, payments, emails, Klaviyo, and MRS follow-up.

**Related docs:** `docs/CAMP_RESERVATIONS_ROADMAP.md`, `docs/KLAVIYO_CAMP_STAY_REMARKETING.md`, `docs/CARETAKER_GUEST_CHECKIN_AND_PAYMENTS.md`

---

## What this covers

All **8 LDMA reservation camps** now offer **Reserve Your Campsite** on each camp page. Bookings are tagged `public_web` in the database (distinct from caretaker-entered reservations).

---

## Customer flow (4 steps)

| Step | What the customer does |
|------|------------------------|
| **1. Dates** | Pick check-in and check-out. Seasonal open/closed dates are enforced. |
| **2. Site type** | Choose a site type bucket (e.g. Full Hookup — RV). Shows availability, sold-out state, and **total stay** price. |
| **3. Details** | Guest: name, email, phone. Member: log in for member pricing; contact fields pre-filled. |
| **4. Payment** | Choose **pay in full** or **$100 deposit** (deposit only if total > $100). Redirect to **Stripe** to pay. |

After payment, the customer returns to the camp page (`?reservation=success` or `?reservation=cancelled`).

### Member vs guest rules

| | Guest | Member (logged in, active membership) |
|---|--------|--------------------------------------|
| **Max stay** | 10 consecutive nights | No cap |
| **Rates** | Daily guest rate × nights | Daily member rate (≤29 nights) or monthly rate prorated (30+ nights) |
| **Contact info** | Required at checkout | Uses member email/name on file |

---

## What happens when payment succeeds

Stripe notifies the site automatically. **No reservation exists until payment clears.**

1. **Site assigned** — System picks the next available site in the chosen type (by sort order). The customer chose a **type**, not a specific site number; the assigned site appears in the confirmation email.
2. **Reservation created** — Status `reserved`, source `public_web`.
3. **Payment recorded** — Applied to rolling **30-day billing periods** from check-in.
4. **Receipt email** — Sent immediately (see Emails below).
5. **Klaviyo profile updated** — Stay dates, camp, member/guest type, “Next Camp Booked,” etc.

---

## Payment options & when balances are due

| Option | Amount charged now | What’s still owed |
|--------|-------------------|-------------------|
| **Pay in full (short stay)** | Entire stay | Nothing — paid in full |
| **Pay in full (long member stay, 30+ nights)** | **First month only** | Month 2+ on each billing period’s due date |
| **$100 deposit** | $100 | Remainder of **first month** before arrival (long stays) or **full balance** before arrival (short stays) |

**Pricing summary**

- **Guest:** daily rate × nights (every stay). Full balance due before arrival if not paid in full.
- **Member, short stay (≤29 nights):** member daily rate × nights. Full balance due before arrival if not paid in full.
- **Member, long stay (30+ nights):** member monthly rate × (nights ÷ 30), split into rolling **30-day billing periods**. Only the **arrival month** balance is due before check-in; later months are due at the start of each billing period.

**Example — 90-night member stay, first month paid at booking**

- Month 1: paid at checkout.
- Month 2: due ~30 days after check-in (reminders at 14 / 7 / 3 days before that date).
- Month 3: due at the start of month 3, and so on.

---

## Emails (SendGrid)

All customer emails are **built in code** (`lib/sendgrid.ts`) and sent via the SendGrid API when `SENDGRID_API_KEY` is set. No separate Klaviyo templates are required for these transactional messages.

| Email | When | To | MRS visibility |
|-------|------|-----|----------------|
| **Payment receipt** | Immediately after Stripe payment | Customer | **BCC** MRS + **CC** `gricci@goldprospectors.org` |
| **Reservation confirmation** | Immediately after payment (webhook); cron backfills any missed after 15 min | Customer | **BCC** MRS |
| **Balance reminder (before arrival)** | 14 / 7 / 3 days before check-in | Customer | Only if arrival-month (or full short-stay) balance remains |
| **Balance reminder (monthly)** | 14 / 7 / 3 days before each **billing period** due date (month 2+) | Customer | Long member stays only |
| **MRS daily digest** | Every morning (~7:30 AM UTC) | MRS inbox | New `public_web` bookings (last 24h) + collectible balances within 7 days |

**Confirmation email includes:** camp, dates, site type, **assigned site number**, arrival-month balance (if any), next scheduled payment (long stays), and a pay link when payment is collectible now.

**Pay balance page** charges only the **amount due now** (arrival-month remainder or current billing period), not the entire remaining stay.

---

## Pay balance

Secure link: `https://myldma.com/reservations/pay?token=...`

- Appears in confirmation and reminder emails when a payment can be collected.
- No login required — token valid ~120 days.
- Stripe checkout for the **current amount due**; receipt sent on payment.

---

## Klaviyo (marketing / CRM)

On every new reservation (public web or caretaker), if Klaviyo is configured:

- Profile is **created or updated** by email.
- Customer is **subscribed to marketing** if not already (source: `camp_reservation`).
- Key properties: Most Recent Camp, check-in/out dates, nights, member vs guest, **Next Camp Booked**, and historical **Camps Stayed**.

Details: `docs/KLAVIYO_CAMP_STAY_REMARKETING.md`.

---

## Automated schedules (background jobs)

| Job | Frequency | Purpose |
|-----|-----------|---------|
| Confirmation emails | Every 15 minutes | Delayed confirmations for new public web bookings |
| Balance reminders | Daily | Before check-in (arrival-month balance) + before each later billing period |
| MRS digest | Daily | Summary email to MRS |
| Stay thank-you | Daily | Post-checkout thank-you + Klaviyo “completed” |

---

## MRS team — what to watch for

1. **BCC on receipts and confirmations** — Copies of customer payment receipts and reservation confirmations for all public web bookings.
2. **Daily digest** — New online bookings and balances collectible within 7 days (not entire multi-month balances).
3. **Assigned site number** — Customer picks a site **type** online; specific site assigned at payment.
4. **Long stays** — First month may be paid at booking; later months bill on schedule. Customers are not asked to pay the full stay before arrival.
5. **Caretaker vs public web** — Caretaker portal uses the same billing periods but different email templates.

---

## Quick reference

```
Camp page → Reserve modal → Stripe payment
                ↓
         Webhook: assign site, create reservation, receipt + Klaviyo
                ↓
         ~15 min: confirmation (site #, arrival-month balance or next due date)
                ↓
         Reminders: before check-in + before each monthly period
                ↓
         Check-in at camp (caretaker portal)
```

---

## Key settings (for IT / deploys)

| Item | Value / note |
|------|----------------|
| MRS email | `RESERVATION_MRS_NOTIFY_EMAIL` (default `info@lostdutchmans.com`) |
| Stripe | Checkout + webhook required in production |
| SendGrid | `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `SENDGRID_FROM_NAME` |
| Klaviyo | `KLAVIYO_PRIVATE_API_KEY`, `KLAVIYO_LIST_ID` (optional) |
| DB migrations | `camp-public-booking`, `camp-balance-reminders`, `camp-billing-period-reminders` |

---

*Last updated: March 2026 — reflects public web self-service booking on myldma.com.*
