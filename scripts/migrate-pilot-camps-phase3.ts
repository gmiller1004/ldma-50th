/**
 * Phase 3: Burnt River & Vein Mountain — seed master sites, remap reservations, backfill billing periods.
 *
 *   npm run db:migrate:pilot-camps              # dry-run
 *   npm run db:migrate:pilot-camps -- --execute
 *   npm run db:migrate:pilot-camps -- --execute --prune-old-sites
 */
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import pg from "pg";
import { formatSiteDisplayName } from "../lib/camp-master";
import { pilotSiteNameToCode, PILOT_REMAP_CAMP_SLUGS } from "../lib/pilot-site-remap";
import { buildBillingPeriodBackfill } from "../lib/backfill-billing-periods";

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const MASTER_CSV = join(__dirname, "..", "data/camp-reservations/camp-site-master.csv");

const connectionString =
  process.env.STORAGE_DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL;

type SiteRow = {
  id: string;
  name: string;
  site_code: string | null;
  member_rate_daily: string | number | null;
  member_rate_monthly: string | number | null;
  non_member_rate_daily: string | number | null;
};

function parseArgs(argv: string[]) {
  return {
    execute: argv.includes("--execute"),
    pruneOldSites: argv.includes("--prune-old-sites"),
    skipSeed: argv.includes("--skip-seed"),
    camp: argv.find((a) => a.startsWith("--camp="))?.slice("--camp=".length).trim() ?? null,
  };
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (c === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

function loadMasterRows(campSlugs: string[]) {
  if (!existsSync(MASTER_CSV)) throw new Error(`Missing ${MASTER_CSV}`);
  const lines = readFileSync(MASTER_CSV, "utf8").split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0]);
  const idx = Object.fromEntries(headers.map((h, i) => [h.trim(), i]));
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, j) => {
      row[h.trim()] = (parts[j] || "").trim();
    });
    if (campSlugs.includes(row.camp_slug)) rows.push(row);
  }
  return rows;
}

async function seedMasterSites(client: pg.Client, campSlugs: string[]) {
  const rows = loadMasterRows(campSlugs);
  console.log(`Seeding ${rows.length} master sites for ${campSlugs.join(", ")}`);
  for (const row of rows) {
    const name = formatSiteDisplayName(
      row.site_code,
      row.site_type,
      row.special_type || null
    );
    await client.query(
      `INSERT INTO camp_sites (
         camp_slug, site_code, name, site_type, special_type, sort_order,
         member_rate_monthly, member_rate_daily, non_member_rate_daily
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (camp_slug, site_code) WHERE site_code IS NOT NULL DO UPDATE SET
         name = EXCLUDED.name,
         site_type = EXCLUDED.site_type,
         special_type = EXCLUDED.special_type,
         sort_order = EXCLUDED.sort_order,
         member_rate_monthly = EXCLUDED.member_rate_monthly,
         member_rate_daily = EXCLUDED.member_rate_daily,
         non_member_rate_daily = EXCLUDED.non_member_rate_daily,
         updated_at = NOW()`,
      [
        row.camp_slug,
        row.site_code,
        name,
        row.site_type || "rv",
        row.special_type || null,
        parseInt(row.sort_order, 10) || 0,
        row.member_rate_monthly ? parseFloat(row.member_rate_monthly) : null,
        row.member_rate_daily ? parseFloat(row.member_rate_daily) : null,
        row.non_member_rate_daily ? parseFloat(row.non_member_rate_daily) : null,
      ]
    );
  }
}

async function loadSites(client: pg.Client, campSlug: string): Promise<SiteRow[]> {
  const res = await client.query(
    `SELECT id, name, site_code, member_rate_daily, member_rate_monthly, non_member_rate_daily
     FROM camp_sites WHERE camp_slug = $1`,
    [campSlug]
  );
  return res.rows as SiteRow[];
}

function num(v: string | number | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isNaN(n) ? null : n;
}

async function run() {
  const { execute, pruneOldSites, skipSeed, camp: campFilter } = parseArgs(process.argv.slice(2));
  const camps = PILOT_REMAP_CAMP_SLUGS.filter((c) => !campFilter || c === campFilter);

  if (!connectionString) {
    console.error("Error: DATABASE_URL not set.");
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();

  console.log(execute ? "EXECUTE Phase 3 migration" : "DRY RUN Phase 3 (pass --execute to apply)");

  const report = {
    sitesSeeded: 0,
    reservationsRemapped: 0,
    reservationsUnmapped: 0,
    billingPeriodsBackfilled: 0,
    oldSitesPruned: 0,
    issues: [] as string[],
  };

  if (!skipSeed) {
    if (execute) {
      await seedMasterSites(client, [...camps]);
    }
    report.sitesSeeded = loadMasterRows([...camps]).length;
    console.log(`\nMaster sites: ${report.sitesSeeded} rows for ${camps.join(", ")}`);
  }

  for (const campSlug of camps) {
    console.log(`\n=== ${campSlug} ===`);
    const sites = await loadSites(client, campSlug);
    const withCode = sites.filter((s) => s.site_code);
    const withoutCode = sites.filter((s) => !s.site_code);
    const codeToNewId = new Map(withCode.map((s) => [s.site_code!, s.id]));

    console.log(`Sites: ${withCode.length} with site_code, ${withoutCode.length} legacy (no site_code)`);

    const remapPlan: { oldId: string; oldName: string; siteCode: string; newId: string }[] = [];
    for (const old of withoutCode) {
      const siteCode = pilotSiteNameToCode(campSlug, old.name);
      if (!siteCode) {
        report.issues.push(`${campSlug}: unmapped legacy site "${old.name}"`);
        continue;
      }
      const newId = codeToNewId.get(siteCode);
      if (!newId) {
        report.issues.push(`${campSlug}: site_code ${siteCode} (${old.name}) not in master seed`);
        continue;
      }
      remapPlan.push({ oldId: old.id, oldName: old.name, siteCode, newId });
    }

    console.log(`Remap plan: ${remapPlan.length} legacy → master`);
    for (const r of remapPlan) {
      console.log(`  ${r.oldName} → ${r.siteCode}`);
    }

    if (execute && remapPlan.length > 0) {
      for (const r of remapPlan) {
        const updated = await client.query(
          `UPDATE camp_reservations SET site_id = $1, updated_at = NOW()
           WHERE site_id = $2 AND camp_slug = $3
           RETURNING id`,
          [r.newId, r.oldId, campSlug]
        );
        const count = updated.rowCount ?? 0;
        if (count > 0) {
          console.log(`  ↳ remapped ${count} reservation(s) from ${r.oldName}`);
          report.reservationsRemapped += count;
        }
      }
    } else if (remapPlan.length > 0) {
      for (const r of remapPlan) {
        const pending = await client.query(
          `SELECT COUNT(*)::int AS n FROM camp_reservations WHERE site_id = $1 AND camp_slug = $2`,
          [r.oldId, campSlug]
        );
        const count = pending.rows[0]?.n ?? 0;
        if (count > 0) {
          console.log(`  → would remap ${count} reservation(s) from ${r.oldName}`);
          report.reservationsRemapped += count;
        }
      }
    }

    const resv = await client.query(
      `SELECT r.id, r.site_id, r.check_in_date::text, r.check_out_date::text, r.reservation_type,
              r.import_source, r.status, s.name AS site_name, s.site_code
       FROM camp_reservations r
       JOIN camp_sites s ON s.id = r.site_id
       WHERE r.camp_slug = $1`,
      [campSlug]
    );

    for (const row of resv.rows) {
      const onLegacy = !row.site_code;
      if (!onLegacy) continue;
      if (row.status === "cancelled") continue;

      console.log(`  ✗ Res ${row.id.slice(0, 8)}… UNMAPPED site ${row.site_name}`);
      report.reservationsUnmapped++;
      report.issues.push(`${campSlug}: reservation ${row.id} on unmapped site ${row.site_name}`);
    }

    // Backfill billing periods
    const needsBackfill = await client.query(
      `SELECT r.id, r.check_in_date::text, r.check_out_date::text, r.reservation_type, r.import_source,
              s.member_rate_daily, s.member_rate_monthly, s.non_member_rate_daily
       FROM camp_reservations r
       JOIN camp_sites s ON s.id = r.site_id
       WHERE r.camp_slug = $1 AND r.status != 'cancelled'
         AND r.import_source IS DISTINCT FROM 'resnexus'
         AND NOT EXISTS (SELECT 1 FROM camp_billing_periods bp WHERE bp.reservation_id = r.id)`,
      [campSlug]
    );

    console.log(`\nBilling backfill candidates: ${needsBackfill.rows.length}`);

    for (const row of needsBackfill.rows) {
      const payRes = await client.query(
        `SELECT COALESCE(SUM(amount_cents), 0)::int AS total FROM camp_payments
         WHERE reservation_id = $1 AND payment_type = 'reservation'`,
        [row.id]
      );
      const totalPaid = payRes.rows[0]?.total ?? 0;
      const isMember = row.reservation_type === "member";
      const periods = buildBillingPeriodBackfill({
        checkInDate: row.check_in_date,
        checkOutDate: row.check_out_date,
        isMember,
        rates: {
          memberRateDaily: num(row.member_rate_daily),
          memberRateMonthly: num(row.member_rate_monthly),
          nonMemberRateDaily: num(row.non_member_rate_daily),
        },
        totalPaidCents: totalPaid,
      });

      const due = periods.reduce((s, p) => s + p.amountDueCents, 0);
      const paid = periods.reduce((s, p) => s + p.amountPaidCents, 0);
      console.log(
        `  ${execute ? "→" : "·"} Res ${row.id.slice(0, 8)}… ${periods.length} period(s) $${(paid / 100).toFixed(2)}/$${(due / 100).toFixed(2)}`
      );

      if (execute) {
        for (const p of periods) {
          await client.query(
            `INSERT INTO camp_billing_periods (
               reservation_id, period_index, period_start, period_end, nights,
               amount_due_cents, amount_paid_cents, due_date, status, pricing_basis
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
             ON CONFLICT (reservation_id, period_start) DO UPDATE SET
               amount_due_cents = EXCLUDED.amount_due_cents,
               amount_paid_cents = EXCLUDED.amount_paid_cents,
               status = EXCLUDED.status,
               updated_at = NOW()`,
            [
              row.id,
              p.periodIndex,
              p.periodStart,
              p.periodEnd,
              p.nights,
              p.amountDueCents,
              p.amountPaidCents,
              p.periodStart,
              p.status,
              p.pricingBasis,
            ]
          );
        }
      }
      report.billingPeriodsBackfilled++;
    }

    if (pruneOldSites && execute) {
      for (const old of withoutCode) {
        const stillUsed = await client.query(
          `SELECT 1 FROM camp_reservations
           WHERE site_id = $1 AND status != 'cancelled'
           LIMIT 1`,
          [old.id]
        );
        if (stillUsed.rows.length > 0) {
          report.issues.push(`${campSlug}: cannot prune ${old.name} — active reservation still references it`);
          continue;
        }
        await client.query(`DELETE FROM camp_sites WHERE id = $1`, [old.id]);
        console.log(`  🗑 Pruned legacy site ${old.name}`);
        report.oldSitesPruned++;
      }
    }
  }

  await client.end();

  console.log("\n=== Summary ===");
  console.log(report);
  if (report.issues.length) {
    console.log("\nIssues to review:");
    for (const i of report.issues) console.log("  -", i);
  }
  if (!execute) {
    console.log("\nNo changes written. Run with --execute to apply.");
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
