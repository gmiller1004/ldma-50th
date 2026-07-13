/**
 * Restore ResNexus billing periods, payment ledger, and amount locks after migration drift.
 *
 *   npm run db:repair:resnexus-import
 *   npm run db:repair:resnexus-import -- --execute
 *   npm run db:repair:resnexus-import -- --execute --camp=loud-mine-georgia
 *   npm run db:repair:resnexus-import -- --execute --res=13691
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
} from "../lib/resnexus-import";
import {
  ensureResNexusPaymentLedger,
  isResNexusBillingPaidInFull,
  lockResNexusBillingAmounts,
  readReservationBalance,
  resnexusBillingTotals,
  upsertResNexusBillingPeriods,
} from "../lib/resnexus-billing-repair";
import { applyReservationBalanceOverride } from "../lib/reservation-billing";
import { computeStayPricing } from "../lib/reservation-pricing";

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data", "camp-reservations");
const IMPORT_SOURCE = "resnexus";
const CREATED_BY = "resnexus-import-repair";

/** Reservations paid in ResNexus but missing from the CSV export (lookup by guest email). */
const PAID_IN_FULL_BY_EMAIL: {
  email: string;
  campSlug: string;
  reason: string;
  guestName?: string;
  resNumber?: string;
}[] = [
  {
    email: "grateful1semail@gmail.com",
    campSlug: "loud-mine-georgia",
    guestName: "Vivian Gillis",
    reason: "Paid in full in ResNexus prior to migration (Vivian Gillis)",
  },
  {
    email: "thatwineguy@gmail.com",
    campSlug: "loud-mine-georgia",
    guestName: "Joey Muller",
    resNumber: "13691",
    reason: "Paid in full in ResNexus prior to migration (Joey Muller)",
  },
];

const connectionString =
  process.env.STORAGE_DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL;

function parseArgs(argv: string[]) {
  const execute = argv.includes("--execute");
  let camp: string | null = null;
  let resNumbers: string[] = [];
  for (const arg of argv) {
    if (arg.startsWith("--camp=")) camp = arg.slice("--camp=".length).trim();
    if (arg.startsWith("--res=")) {
      resNumbers = arg
        .slice("--res=".length)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return { execute, camp, resNumbers };
}

type SiteRow = {
  id: string;
  site_code: string;
  member_rate_daily: number | null;
  member_rate_monthly: number | null;
  non_member_rate_daily: number | null;
};

async function loadSite(
  client: pg.Client,
  campSlug: string,
  siteId: string
): Promise<SiteRow | null> {
  const res = await client.query(
    `SELECT id, site_code, member_rate_daily, member_rate_monthly, non_member_rate_daily
     FROM camp_sites WHERE id = $1 AND camp_slug = $2 LIMIT 1`,
    [siteId, campSlug]
  );
  return (res.rows[0] as SiteRow | undefined) ?? null;
}

async function repairFromCsv(
  client: pg.Client,
  campSlug: string,
  resNumber: string,
  rows: ReturnType<typeof parseResNexusCsv>,
  execute: boolean
): Promise<void> {
  const dbRes = await client.query(
    `SELECT id, site_id, reservation_type, member_display_name,
            guest_first_name, guest_last_name
     FROM camp_reservations
     WHERE camp_slug = $1 AND external_res_number = $2 AND import_source = $3
     LIMIT 1`,
    [campSlug, resNumber, IMPORT_SOURCE]
  );
  if (dbRes.rows.length === 0) {
    console.log(`  ✗ Res#${resNumber} not found in ${campSlug}`);
    return;
  }

  const reservation = dbRes.rows[0] as {
    id: string;
    site_id: string;
    reservation_type: string;
    member_display_name: string | null;
    guest_first_name: string | null;
    guest_last_name: string | null;
  };

  const site = await loadSite(client, campSlug, reservation.site_id);
  if (!site) {
    console.log(`  ✗ Res#${resNumber} site not found`);
    return;
  }

  const parsed = buildReservationFromRows(campSlug, resNumber, rows, {
    memberRateDaily: site.member_rate_daily != null ? Number(site.member_rate_daily) : 20,
    memberRateMonthly: site.member_rate_monthly != null ? Number(site.member_rate_monthly) : 540,
    nonMemberRateDaily:
      site.non_member_rate_daily != null ? Number(site.non_member_rate_daily) : 45,
  });
  if (!parsed) {
    console.log(`  ✗ Res#${resNumber} could not parse CSV`);
    return;
  }

  const { totalDueCents, allocatedPaidCents } = resnexusBillingTotals(parsed);
  const before = await readReservationBalance(client, reservation.id);
  const guestName =
    parsed.guestName ||
    [reservation.guest_first_name, reservation.guest_last_name].filter(Boolean).join(" ").trim() ||
    reservation.member_display_name ||
    "Guest";

  console.log(
    `\nRes#${resNumber} ${guestName} (${campSlug})` +
      `\n  before: due $${(before.totalDueCents / 100).toFixed(2)}, ` +
      `paid $${(before.totalPaidCents / 100).toFixed(2)}, ` +
      `owes $${(before.balanceDueCents / 100).toFixed(2)}` +
      `\n  ResNexus CSV: due $${(totalDueCents / 100).toFixed(2)}, ` +
      `allocated paid $${(allocatedPaidCents / 100).toFixed(2)}`
  );

  if (!execute) return;

  const isMember = parsed.reservationType === "member";
  await client.query(
    `UPDATE camp_reservations SET
       reservation_type = $1,
       member_display_name = CASE WHEN $2 THEN $3 ELSE member_display_name END,
       guest_first_name = CASE WHEN $2 THEN NULL ELSE guest_first_name END,
       guest_last_name = CASE WHEN $2 THEN NULL ELSE guest_last_name END,
       needs_review = $4,
       updated_at = NOW()
     WHERE id = $5`,
    [parsed.reservationType, isMember, guestName, parsed.needsReview, reservation.id]
  );

  await upsertResNexusBillingPeriods(client, reservation.id, parsed);

  const inserted = await ensureResNexusPaymentLedger(
    client,
    reservation.id,
    campSlug,
    parsed,
    rows,
    CREATED_BY
  );
  if (inserted > 0) {
    console.log(`  → inserted camp_payment $${(inserted / 100).toFixed(2)}`);
  }

  const calculatedTotalCents = computeStayPricing({
    checkInDate: parsed.checkInDate,
    checkOutDate: parsed.checkOutDate,
    isMember,
    rates: {
      memberRateDaily: site.member_rate_daily != null ? Number(site.member_rate_daily) : null,
      memberRateMonthly: site.member_rate_monthly != null ? Number(site.member_rate_monthly) : null,
      nonMemberRateDaily:
        site.non_member_rate_daily != null ? Number(site.non_member_rate_daily) : null,
    },
  }).totalCents;

  await lockResNexusBillingAmounts(
    client,
    reservation.id,
    totalDueCents,
    calculatedTotalCents
  );

  let after = await readReservationBalance(client, reservation.id);
  if (after.balanceDueCents > 0 && isResNexusBillingPaidInFull(parsed)) {
    after = await applyReservationBalanceOverride({
      reservationId: reservation.id,
      balanceDueCents: 0,
      overrideReason: `Paid in full in ResNexus prior to migration (Res#${resNumber})`,
    });
    console.log("  → applied paid-in-full balance override");
  }

  console.log(
    `  → after: due $${(after.totalDueCents / 100).toFixed(2)}, ` +
      `paid $${(after.totalPaidCents / 100).toFixed(2)}, ` +
      `owes $${(after.balanceDueCents / 100).toFixed(2)}`
  );
}

async function repairPaidInFullByEmail(
  client: pg.Client,
  item: (typeof PAID_IN_FULL_BY_EMAIL)[number],
  execute: boolean
): Promise<void> {
  const namePattern = item.guestName ? `%${item.guestName.toLowerCase()}%` : null;
  const res = await client.query(
    `SELECT r.id, r.guest_email, r.member_display_name, r.guest_first_name, r.guest_last_name
     FROM camp_reservations r
     WHERE r.camp_slug = $1
       AND r.status != 'cancelled'
       AND (
         LOWER(TRIM(COALESCE(r.guest_email, ''))) = LOWER($2)
         OR ($3::text IS NOT NULL AND LOWER(COALESCE(r.member_display_name, '')) LIKE $3)
         OR ($3::text IS NOT NULL AND LOWER(TRIM(COALESCE(r.guest_first_name, '') || ' ' || COALESCE(r.guest_last_name, ''))) LIKE $3)
         OR ($4::text IS NOT NULL AND r.external_res_number = $4)
       )
     ORDER BY r.created_at DESC
     LIMIT 1`,
    [item.campSlug, item.email, namePattern, item.resNumber ?? null]
  );
  if (res.rows.length === 0) {
    console.log(`  ✗ No reservation for ${item.email} at ${item.campSlug}`);
    return;
  }

  const row = res.rows[0] as {
    id: string;
    guest_email: string | null;
    member_display_name: string | null;
    guest_first_name: string | null;
    guest_last_name: string | null;
  };
  const name =
    row.member_display_name?.trim() ||
    [row.guest_first_name, row.guest_last_name].filter(Boolean).join(" ").trim() ||
    item.email;
  const before = await readReservationBalance(client, row.id);

  console.log(
    `\n${name} (${item.email})` +
      `\n  before: owes $${(before.balanceDueCents / 100).toFixed(2)}`
  );
  if (before.balanceDueCents < 1) {
    console.log("  · already paid in full");
    return;
  }
  if (!execute) return;

  const ledger = await client.query(
    `SELECT COALESCE(SUM(amount_cents) FILTER (WHERE payment_type = 'reservation'), 0)::int AS paid
     FROM camp_payments WHERE reservation_id = $1`,
    [row.id]
  );
  const ledgerPaid = Number(ledger.rows[0]?.paid ?? 0);
  if (ledgerPaid < before.totalDueCents) {
    const amountCents = before.totalDueCents - ledgerPaid;
    await client.query(
      `INSERT INTO camp_payments (
         camp_slug, payment_type, method, amount_cents, reservation_id,
         member_email, recipient_display_name, created_by_contact_id, created_at
       ) VALUES ($1, 'reservation', 'cash', $2, $3, $4, $5, $6, NOW())`,
      [item.campSlug, amountCents, row.id, item.email, name, CREATED_BY]
    );
    console.log(`  → inserted camp_payment $${(amountCents / 100).toFixed(2)}`);
  }

  const after = await applyReservationBalanceOverride({
    reservationId: row.id,
    balanceDueCents: 0,
    overrideReason: item.reason,
  });
  console.log(
    `  → after: due $${(after.totalDueCents / 100).toFixed(2)}, ` +
      `paid $${(after.totalPaidCents / 100).toFixed(2)}, ` +
      `owes $${(after.balanceDueCents / 100).toFixed(2)}`
  );
}

async function run() {
  const { execute, camp: campFilter, resNumbers } = parseArgs(process.argv.slice(2));
  if (!connectionString) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();

  console.log(execute ? "EXECUTE ResNexus billing repair" : "DRY RUN (pass --execute to write)");

  const files = RESNEXUS_IMPORT_FILES.filter((f) => !campFilter || f.campSlug === campFilter);
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

    const targets =
      resNumbers.length > 0 ? resNumbers : [...byRes.keys()];

    console.log(`\n${campSlug} — ${filename} — ${targets.length} reservation(s)`);
    for (const resNumber of targets) {
      const rows = byRes.get(resNumber);
      if (!rows?.length) {
        console.log(`  ✗ Res#${resNumber} not in CSV`);
        continue;
      }
      await repairFromCsv(client, campSlug, resNumber, rows, execute);
    }
  }

  const emailTargets = PAID_IN_FULL_BY_EMAIL.filter((e) => !campFilter || e.campSlug === campFilter);
  if (emailTargets.length > 0) {
    console.log("\nPaid-in-full by email (not in CSV export):");
    for (const item of emailTargets) {
      await repairPaidInFullByEmail(client, item, execute);
    }
  }

  await client.end();
  if (!execute) console.log("\nNo changes written. Run with --execute to repair.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
