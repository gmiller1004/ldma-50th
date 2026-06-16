# Camp Reservations Upgrade — Roadmap

Replace ResNexus and the legacy caretaker check-in model with a unified **site reservation + billing period** system across all **8 LDMA camps**. This doc is the implementation roadmap; decisions below are **locked** unless noted.

**Supersedes:** exploratory notes in `docs/RESERVATION_SYSTEM_OPTIONS.md` (historical).  
**Related:** `docs/CARETAKER_GUEST_CHECKIN_AND_PAYMENTS.md`, `docs/KLAVIYO_CAMP_STAY_REMARKETING.md`, `data/camp-reservations/`.

---

## Goals

1. All camps use **site reservations** (no legacy check-in writes).
2. Support **rolling 30-day billing periods**, **partial payments**, and **payment-due reminders**.
3. Import future bookings from ResNexus exports where available (3 camps).
4. Preserve live reservations at **Burnt River** and **Vein Mountain** during site master migration.
5. Cancel ResNexus subscription after cutover.

---

## Locked product decisions

| # | Topic | Decision |
|---|--------|----------|
| 1 | Site master | `data/camp-reservations/LDMA CAMP SITE MASTER - v01 2.xlsx` (8 camps, 537 sites). Export to CSV for seeding. Stable key: `site_code` per camp. |
| 2 | Billing cadence | **Rolling 30-day periods** from check-in (not calendar month). |
| 3 | Non-member pricing | **Daily rate only**, every period: `non_member_daily × nights`. No long-stay discount. |
| 4 | Member vs guest (import) | (1) `$0` comp → **member**. (2) Salesforce name match. (3) Amount heuristic vs expected member monthly vs guest daily. (4) Default guest + `needs_review` flag. |
| 5 | Points | **50 pts/night** for **members** when reservation is **checked in** (parity with legacy). No points for guests. |
| 6 | Member pricing | **≤29 nights:** `member_daily × nights`. **≥30 nights:** **monthly rate for the whole stay, prorated:** `member_rate_monthly × (total_nights / 30)`. Split into rolling 30-day **billing periods** for collection; full periods = one monthly installment; final partial period = `member_rate_monthly × (days / 30)`. |
| 7 | ResNexus import | **Only** Stanton, Blue Bucket, Loud Mine (existing CSVs). **No** ResNexus exports for Burnt River, Vein Mountain, Oconee, Duisenburg, Italian Bar — use portal + **admin manual tool** for future bookings. |
| 8 | Ledgers | **Site fees** (billing periods) and **membership/maintenance** (Salesforce past-due) stay **separate**, both visible in caretaker and admin portals. |

### Camps and site counts (master v01 2)

| Master name | Slug | Sites |
|-------------|------|------:|
| Stanton | `stanton-arizona` | 172 |
| Italian Bar | `italian-bar-california` | 65 |
| Duisenburg | `duisenburg-california` | 35 |
| Blue Bucket | `blue-bucket-oregon` | 54 |
| Burnt River | `burnt-river-oregon` | 35 |
| Oconee | `oconee-south-carolina` | 45 |
| Loud Mine | `loud-mine-georgia` | 81 |
| Vein Mountain | `vein-mountain-north-carolina` | 50 |

---

## Current vs target (summary)

| | Today | Target |
|---|--------|--------|
| Camps on reservations | Burnt River, Vein Mountain only | All 8 |
| Legacy check-in | Other 6 camps | Read-only history; no new writes |
| Payment model | Full stay upfront | Rolling 30-day periods + partial pay |
| Pricing | Daily × nights (+10% at 30+ nights) | Rules in table above |
| Event free sites | Dirt Fest included dry / hookup upgrade | **Remove** |
| ResNexus | External | Import + portal + admin tool |

---

## Target data model

```
camp_sites
  + site_code, member_rate_monthly, special_type
  UNIQUE (camp_slug, site_code)

camp_reservations
  Full stay span (blocks calendar). Member or guest.
  + external_res_number (ResNexus Res#), import_source, needs_review

camp_billing_periods                    [NEW]
  reservation_id, period_start, period_end, nights
  amount_due_cents, amount_paid_cents, due_date
  status: unpaid | partial | paid | waived
  pricing_basis: member_monthly_prorated | member_daily | guest_daily

camp_payments
  Site-fee ledger. Link to billing_period_id (and reservation_id).
  payment_type: reservation (past_due unchanged for SF dues)

camp_stay_thanks / Klaviyo sync         [unchanged pattern]
```

**Availability:** Overlap check uses full reservation `check_in_date` … `check_out_date`, not individual billing periods.

---

## Pricing reference (implementation)

```text
total_nights = nights between check-in and check-out

MEMBER:
  if total_nights <= 29:
    total = member_daily * total_nights
    pricing_basis = member_daily
  else:
    total = member_rate_monthly * (total_nights / 30)
    pricing_basis = member_monthly_prorated

NON-MEMBER:
  total = non_member_daily * total_nights
  pricing_basis = guest_daily

BILLING PERIODS (collection schedule):
  Split stay into rolling 30-day chunks from check-in.
  Allocate total across periods:
    - Member >=30 nights: each full 30-day period = member_rate_monthly;
      final partial = member_rate_monthly * (partial_days / 30)
    - Member <=29: typically one period (daily total)
    - Guest: each period = non_member_daily * period_nights
```

---

## ResNexus import (3 camps)

**Files:** `data/camp-reservations/stanton_stayed_on.csv`, `Blue Bucket Future Reservations.csv`, `Loud Mine Future Reservations.csv`.

**Per file:**

1. Group rows by `Res#` → one `camp_reservations` + N `camp_billing_periods`.
2. Parse site string → `site_code` → `camp_sites.id`.
3. Classify member/guest (locked rules).
4. Waterfall-allocate `Paid` across periods (prepay, partial, `--` unpaid).
5. Idempotent: `(camp_slug, external_res_number, period_start)`.

**Import report:** unparseable dates, site mismatches, ambiguous member/guest, amount mismatches.

---

## Migration: Burnt River & Vein Mountain

1. Backup prod `camp_sites`, `camp_reservations`, `camp_payments`.
2. Seed sites from master v01 2 with `site_code`.
3. Remap existing reservations: old `site_id` → new `site_id` via site number/name map.
4. Backfill billing periods for existing paid reservations (single period or reconstruct from payments).
5. Validate: no new overlaps, payment totals unchanged.

---

## Implementation phases

### Phase 0 — Roadmap & data prep

- [x] Lock decisions (this doc)
- [x] Export master xlsx → `data/camp-reservations/camp-site-master.csv` (committed)
- [x] Add `data/camp-reservations/README.md` (column definitions, import notes)

### Phase 1 — Schema & site seed (no UI change)

- [x] SQL migrations: `site_code`, `member_rate_monthly`, `camp_billing_periods`, payment ↔ period link
- [x] `scripts/export-camp-site-master.py` + `scripts/seed-camp-sites-from-master.mjs`
- [x] `lib/reservation-pricing.ts` v2 (`computeStayPricing`, `generateBillingPeriods`; legacy fn kept)
- [x] `lib/reservation-dates.ts`, `lib/camp-master.ts`
- [x] Unit tests (`npm test`)
- [x] Run migrations + seed on production (6 camps; BR/VM deferred to Phase 3)

### Phase 2 — ResNexus import (staging)

- [x] `lib/resnexus-import.ts` + tests
- [x] `scripts/import-resnexus-reservations.mjs` (dry-run default, `--execute` to write)
- [x] `scripts/migrate-camp-reservations-import.sql` (external_res_number, needs_review)
- [x] Run import migration + `npm run db:import:resnexus -- --execute` on production
- [x] Reconcile totals vs source CSVs; fix site/date edge cases

### Phase 3 — BR/VM migration (staging → prod)

- [x] `lib/pilot-site-remap.ts` — legacy site name → master `site_code`
- [x] `lib/backfill-billing-periods.ts` — payment waterfall for pilot reservations
- [x] `scripts/migrate-pilot-camps-phase3.ts` (dry-run default, `--execute`, `--prune-old-sites`)
- [x] `isNonBookableSite` updated for VM `UC-01` (caretaker site)
- [x] Run `npm run db:migrate:pilot-camps` then `--execute` on production (30 remapped, 13 legacy sites pruned)

### Phase 4 — API & payment rework

- [x] Create reservation → auto-generate billing periods (not single lump-sum only)
- [x] Record partial payment (cash) against period(s); waterfall apply (`/payments/record-reservation-payment`)
- [x] Remove event reservation paths (`event_product_handle`, included dry, etc.)
- [x] Backdated check-in (past check-in within 7-day caretaker policy)
- [x] Points on member check-in from reservations
- [x] `campUsesReservations` → all seeded camps
- [x] Store `stripe_payment_intent_id` on webhook
- [x] Cancellation refund calculator + cancel endpoint with refund preview
- [x] Stripe refund on cancel (card only); cash refund ledger entry
- [x] Invoice number generation; payment ↔ reservation display ids
- [x] Price override fields + validation (reason required)
- [x] Member lookup by email / phone

### Phase 5 — Portal UI

- [x] Single reservation UI for all camps (retire legacy check-in create flows)
- [x] Billing period list on reservation detail; record payment
- [x] Payment-due badges on active reservations
- [x] Separate **site balance** vs **membership/maintenance due** on member lookup
- [x] Backdate check-in on create/edit

### Phase 6 — Admin & reminders

- [x] Director dashboard: site-fee AR, overdue periods by camp
- [x] **Manual reservation tool** (director + caretaker): create/edit future stays, periods, external payments — for camps without ResNexus import
- [x] Cron: periods due within N days or past due → portal “Payments to collect” (email optional later)

### Phase 7 — Cutover

- [ ] Enable all camps in prod
- [ ] Freeze ResNexus; final delta import if any
- [ ] Caretaker training / one-pager
- [ ] Cancel ResNexus

---

## Out of scope (for now)

- Public self-service online booking (caretaker-created only unless added later)
- Auto-updating Salesforce when membership/maintenance collected at camp
- Klaviyo flows for site-fee payment reminders (portal-first)

---

## Caretaker portal enhancements

These requests fit the upgrade; most depend on **billing periods** and **payment ledger** (Phase 4+). Grouped by theme.

### Cancellation & refunds (high priority)

**Rules (locked intent):**

| Situation | Refund |
|-----------|--------|
| Cancel **≥7 days before** check-in | **Full refund** of site fees paid (card via Stripe; cash recorded as manual refund) |
| Cancel **&lt;7 days before** or **during stay**, **daily-priced stay** (member ≤29 nights, or **any guest stay including ≥30 nights**) | Refund **remainder** after earned nights, minus **$25** cancellation fee |
| Cancel **&lt;7 days before** or **during stay**, **monthly-priced stay** (member ≥30 nights) | Earned amount = **nights stayed × `member_daily`**; refund **max(0, paid − earned − fee)** where fee = **$100** (hookup site) or **$25** (dry site) |

**Safety (required):**

```text
refund_cents = min(computed_refund, total_paid_cents - total_already_refunded_cents)
refund_cents = max(0, refund_cents)
```

Never refund more than was collected on site-fee payments for that reservation/group.

**Implementation notes:**

- `lib/cancellation-refund.ts` — pure functions + unit tests (29 vs 30 night stays, mid-stay, partial pay, over/under pay).
- On cancel: compute → show caretaker **preview** (paid / earned / fee / refund) → confirm.
- **Stripe:** refund via Refunds API against stored `stripe_payment_intent_id` or charge from `camp_payments` (may need to store payment intent on webhook today). Process at cancel time for card payments.
- **Cash:** no Stripe refund; record `camp_payments` row `method: cash`, negative amount or `payment_type: refund` + receipt note.
- Cancel **frees the site** (status `cancelled`); billing periods after cancel date voided or marked `cancelled`.
- Hookup vs dry: use existing `isHookupSiteType(site_type)` (same as old event hookup detection).

**Phase:** 4 (API) + 5 (cancel UI with refund preview). Depends on billing periods.

---

### Portal UX

| # | Request | Makes sense? | Approach |
|---|---------|--------------|----------|
| 2 | **Light mode** | Yes | Theme toggle on caretaker + admin portals (`localStorage`). CSS variables for background/text/gold accents; default stays dark, optional light. |
| 5 | **Show created date** | Yes | `created_at` already on reservations — show in list + detail. Phase 5. |

**Phase:** 5 (can ship light mode early as a small PR independent of billing).

---

### Member lookup

| # | Request | Makes sense? | Approach |
|---|---------|--------------|----------|
| 3 | **Lookup by phone or email** | Yes | Extend `POST /api/members/caretaker/lookup` to accept `{ memberNumber }` OR `{ email }` OR `{ phone }` (one at a time). Salesforce SOQL on `Email` / normalized `Phone`. If multiple contacts match, return list to pick one. |

**Caveats:** Normalize phone to digits; warn on duplicates. Same fields as today for dues display.

**Phase:** 4–5 (small API + form change).

---

### Payments & reconciliation

| # | Request | Makes sense? | Approach |
|---|---------|--------------|----------|
| 4 | **Invoice / Stripe ID on reservation** | Yes | On reservation detail: show `created_at`, human **`invoice_number`** (sequential per camp or global), and for each payment: `stripe_checkout_session_id` / `stripe_payment_intent_id` (store both on webhook). Cash shows receipt id / internal payment UUID. |
| 7 | **Override amount before payment** | Yes | Before checkout/cash: caretaker can set `amount_override_cents` + required `override_reason`. Store `calculated_amount_cents` vs override; set `price_override_flag` for admin dashboard filter. Director can review flagged reservations. |

**Phase:** 4 (schema + API) + 5 (UI) + 6 (admin flagged list).

---

### Group reservations (multiple sites, one charge)

| # | Request | Makes sense? | Approach |
|---|---------|--------------|----------|
| 6 | **Multiple sites, one transaction** | Yes, more complex | Introduce **`reservation_group_id`** (UUID) shared by N `camp_reservations` (one per site). Create flow: pick primary member/guest + N sites; for **additional** sites caretaker picks **member rate** or **non-member rate** only (no extra SF lookup). Single Stripe Checkout with line items per site (or one lump sum). One cash payment allocated across sites. Calendar blocks all sites. Cancel/refund rules apply **per site** or **per group** — define at cancel time (likely per reservation with group checkout summary). |

**Phase:** 5–6 after single-site billing periods work. Do not block Phase 1–4.

---

## Target data model (additions)

```
camp_reservations
  + reservation_group_id (nullable UUID)
  + invoice_number (nullable, display)
  + calculated_total_cents, amount_override_cents, override_reason, price_override_flag
  + cancelled_at, cancellation_refund_cents (audit)

camp_payments
  + stripe_payment_intent_id
  + billing_period_id
  + payment_type: add 'refund' (negative or separate refund rows)
  + invoice_number (copy for receipts)

camp_refunds                              [optional, or refund rows in camp_payments]
  reservation_id, payment_id, amount_cents, method, stripe_refund_id, created_by
```

---

## Updated implementation phases (caretaker items)

### Phase 4 — API & payment rework (add)

- [x] Cancellation refund calculator + cancel endpoint with refund preview
- [x] Stripe refund on cancel (card only); cash refund ledger entry
- [x] Invoice number generation; payment ↔ reservation display ids
- [x] Price override fields + validation (reason required)
- [x] Member lookup by email / phone

### Phase 5 — Portal UI (add)

- [x] Light / dark theme toggle
- [x] Created date + invoice / Stripe ids on reservation detail
- [x] Cancel flow with refund breakdown before confirm
- [x] Price override UI before payment
- [ ] (Later) Group reservation create UI

### Phase 6 — Admin (add)

- [x] Flagged price overrides report
- [ ] Group reservation support + single checkout
- [ ] Refund audit log per camp

---

## Open questions (minor)

- Max backdate window for caretakers (e.g. 7 days)?
- Salesforce name matching: fuzzy threshold / manual review queue in admin?
- Partial payment: apply to oldest unpaid period by default (recommended)?
- **Cancellation:** For group stays, cancel one site vs whole group — caretaker choice?
- **Cancellation:** Guest **≥30 night** stays (daily pricing only) — use **daily-stay rule** ($25 fee, earned = nights stayed × `non_member_daily`). **Locked.**
- **Cash refunds:** Require director approval above $X?

---

## Suggested first PR

**Phase 1 only:** migrations + master seed script + pricing/billing-period libs + unit tests for pricing edge cases (29 vs 30 vs 31 nights, partial last period, guest 60 nights). No portal changes; safe to merge and validate in staging.
