# Caretaker Portal: Guest Check-In & Payments — Analysis & Approach

## Summary

1. **Guest check-in** — Add a separate flow (no member lookup), capture first name, last name, email, phone; store in a new Neon table `caretaker_guest_check_ins`; send a different welcome email. No points. Keeps members and guests separate for reporting and marketing.

2. **Caretaker payments** — **Use Stripe**, not Shopify, for camp/site fees collected at check-in. Your pricing is a matrix (camp × site type × member vs guest × daily vs monthly); Stripe fits “compute amount then charge” and avoids hundreds of Shopify products or brittle Draft Orders.

---

## Part 1: Guest Check-In (Implementation Plan)

### Current state

- **Member flow:** Look up by member number → verify in Salesforce → Check in → writes to `caretaker_check_ins` (member_contact_id, member_number, member_display_name, nights, points), sends member welcome email, awards points.
- **Table:** `caretaker_check_ins` — member-only; no guest fields.

### Goal

- **Guest flow:** Bypass lookup. Caretaker enters: first name, last name, email, phone, nights. Store in a **separate** table. Send a **guest-specific** welcome email. No points. Use guest data for separate marketing (e.g. “visited as guest” segment).

### 1. Database: new table

Create **`caretaker_guest_check_ins`** (separate from member check-ins so you can query and market to guests independently):

```sql
-- Caretaker guest check-ins: non-members checked in at a camp. No points. Separate table for guest marketing.
CREATE TABLE IF NOT EXISTS caretaker_guest_check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_slug TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  nights INT NOT NULL,
  created_by_contact_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_caretaker_guest_check_ins_camp ON caretaker_guest_check_ins(camp_slug);
CREATE INDEX IF NOT EXISTS idx_caretaker_guest_check_ins_dates ON caretaker_guest_check_ins(check_in_date, check_out_date);
CREATE INDEX IF NOT EXISTS idx_caretaker_guest_check_ins_email ON caretaker_guest_check_ins(email);
```

- **No** `member_contact_id`, `member_number`, or `points_awarded` — guests are not in Salesforce (until you later convert them) and do not earn points.
- Index on `email` supports “all guests” and dedup/merge for marketing.

### 2. API

- **POST /api/members/caretaker/guest-check-ins**  
  Body: `{ firstName, lastName, email, phone?, nights }`  
  - Validate: required first/last/email; basic email format; phone optional.  
  - Same auth as member check-ins: `getCaretakerContext()`, camp from context.  
  - Insert into `caretaker_guest_check_ins` (check_in_date = today, check_out_date = today + nights).  
  - Fire-and-forget: send **guest** welcome email (see below).  
  - Return created row (id, campSlug, firstName, lastName, email, phone, checkInDate, checkOutDate, nights, createdAt).

- **GET /api/members/caretaker/guest-check-ins?status=active|archived|all**  
  Same pattern as member check-ins: filter by `caretaker.campSlug` and `check_out_date` for active vs archived. Return list for portal UI.

- **PATCH /api/members/caretaker/guest-check-ins/[id]**  
  Allow updating checkout date (and recalc nights). Optional; same idea as member check-in edit.

- **DELETE /api/members/caretaker/guest-check-ins/[id]**  
  Optional: “cancel” guest stay (e.g. set check_out_date to yesterday so it moves to archived). No points to deduct.

### 3. Guest welcome email

- New function in `lib/sendgrid.ts`: e.g. **`sendCaretakerGuestCheckInWelcomeEmail(to, campName, guestFirstName, checkInDate, checkOutDate)`**.
- Copy and adapt the member welcome email:
  - Different subject line, e.g. “Welcome to [Camp] — you’re checked in as our guest”.
  - Body: “Hi [FirstName], You’re checked in as our guest from [checkIn] to [checkOut]…” and a short line that you’re glad they’re visiting and they can learn about LDMA membership if interested (so it’s clearly guest-specific and marketing-friendly).

### 4. Portal UI

- **Member path (unchanged):** Look up member → Check in member (existing modal with nights).
- **Guest path (new):**
  - Add a clear action: **“Check in guest”** (e.g. button or tab next to “Look up member”).
  - Opens a form (no lookup): First name, Last name, Email, Phone (optional), Nights.
  - Submit → POST to `guest-check-ins` → show success, refresh lists.
- **Lists:**
  - Keep **Active check-ins** and **Archived check-ins** but distinguish **member** vs **guest**:
    - Option A: Two sections — “Active member check-ins” (existing API) and “Active guest check-ins” (new API). Same for archived. Simple and clear.
    - Option B: Single combined list with a badge “Member” vs “Guest” and one API that returns both (or two parallel fetches and merge in UI).  
  Recommendation: **Option A** (two sections, two APIs) so the backend stays simple and you can later add guest-specific actions (e.g. “Send payment link”) without touching member logic.

- **Guest rows:** Show first name, last name, email, phone (if any), check-in/out, nights. Edit checkout / Cancel reservation same idea as members (no points to deduct on cancel).

### 5. Copy-db / backups

- Add **`caretaker_guest_check_ins`** to any backup/export script (e.g. `scripts/copy-db-to-storage.mjs`) so guest data is included.

---

## Part 2: Caretaker Payments — Shopify vs Stripe

### Pricing complexity

You described:

- **Camp** — different rates per camp.
- **Site type** — e.g. RV vs tent vs cabin.
- **Member vs non-member** — different rates.
- **Duration** — daily vs monthly (long-term discounts).

That’s a **rate matrix**, not a fixed product catalog. The amount is computed from: camp + site type + member/guest + duration (and possibly number of nights).

### Option A: Shopify

- **Products/variants:** You’d need many SKUs (e.g. “Stanton – RV – Member – Daily”, “Stanton – RV – Guest – Daily”, “Stanton – RV – Member – Monthly”, …). Every camp × site × member/guest × duration = many products. Hard to maintain and error-prone.
- **Draft Orders (Admin API):** Backend could compute the total and create a Draft Order with a single line item (e.g. “Camp fee – Stanton – 3 nights – Guest”) and custom price, then redirect the guest to Shopify checkout.  
  - Pros: Payment flows through Shopify; one place for orders.  
  - Cons: Requires Shopify Admin API, webhooks for payment success, and the guest pays in a browser (send link or QR). Not ideal for “caretaker takes card at the desk” unless you add Shopify POS.
- **Shopify POS:** If caretakers use POS hardware, they could ring up a “product” and take payment in-person. You’d still need a way to map “this stay” to the right price (many products or a custom app that looks up price and adds line item). Possible but heavier.

**Verdict:** Shopify can work for “send guest a link to pay” via Draft Orders, but the rate matrix and in-person use case are a poor fit. Lots of products or custom Admin API logic.

### Option B: Stripe

- **Compute then charge:** One API route (e.g. `POST /api/members/caretaker/calculate-fee` and `POST /api/members/caretaker/create-payment-link`) that:
  - Takes: camp, site type, member vs guest, daily vs monthly, number of nights (and any other rules).
  - Uses a rate table (config or DB) to compute the total.
  - Creates a **Stripe Checkout Session** (or **Payment Intent** for in-person) for that exact amount.
- **Flows:**
  - **Guest pays on their device:** Caretaker checks in guest, optionally clicks “Send payment link” → backend creates Checkout Session with that guest’s email and amount → guest gets link (email or SMS) and pays. No SKUs.
  - **In-person at desk:** Later you can add Stripe Terminal; caretaker selects stay, amount is computed, card is taken at the device. Same rate logic, different Stripe API (Payment Intent + Terminal).
- **Consistency:** Your repo already recommends Stripe for variable-amount payments (see `docs/MEMBERS_MAINTENANCE_PAYMENT.md`). Same pattern: compute amount, create Checkout Session.

**Verdict:** Stripe is the better fit for caretaker-collected payments: one rate table, one API that computes and charges, supports both “send link” and future in-person Terminal.

### Recommended approach for payments (when you add them)

1. **Rate table:** Store in config or DB: by camp_slug, site_type (e.g. `rv` | `tent` | `cabin`), member_or_guest (`member` | `guest`), duration_type (`daily` | `monthly`), and rate (e.g. dollars per night or flat monthly). Apply long-term discount in the same table or a small rule (e.g. “monthly = daily_rate * 20”).
2. **Backend:**  
   - `POST /api/members/caretaker/calculate-fee` — input: camp, site type, member/guest, daily/monthly, nights. Response: `{ amountCents, breakdown? }`.  
   - `POST /api/members/caretaker/create-payment-link` — same inputs + guest email (or contact id for member). Validates caretaker, computes amount, creates Stripe Checkout Session, returns `{ url }`. Caretaker sends link to guest (or shows QR).
3. **Optional later:** Stripe Terminal for in-person card at the desk; reuse the same calculation and create a Payment Intent instead of Checkout Session.
4. **Linking payment to check-in:** Store `check_in_id` and `guest_check_in_id` (or similar) in Stripe metadata when creating the session, and on success webhook you can mark the stay as paid or store payment id in your DB.

---

## Implementation order

1. **Phase 1 — Guest check-in (no payments)**  
   - Migration: create `caretaker_guest_check_ins`.  
   - API: POST/GET (and optionally PATCH/DELETE) guest check-ins.  
   - SendGrid: guest welcome email.  
   - Portal: “Check in guest” form and separate Active/Archived guest lists.  
   - Backup: include new table.

2. **Phase 2 — Payments (when you’re ready)**  
   - Define rate table (camp × site × member/guest × daily/monthly).  
   - Stripe: create Checkout Session (and optionally Payment Intent for Terminal).  
   - API: calculate-fee + create-payment-link (caretaker-only).  
   - Portal: “Send payment link” (and later Terminal flow) after guest check-in.

This keeps guest check-in and marketing separation in place first, then adds payments on top with a clear Stripe-based design.
