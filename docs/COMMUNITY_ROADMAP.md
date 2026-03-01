# Community Roadmap

Forward-looking plan for scaling the LDMA directory and community as it grows to thousands of discussions. Includes camps, claims, and engagement features.

---

## 1. Information Architecture: Camp → Claims → Discussions

```
Directory (home)
├── Camp: Stanton
│   ├── Camp-level discussions (general camp chat)
│   └── Claims
│       ├── Rich Hill → discussions
│       └── [Other claim] → discussions
├── Camp: Italian Bar
│   ├── Camp-level discussions
│   └── Claims...
```

- **Camp-level** discussions = general trip reports, camp updates, questions
- **Claim-level** discussions = area-specific (e.g., Rich Hill near Stanton)
- Add `claim_id` to discussions: `null` = camp-level, non-null = claim-specific

---

## 2. URL Structure

| Route | Purpose |
|-------|---------|
| `/directory` | Camp list + optional global activity |
| `/directory/[camp]` | Camp page: camp discussions + claims list |
| `/directory/[camp]/c/[claim-slug]` | Claim-specific discussions |
| `/directory/[camp]/d/[id]` | Discussion thread (works for camp or claim) |

Same discussion detail route for both; breadcrumbs provide context.

---

## 3. Sorting & Filtering

Use existing data (`thumbs_up_count`, `comment_count`, `updated_at`) for:

- **Most recent** (default) — `updated_at DESC`
- **Most liked** — `thumbs_up_count DESC`
- **Most engagement** — `comment_count + thumbs_up_count` (or similar)

Add sort dropdown in discussion list header. Optionally persist preference in `localStorage`.

---

## 4. Pagination & Performance

- Paginate early: 25–50 discussions per page
- Cursor-based pagination (e.g. `last updated_at + id`) for stable lists
- Indexes: `(camp_slug, updated_at)`, `(camp_slug, thumbs_up_count)`, and later `(claim_id, …)`
- Optional: “Load more” / infinite scroll for mobile

---

## 5. Directory Home UX

**Option A (camp-centric):** Camp cards as primary entry. Each card shows discussion count, recent activity, maybe thumbs-up count. Good for discovery by location.

**Option B (feed):** Add “Recent activity” or “Latest” feed across all camps/claims. Filterable by camp. Good for power users.

**Recommendation:** Start with A, add B later if needed.

---

## 6. Search

- Full-text search on `title` + `body` (Postgres `tsvector` / `tsquery`)
- Filters: camp, claim, date range
- “Search in this camp only” on camp pages

---

## 7. Claims Data Model

```
claims: id, camp_slug, name, slug, description, sort_order
discussions: ... existing ... + claim_id (nullable FK)
```

`claim_id = null` = camp-level. Claims seeded from LDMA data or admin-managed.

---

## 8. Camp Page Layout

- Hero / camp info at top
- Tabs or sections: **Discussions** (camp-level) | **Claims** (list with counts, click to claim page)
- Or: single list with labels (Camp vs claim name) + filters

---

## 9. Profile Pictures

- **Member profile:** Option to add a profile picture (upload → Vercel Blob)
- **Discussion posts:** Show author avatar next to name + LDMA Member badge
- **Default:** Pickaxe icon when no profile picture
- Store avatar URL on `community_members` or in member profile (Salesforce field or separate UGC table)

---

## 10. Post/Report Images in Preview Cards

- When a post has one or more photos (Vercel Blob), use the **first/primary image** as the preview thumbnail on discussion list cards
- If no images, keep current card layout (no image or placeholder)
- Improves scannability and makes image-heavy posts stand out

---

## 11. UI Polish

- Sticky sort/filter bar on scroll
- Clear “Camp” vs “Claim” labels on cards
- Breadcrumbs: `Directory > Stanton > Rich Hill > [Discussion]`
- Mobile: collapsible claims list, consider bottom nav for Directory / Profile

---

## 12. Phasing

| Phase | Scope |
|-------|--------|
| **Now** | Add sort (most recent, most liked, most engagement) + pagination on camp pages |
| **Done** | Claims: schema, Stanton seed (Little Picker South + Stanton Group), `/directory/[camp]/c/[claim-slug]` |
| **Soon** | Profile pictures (upload on member profile, pickaxe default, show on posts) |
| **Soon** | Post images in preview cards (first/primary image on discussion list) |
| **Done** | Daily comment digest (opt-in, 8pm Pacific, profile toggle) — see `COMMENT_DIGEST_SETUP.md` |
| **Later** | Search, optional global activity feed |
| **Later** | Gamification / badges (see below) |

---

## 13. Gamification & Badges (Future)

Themed badges for engagement. Mining, prospecting, and camping imagery.

### Early / Rising Contributors

| Badge | Criteria | Theme |
|-------|----------|-------|
| **Greenhorn** | First post | New miner |
| **Dust in the Pan** | 5 posts or replies | Getting started |
| **Rising Prospector** | 25 posts/replies, &lt; 6 months | Building reputation |
| **Paydirt** | 50+ posts/replies OR first discussion with 10+ likes | Finding traction |

### Steady Engagement

| Badge | Criteria | Theme |
|-------|----------|-------|
| **Seasoned Camper** | Active 6+ months, regular posts | Long-term member |
| **Claim Jumper** | Posted in 3+ different camps/claims | Well-traveled |
| **Sl bleeding Season** | 10+ posts in one camp in a year | Camp regular |

### High Impact

| Badge | Criteria | Theme |
|-------|----------|-------|
| **Mother Lode** | Discussion with 25+ thumbs up | Viral / highly valued post |
| **Assay Master** | 5+ discussions with 10+ thumbs up each | Consistently valuable content |
| **Stamp Mill** | 100+ total thumbs up on their content | High cumulative impact |

### Helpful / Community

| Badge | Criteria | Theme |
|-------|----------|-------|
| **Trail Guide** | 20+ replies to others’ posts | Helpful commenter |
| **Campfire Keeper** | Started discussion that sparked 20+ replies | Conversation starter |
| **Creek Cleaner** | Reported issue / helped moderate (if applicable) | Community steward |

### Milestones

| Badge | Criteria | Theme |
|-------|----------|-------|
| **First Nugget** | First thumbs up received | First recognition |
| **Full Poke** | 100 posts/replies total | Dedicated contributor |
| **Legacy Claim** | 2+ years active | Veteran |

### Implementation

- **Storage:** `member_badges` table (member_id, badge_id, earned_at) or JSON column on `community_members`
- **Computation:** Background job or on-demand when posts/comments/reactions change. Query counts and thresholds to assign badges
- **Display:** 1–2 badges next to avatar on posts; full list on profile. Tooltip for badge description
- **Low-hanging fruit first:** Greenhorn (first post), Paydirt (10+ likes on a post), Trail Guide (20+ replies) — simple logic, high impact

---

## Related Docs

- `DIRECTORY_COMMUNITY_SETUP.md` — Database setup, env vars, migrations
