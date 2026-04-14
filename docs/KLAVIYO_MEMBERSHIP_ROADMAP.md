# Klaviyo membership remarketing roadmap

This project uses **Klaviyo profiles + custom events** for membership remarketing (replacing the former Mailchimp `mc_eid` ecommerce cart path).

- Visitors from **Klaviyo campaigns** — onsite JavaScript + normal Klaviyo click tracking; **UTM** for attribution.
- **Other traffic** — optional **email + save quote** on the membership summary step sets a cookie and syncs cart activity to Klaviyo.

---

## Implemented (engineering)

| Area | Details |
|------|---------|
| **Onsite script** | `components/KlaviyoOnsiteScript.tsx` — loaded from root `app/layout.tsx`. Set `NEXT_PUBLIC_KLAVIYO_COMPANY_ID`. |
| **Middleware** | `middleware.ts` — `mailchimp_*` cookies removed; matcher includes `/events`, `/events/*`. |
| **Events + cart sync** | **`Membership Configuration Viewed`** / **`Membership Configuration Finalized`** fire from the **browser** (`lib/klaviyo-membership-browser.ts` → `klaviyo.push(['track', …])`) so visitors identified from a **Klaviyo email click** get events **without** typing email on the site. Same metric names and properties as the server API; payload built in `lib/klaviyo-membership-modal-payload.ts`. Server Create Event still used for **`Membership Quote Saved`** (save-quote API) and **`Membership Cart Updated`** when `membership_quote_email` cookie exists. All include **`line_items_summary`** and **`cart_permalink`** where applicable (`lib/shopify-cart-permalink.ts`). Cookie `membership_quote_email` (httpOnly). `app/actions/cart.ts` syncs cart to Klaviyo when cookie present + membership lines. |
| **Save quote API** | `POST /api/membership/save-quote` — subscribes via `subscribeEmailToKlaviyoMarketing(..., "membership_quote")`, emits **Membership Quote Saved**, sets cookie. |
| **UI** | `MembershipCustomizationModal` summary step — email + “Email me this quote”. |
| **Email HTML (Klaviyo)** | `docs/email-klaviyo-membership-configuration-viewed-day1.html` (+ day 3), **`docs/email-klaviyo-membership-quote-saved.html`** — immediate send on metric **Membership Quote Saved**. |
| **Mailchimp removed** | `lib/mailchimp.ts` deleted; cart no longer uses Mailchimp. |

**Related Klaviyo code (unchanged):** `lib/klaviyo-marketing-subscribe.ts`, `lib/klaviyo-camp-stay.ts`, newsletter + chat + caretaker flows.

---

## Goals

1. ~~Deprecate Mailchimp for membership / cart remarketing~~ **Done (code)** — remove `MAILCHIMP_*` from deployment env when ready.
2. Attribute memberships and events funnel behavior to the right **Klaviyo profile** for flows and segments.
3. Support **cold traffic** with **save quote** + email capture. **Done**
4. Keep **one** system of record for this funnel: Klaviyo + Shopify orders for purchase truth.

---

## Principles

- **UTM parameters** attribute *which campaign*; they do **not** identify a person by themselves.
- **Klaviyo JavaScript** helps **email click → site** profile association; set `NEXT_PUBLIC_KLAVIYO_COMPANY_ID`.
- **Server-side `Create Event`** uses `KLAVIYO_PRIVATE_API_KEY` once email is known (quote save or cookie).

---

## Phase 0 — Product & compliance

- [ ] Define when someone is **marketable** (campaign subscribers vs explicit opt-in on “save quote”).
- [ ] Confirm **save quote** uses acceptable consent language (currently uses same marketing subscribe as newsletter).
- [ ] Remove **`MAILCHIMP_API_KEY`** / **`MAILCHIMP_STORE_ID`** from env after deploy verification.

---

## Phase 1 — Klaviyo onsite foundation

| Task | Status |
|------|--------|
| Klaviyo onsite snippet in layout | Done (`KlaviyoOnsiteScript`) |
| UTM on email links | Marketing / Klaviyo campaign setup |
| Middleware matcher `/events` | Done |

---

## Phase 2 — Membership intent events

| Task | Status |
|------|--------|
| `lib/klaviyo-membership-events.ts` | Done |
| Metrics: **`Membership Cart Updated`**, **`Membership Quote Saved`** | Done — confirm names in Klaviyo before building flows |
| Wire `app/actions/cart.ts` when email cookie + membership lines | Done |

---

## Phase 3 — Save my quote

| Task | Status |
|------|--------|
| UI + API | Done |

---

## Phase 4 — Events page (optional)

- [ ] Optional **`Events Page Viewed`** custom event or stronger CTA tracking.
- [ ] Optional email capture on `/events` reusing newsletter patterns.

---

## Phase 5 — Klaviyo flows (marketing-owned)

Build in Klaviyo UI using:

- **Membership Quote Saved** — follow-up sequences; suppress on purchase.
- **Membership Cart Updated** — abandoned-style flows; suppress on purchase / unsubscribe.
- **Suppression:** Placed Order (Shopify integration), unsubscribed.

---

## Phase 6 — Mailchimp cleanup

| Task | Status |
|------|--------|
| Remove cart sync + `lib/mailchimp.ts` | Done |
| Remove `mc_eid` middleware cookies | Done |
| Env: drop `MAILCHIMP_*` in hosting | Pending |

---

## Environment variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_KLAVIYO_COMPANY_ID` | **Public** Company ID for onsite Klaviyo script (Settings → Account / install instructions). |
| `KLAVIYO_PRIVATE_API_KEY` | Events API + profile subscribe (needs `events:write` among other scopes). |
| `KLAVIYO_LIST_ID` | List for marketing subscribe (save quote + newsletter). |

---

## References

- `docs/NEWSLETTER_KLAVIYO_SETUP.md`
- `docs/KLAVIYO_CAMP_STAY_REMARKETING.md`
- [Create Event](https://developers.klaviyo.com/en/reference/create_event)
