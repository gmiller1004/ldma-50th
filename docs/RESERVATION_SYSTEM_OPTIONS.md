# Site Reservation System — Options & Exploration

This doc steps back to explore how to evolve from **“check-in on arrival”** to a **reservation management system** that supports future reservations, site assignment, no overlap, and clear caretaker UX. No decisions are final; the goal is to compare approaches before building.

---

## 1. Current State vs Target State

### What you have now

- **Caretaker portal:** Member lookup → check in (today + nights). Guest check-in (name, email, phone, nights). No concept of **which site** they’re in.
- **Data:** `caretaker_check_ins` and `caretaker_guest_check_ins` store **camp + person + check_in_date + check_out_date + nights**. No `site_id` or “reservation” vs “checked in.”
- **Workflow:** Entirely **arrival-based**. Caretaker enters when someone shows up. No “book for next week” or “assign to Site 5.”

### What you want

- **Future reservations:** Someone (member or guest) can **reserve a site for future dates** — often by **calling the camp**; caretaker creates the reservation.
- **Site assignment:** Each reservation is tied to a **specific site** (e.g. Site 5, RV-12) so you know who is in what site and can prevent double-booking.
- **No overlap:** Same site + overlapping dates = one reservation only; system (or caretaker) can’t create conflicts.
- **Caretaker UX:** Clear view of **who is in what site**, **what’s available** when, and ability to **create / edit / cancel** reservations and still **check people in** when they arrive.
- **Member/guest experience:** Clear path for how they **get a reservation** (call vs online) and what they see (confirmation, maybe payment).

So the shift is: from **“check-in only”** to **“reservation (with site) → optional check-in on arrival → checkout.”**

---

## 2. Reservation Lifecycle (Conceptual)

A single stay can be modeled in stages:

1. **Reservation created** — Site + dates + who (member or guest). Created when they call (caretaker enters) or when they book online (if you add that). Status: e.g. `reserved` or `pending`.
2. **Check-in (on arrival)** — When they show up, caretaker marks the reservation as “checked in” (optional if you still want to track “actually here”). Could also auto-check-in on first day.
3. **Checkout** — End date reached or early checkout; reservation moves to “archived” or “completed.”

Payment can happen at **booking**, at **check-in**, or **later** (e.g. send link). You can keep payment as a separate phase (Stripe link / Terminal) that references the reservation.

This gives you one **reservation** record per stay (with site + dates + guest/member), and optionally a **checked_in_at** timestamp so caretakers see “here today” vs “coming next week.”

---

## 3. Data Model: Sites and Reservations

To support “who is in what site” and “no overlap,” you need **sites** and **reservations** that reference them.

### 3.1 Sites (first-class)

- **Table:** `camp_sites` (or `sites`) with at least: `id`, `camp_slug`, `name` (e.g. "Site 5", "RV-12"), optional `site_type` (rv, tent, cabin) for pricing, optional `sort_order`.
- **Per camp:** You define the list of bookable sites per camp. Could be seeded per camp (Stanton has 50 sites, Italian Bar has 20, etc.).

### 3.2 One reservation table (member + guest)

Instead of two tables (member check-ins vs guest check-ins), one **reservations** table can hold both:

- **Core:** `id`, `camp_slug`, `site_id` (FK to site), `check_in_date`, `check_out_date`, `nights`, `status` (e.g. `reserved` | `checked_in` | `completed` | `cancelled`).
- **Who:** Either member fields (`member_contact_id`, `member_number`, `member_display_name`) **or** guest fields (`guest_first_name`, `guest_last_name`, `guest_email`, `guest_phone`). One set populated per row (or both null and you add a `type: 'member' | 'guest'`).
- **Audit:** `created_by_contact_id`, `checked_in_at` (nullable timestamp), `created_at`, `updated_at`.
- **Overlap rule:** Unique constraint or application check: for a given `site_id`, no two rows with `status NOT IN ('cancelled')` have overlapping `[check_in_date, check_out_date)`.

Existing **caretaker_check_ins** and **caretaker_guest_check_ins** could stay for **historical** data; new flow writes to **reservations** (and optionally you backfill or migrate later).

### 3.3 Migration path

- **Option A — Clean cut:** New `camp_sites` + `reservations`. New caretaker flows only use these. Old check-in tables remain read-only for history; no new rows.
- **Option B — Evolve in place:** Add `site_id` (nullable) to existing check-in tables and add a “reservations” view or status so that “future” rows are reservations and “today” rows are check-ins. More coupling, harder to enforce one site per date range across two tables.
- **Recommendation:** **Option A** keeps overlap logic simple (one table, one constraint) and gives a clear “reservation” vs “legacy check-in” story.

---

## 4. Who Creates the Reservation? (Member/Guest Experience)

| Approach | How it works | Member/guest experience | Caretaker role |
|----------|--------------|---------------------------|----------------|
| **Call-in only** | Member/guest calls camp. Caretaker creates reservation in portal (site + dates + member or guest info). | Phone only; confirmation by email (optional) or verbal. | Single place to create/edit; no public booking form. |
| **Online form (public)** | Anyone can submit a “request” form (camp, dates, site preference, name, email, phone). Creates a **request** or **reservation** (e.g. pending). Caretaker approves or assigns site and confirms. | Submit on web; get “we’ll confirm” or “confirmed” email. | Caretaker assigns site, confirms, maybe takes payment. |
| **Member portal (logged-in)** | Logged-in members see “Reserve a site” for a camp: pick dates, see availability, pick site, submit. Creates reservation (or request). | Self-serve for members; guests still call or use public form. | Caretaker can still create/edit for call-ins; sees all reservations. |
| **Hybrid** | Call-in + one of the above (e.g. call-in + public form for requests). | Choice: call or use web. | Same as above. |

**Considerations:**

- **Call-in only** is simplest to build first: caretaker UI only; no public pages, no auth for guests. You already have “check in guest” and “check in member”; adding “create future reservation” (with site + dates) fits the same portal.
- **Online form** improves experience (no phone tag) but needs rules: who can book how far ahead, approval vs auto-confirm, how site is chosen (caretaker assigns vs guest picks from available).
- **Member portal** is best long-term for members but requires availability API, calendar/ grid UI, and login; guests still need call or form.

**Practical order:** Start with **call-in only** (caretaker creates all reservations). Add **public “request” form** or **member self-serve** once the core reservation + site model and caretaker UX are solid.

---

## 5. Caretaker UI/UX — Views That Help

Caretakers need to:

- Create a **future** reservation (site + dates + member or guest).
- See **who is in what site** (and who’s coming when).
- See **what’s available** (sites with no reservation for given dates).
- **Check in** when someone arrives (update reservation to “checked in” or set `checked_in_at`).
- **Edit** (change dates or site) and **cancel** reservations.

Useful views:

| View | Purpose | Implementation idea |
|------|---------|----------------------|
| **By site (default)** | “Site 5: John Doe, Mar 10–15” | List or grid of sites; under each, current/future reservations (or “Available”). Filter by date range. |
| **By date (calendar/list)** | “March 12: who’s here / arriving / leaving?” | List reservations where date is in [check_in, check_out]; group by site or show timeline. |
| **Availability** | “What’s free March 10–15?” | For a date range, list sites that have no overlapping reservation (or highlight available in by-site view). |
| **Create reservation** | Form: camp (pre-filled), site (dropdown or pick from available), dates, member (lookup) or guest (name/email/phone). | Same pattern as guest check-in; add site + dates; for members reuse lookup. |
| **Check-in on arrival** | From list or site view: “Mark as checked in” for a reservation. | Button that sets `checked_in_at` (and maybe status to `checked_in`). |

**Suggested default for caretaker home:** **By-site view** for “today” or “this week” so they quickly see who’s in which site. A second tab or section for **“Create reservation”** (future) and **“Upcoming / past”** (list or simple calendar).

---

## 6. Overlap Prevention

- **DB:** For `reservations`, enforce no overlapping dates for the same `site_id` (excluding cancelled). Options:
  - **Unique constraint:** PostgreSQL doesn’t have a native “no overlapping ranges” constraint; use an **EXCLUDE** constraint with `daterange(check_in_date, check_out_date)` and `gist` on `(site_id, daterange(...))`, or
  - **Application:** On insert/update, `SELECT` reservations for that `site_id` that overlap the new range; if any, return 400 “Site not available for those dates.”
- **Caretaker UI:** When creating or editing a reservation, either:
  - **Dropdown of sites:** Only show sites that are **available** for the chosen dates (query overlap), or
  - Show all sites but display a warning or prevent submit if the chosen site is already booked for those dates.

Application-level check is simpler to add first; you can add an EXCLUDE constraint later for extra safety.

---

## 7. Payment Timing and Flow

- **When:** At **booking** (pay to confirm), at **check-in** (pay when arriving), or **later** (send link; pay before or after).
- **Who:** Caretaker sends Stripe link (or takes card with Terminal) for **guest**; **member** might pay same way or via existing member dues flow.
- **Linking:** Store `reservation_id` (and maybe amount) in Stripe metadata; on success webhook, mark reservation as “paid” or record payment in a small `reservation_payments` table so caretakers see “paid” in the UI.

You can keep payment as a **second phase** after reservation + site + overlap are working: first “create reservation (maybe unpaid),” then “send payment link” or “take payment at desk.”

**Modified reservations:** When a reservation is edited (e.g. earlier check-in, later checkout, or shorter stay), payment handling (proration, extensions, refunds) will need to be defined and implemented with Stripe—e.g. charge/refund the difference, or send a new payment link for the new total.

---

## 8. Options Summary and Suggested Order

| Dimension | Option A (minimal) | Option B (recommended path) | Option C (full self-serve) |
|-----------|--------------------|-----------------------------|----------------------------|
| **Who creates reservations** | Caretaker only (call-in) | Caretaker only at first; add request form later | Caretaker + member portal + public form |
| **Sites** | No sites; reserve “camp + dates” only (no site assignment) | Sites per camp; reserve site + dates | Same |
| **Overlap** | Per-camp (no two reservations same camp same dates?) or none | Per-site (no overlap same site + dates) | Same |
| **Caretaker view** | List of reservations (like today’s check-ins) | By-site + by-date; create reservation with site picker; check-in on arrival | Same + approve requests |
| **Member/guest** | Call only | Call first; optional “request” form or email | Self-serve for members; form for guests |
| **Payment** | Later | After reservations work: Stripe link / Terminal | Same |

**Suggested order:**

1. **Sites + reservations model** — Add `camp_sites` (seed per camp) and `reservations` (site_id, dates, member or guest, status). Overlap check on create/update (app or DB).
2. **Caretaker: create reservation** — Flow: pick site (or “any” and suggest available), dates, member (lookup) or guest (name/email/phone). No payment yet.
3. **Caretaker: by-site and by-date views** — Default “who’s in what site” (and who’s coming); simple availability when picking site.
4. **Caretaker: check-in on arrival** — From a reservation row, “Check in” sets `checked_in_at` (and welcome email if you want). Keeps current “check in member/guest” idea but tied to a reservation.
5. **Optional:** Public “request a reservation” form (creates pending reservation or request; caretaker assigns site and confirms).
6. **Optional:** Payment (Stripe link / Terminal) linked to reservation.

This keeps the **member/guest experience** as “call camp to reserve” at first, and the **caretaker experience** as the single place to create reservations, see occupancy, and check people in — with a clear path to add online requests and payment later.

---

## 9. Open Decisions (For You to Nail Down)

Before implementing, it helps to decide:

1. **Sites per camp:** Do you have a fixed list per camp (e.g. Stanton Sites 1–50, Italian Bar 1–20)? Or “first come” without named sites (no site table; only camp + dates)?
2. **Call-in only at first?** Confirm that starting with “caretaker creates all reservations” (call-in) is acceptable; we can add request form or member self-serve later.
3. **Legacy check-ins:** Keep `caretaker_check_ins` / `caretaker_guest_check_ins` as historical only (no new rows) and all new flow in `reservations`, or do you want to migrate old data into `reservations` (without site)?
4. **Check-in required?** Is “mark as checked in” when they arrive required for your process (and welcome email), or can a reservation go straight from “reserved” to “completed” at checkout date?

Once those are set, the next step is to define the exact schema (`camp_sites`, `reservations`) and the first caretaker flows (create reservation with site, list by site, check-in on arrival).
