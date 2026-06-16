/**
 * Import ResNexus future-reservation CSVs into camp_reservations + camp_billing_periods.
 *
 *   npm run db:migrate:camp-reservations-import
 *   npm run db:import:resnexus              # dry-run (default)
 *   npm run db:import:resnexus -- --execute
 *   npm run db:import:resnexus -- --execute --camp=stanton-arizona
 */
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import pg from "pg";
import {
  RESNEXUS_IMPORT_FILES,
  parseResNexusCsv,
  buildReservationFromRows,
  extractSiteCode,
  type ParsedReservation,
} from "../lib/resnexus-import";

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data", "camp-reservations");
const MASTER_CSV = join(DATA_DIR, "camp-site-master.csv");
const IMPORT_SOURCE = "resnexus";
const CREATED_BY = "resnexus-import";

const connectionString =
  process.env.STORAGE_DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL;

function parseArgs(argv: string[]) {
  const execute = argv.includes("--execute");
  let camp: string | null = null;
  for (const arg of argv) {
    if (arg.startsWith("--camp=")) camp = arg.slice("--camp=".length).trim();
  }
  return { execute, camp };
}

type SiteRow = {
  id?: string;
  member_rate_daily: number | null;
  member_rate_monthly: number | null;
  non_member_rate_daily: number | null;
};

function loadSiteRatesFromMasterCsv(): Map<string, SiteRow> {
  const map = new Map<string, SiteRow>();
  if (!existsSync(MASTER_CSV)) return map;
  const lines = readFileSync(MASTER_CSV, "utf8").split(/\r?\n/).filter(Boolean);
  const headers = lines[0].split(",");
  const idx = Object.fromEntries(headers.map((h, i) => [h.trim(), i]));
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    const campSlug = parts[idx.camp_slug]?.trim();
    const siteCode = parts[idx.site_code]?.trim();
    if (!campSlug || !siteCode) continue;
    map.set(`${campSlug}:${siteCode}`, {
      member_rate_daily: parseFloat(parts[idx.member_rate_daily]) || null,
      member_rate_monthly: parseFloat(parts[idx.member_rate_monthly]) || null,
      non_member_rate_daily: parseFloat(parts[idx.non_member_rate_daily]) || null,
    });
  }
  return map;
}

function pricingBasisForPeriod(isMember: boolean, nights: number) {
  if (!isMember) return "guest_daily";
  return nights >= 30 ? "member_monthly_prorated" : "member_daily";
}

async function loadSiteMapFromDb(client: pg.Client, campSlug: string) {
  const res = await client.query(
    `SELECT id, site_code, member_rate_daily, member_rate_monthly, non_member_rate_daily
     FROM camp_sites WHERE camp_slug = $1 AND site_code IS NOT NULL`,
    [campSlug]
  );
  const map = new Map<string, SiteRow & { id: string }>();
  for (const row of res.rows) {
    map.set(String(row.site_code), row);
  }
  return map;
}

function getRatesForSite(
  siteMap: Map<string, SiteRow & { id?: string }>,
  campSlug: string,
  siteCode: string,
  masterFallback: Map<string, SiteRow>
) {
  const siteRow = siteMap.get(siteCode);
  const fallback = masterFallback.get(`${campSlug}:${siteCode}`);
  const src = siteRow || fallback;
  return {
    memberRateDaily: src?.member_rate_daily != null ? Number(src.member_rate_daily) : 20,
    memberRateMonthly: src?.member_rate_monthly != null ? Number(src.member_rate_monthly) : 540,
    nonMemberRateDaily: src?.non_member_rate_daily != null ? Number(src.non_member_rate_daily) : 45,
    siteId: siteRow?.id ?? null,
  };
}

async function upsertReservation(client: pg.Client, parsed: ParsedReservation, siteId: string) {
  const isMember = parsed.reservationType === "member";
  const displayName = parsed.guestName;

  const existing = await client.query(
    `SELECT id FROM camp_reservations
     WHERE camp_slug = $1 AND external_res_number = $2 AND import_source = $3
     LIMIT 1`,
    [parsed.campSlug, parsed.resNumber, IMPORT_SOURCE]
  );

  let reservationId: string;
  const status = "reserved";

  if (existing.rows.length > 0) {
    reservationId = existing.rows[0].id;
    await client.query(
      `UPDATE camp_reservations SET
         site_id = $1, check_in_date = $2, check_out_date = $3, nights = $4,
         reservation_type = $5, member_display_name = $6,
         guest_first_name = $7, guest_last_name = $8,
         needs_review = $9, status = $10, updated_at = NOW()
       WHERE id = $11`,
      [
        siteId,
        parsed.checkInDate,
        parsed.checkOutDate,
        parsed.nights,
        parsed.reservationType,
        isMember ? displayName : null,
        isMember ? null : parsed.guestFirstName,
        isMember ? null : parsed.guestLastName,
        parsed.needsReview,
        status,
        reservationId,
      ]
    );
  } else {
    const inserted = await client.query(
      `INSERT INTO camp_reservations (
         site_id, camp_slug, check_in_date, check_out_date, nights,
         reservation_type, member_display_name,
         guest_first_name, guest_last_name,
         status, created_by_contact_id, external_res_number, import_source, needs_review
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING id`,
      [
        siteId,
        parsed.campSlug,
        parsed.checkInDate,
        parsed.checkOutDate,
        parsed.nights,
        parsed.reservationType,
        isMember ? displayName : null,
        isMember ? null : parsed.guestFirstName,
        isMember ? null : parsed.guestLastName,
        status,
        CREATED_BY,
        parsed.resNumber,
        IMPORT_SOURCE,
        parsed.needsReview,
      ]
    );
    reservationId = inserted.rows[0].id;
  }

  return reservationId;
}

async function upsertBillingPeriods(client: pg.Client, reservationId: string, parsed: ParsedReservation) {
  const isMember = parsed.reservationType === "member";
  for (let i = 0; i < parsed.periods.length; i++) {
    const p = parsed.periods[i];
    const basis = pricingBasisForPeriod(isMember, p.nights);
    await client.query(
      `INSERT INTO camp_billing_periods (
         reservation_id, period_index, period_start, period_end, nights,
         amount_due_cents, amount_paid_cents, due_date, status, pricing_basis
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (reservation_id, period_start) DO UPDATE SET
         period_index = EXCLUDED.period_index,
         period_end = EXCLUDED.period_end,
         nights = EXCLUDED.nights,
         amount_due_cents = EXCLUDED.amount_due_cents,
         amount_paid_cents = EXCLUDED.amount_paid_cents,
         due_date = EXCLUDED.due_date,
         status = EXCLUDED.status,
         pricing_basis = EXCLUDED.pricing_basis,
         updated_at = NOW()`,
      [
        reservationId,
        i,
        p.periodStart,
        p.periodEnd,
        p.nights,
        p.amountDueCents,
        p.amountPaidCents,
        p.periodStart,
        p.status,
        basis,
      ]
    );
  }
}

async function run() {
  const { execute, camp: campFilter } = parseArgs(process.argv.slice(2));

  if (!connectionString && execute) {
    console.error("Error: DATABASE_URL not set.");
    process.exit(1);
  }

  const files = RESNEXUS_IMPORT_FILES.filter((f) => !campFilter || f.campSlug === campFilter);
  if (files.length === 0) {
    console.error("No import files for camp:", campFilter);
    process.exit(1);
  }

  const masterFallback = loadSiteRatesFromMasterCsv();
  const client = execute && connectionString ? new Client({ connectionString }) : null;
  if (client) await client.connect();

  const summary = {
    reservations: 0,
    periods: 0,
    skipped: 0,
    needsReview: 0,
  };

  console.log(execute ? "EXECUTE import" : "DRY RUN (pass --execute to write)");

  for (const { campSlug, filename } of files) {
    const path = join(DATA_DIR, filename);
    if (!existsSync(path)) {
      console.error("Missing file:", path);
      continue;
    }

    const csv = readFileSync(path, "utf8");
    const allRows = parseResNexusCsv(csv);
    const byRes = new Map<string, typeof allRows>();
    for (const row of allRows) {
      if (!byRes.has(row.resNumber)) byRes.set(row.resNumber, []);
      byRes.get(row.resNumber)!.push(row);
    }

    const siteMap = client ? await loadSiteMapFromDb(client, campSlug) : new Map();

    console.log(`\n${campSlug} — ${filename} — ${byRes.size} reservations`);

    for (const [resNumber, rows] of byRes.entries()) {
      const siteCode = extractSiteCode(rows[0].site);
      if (!siteCode) {
        summary.skipped++;
        console.log(`  ✗ Res#${resNumber} — site not parsed: ${rows[0].site}`);
        continue;
      }

      const { memberRateDaily, memberRateMonthly, nonMemberRateDaily, siteId } = getRatesForSite(
        siteMap,
        campSlug,
        siteCode,
        masterFallback
      );

      if (execute && !siteId) {
        summary.skipped++;
        console.log(`  ✗ Res#${resNumber} — site_code ${siteCode} not in DB`);
        continue;
      }

      if (!execute && !siteMap.has(siteCode) && !masterFallback.has(`${campSlug}:${siteCode}`)) {
        summary.skipped++;
        console.log(`  ✗ Res#${resNumber} — site_code ${siteCode} not in master CSV`);
        continue;
      }

      const parsed = buildReservationFromRows(campSlug, resNumber, rows, {
        memberRateDaily,
        memberRateMonthly,
        nonMemberRateDaily,
      });

      if (!parsed) {
        summary.skipped++;
        console.log(`  ✗ Res#${resNumber} — no parseable periods`);
        continue;
      }

      if (parsed.needsReview) summary.needsReview++;

      const paidTotal = parsed.periods.reduce((s, p) => s + p.amountPaidCents, 0);
      const dueTotal = parsed.periods.reduce((s, p) => s + p.amountDueCents, 0);
      const warn = parsed.warnings.length ? ` [${parsed.warnings.join("; ")}]` : "";
      const review = parsed.needsReview ? " (needs review)" : "";

      console.log(
        `  ${execute ? "→" : "·"} Res#${resNumber} ${parsed.guestName} site ${siteCode} ` +
          `${parsed.checkInDate}–${parsed.checkOutDate} ${parsed.periods.length} periods ` +
          `${parsed.reservationType} $${(paidTotal / 100).toFixed(2)}/$${(dueTotal / 100).toFixed(2)} paid` +
          review +
          warn
      );

      if (execute && siteId && client) {
        const reservationId = await upsertReservation(client, parsed, siteId);
        await upsertBillingPeriods(client, reservationId, parsed);
      }

      summary.reservations++;
      summary.periods += parsed.periods.length;
    }
  }

  if (client) await client.end();

  console.log("\nSummary:", summary);
  if (!execute) {
    console.log("\nNo changes written. Run with --execute to import.");
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
