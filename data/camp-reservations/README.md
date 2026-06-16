# Camp reservations data

Source files for the unified reservation system (replacing ResNexus). See **`docs/CAMP_RESERVATIONS_ROADMAP.md`** for the full plan.

## Site master

| File | Purpose |
|------|---------|
| `LDMA CAMP SITE MASTER - v01 2.xlsx` | Ops working copy (8 camps, 537 sites) |
| `camp-site-master.csv` | Generated for seeding (`npm run db:export:camp-site-master`) |

**Columns in CSV:** `camp_slug`, `camp_name`, `site_code`, `special_type`, `site_type`, `member_rate_monthly`, `member_rate_daily`, `non_member_rate_daily`, `sort_order`

## ResNexus future reservations (import in Phase 2)

| File | Camp |
|------|------|
| `stanton_stayed_on.csv` | Stanton |
| `Blue Bucket Future Reservations.csv` | Blue Bucket |
| `Loud Mine Future Reservations.csv` | Loud Mine |

## DB setup (Phase 1)

No `psql` required — use npm scripts with `.env.local` (Neon URL in `STORAGE_DATABASE_URL`, `POSTGRES_URL`, or `DATABASE_URL`).

```bash
# 1. Additive migrations (safe on production)
npm run db:migrate:camp-reservations-v2

# 2. Refresh site CSV from xlsx (local only)
npm run db:export:camp-site-master

# 3. Seed sites — production: exclude pilot camps until Phase 3 remap
npm run db:seed:camp-sites-master -- --exclude=burnt-river-oregon,vein-mountain-north-carolina

# 3. ResNexus import (after import migration)
npm run db:migrate:camp-reservations-import
npm run db:import:resnexus                    # dry-run
npm run db:import:resnexus -- --execute       # write to DB
npm run db:import:resnexus -- --execute --camp=stanton-arizona
```

## Phase 3 — Burnt River & Vein Mountain

```bash
npm run db:migrate:pilot-camps                    # dry-run report
npm run db:migrate:pilot-camps -- --execute       # seed BR/VM master sites, remap reservations, backfill billing
npm run db:migrate:pilot-camps -- --execute --prune-old-sites   # also delete unused legacy site rows
```

Pilot site name mapping: `lib/pilot-site-remap.ts` (e.g. VM `Lower 2` → `LC-02`, `Upper 1` → `UC-01`). Overrides in `pilot-site-remap.csv`.

## Pricing rules (v2)

- **Member ≤29 nights:** `member_daily × nights`
- **Member ≥30 nights:** `member_rate_monthly × (nights / 30)`
- **Guest (any length):** `non_member_daily × nights`
- **Billing:** rolling 30-day periods from check-in
