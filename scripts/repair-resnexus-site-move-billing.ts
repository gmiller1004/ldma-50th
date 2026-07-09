/**
 * Repair reservations after a site move wiped ResNexus import credits.
 * Restores payment ledger rows, fixes member/guest classification, and re-syncs billing.
 *
 *   npx tsx scripts/repair-resnexus-site-move-billing.ts --res=37582,37568
 *   npx tsx scripts/repair-resnexus-site-move-billing.ts --execute --res=37582,37568
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
import { resyncReservationBillingFromDb } from "../lib/reservation-billing";

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data", "camp-reservations");
const IMPORT_SOURCE = "resnexus";
const CREATED_BY = "resnexus-import-repair";

const connectionString =
  process.env.STORAGE_DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL;

function parseArgs(argv: string[]) {
  const execute = argv.includes("--execute");
  let resNumbers: string[] = [];
  for (const arg of argv) {
    if (arg.startsWith("--res=")) {
      resNumbers = arg
        .slice("--res=".length)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return { execute, resNumbers };
}

type SiteRow = {
  id: string;
  site_code: string;
  member_rate_daily: number | null;
  member_rate_monthly: number | null;
  non_member_rate_daily: number | null;
};

async function loadSiteRates(client: pg.Client, campSlug: string, siteId: string): Promise<SiteRow | null> {
  const res = await client.query(
    `SELECT id, site_code, member_rate_daily, member_rate_monthly, non_member_rate_daily
     FROM camp_sites WHERE id = $1 AND camp_slug = $2 LIMIT 1`,
    [siteId, campSlug]
  );
  return (res.rows[0] as SiteRow | undefined) ?? null;
}

async function ensurePaymentLedger(
  client: pg.Client,
  reservationId: string,
  campSlug: string,
  resNumber: string,
  guestName: string,
  paidTotalCents: number,
  execute: boolean
) {
  if (paidTotalCents <= 0) return 0;

  const existing = await client.query(
    `SELECT COALESCE(SUM(amount_cents) FILTER (WHERE payment_type = 'reservation'), 0)::int AS paid
     FROM camp_payments WHERE reservation_id = $1`,
    [reservationId]
  );
  const ledgerPaid = Number(existing.rows[0]?.paid ?? 0);
  if (ledgerPaid >= paidTotalCents) return 0;

  const amountCents = paidTotalCents - ledgerPaid;
  if (!execute) return amountCents;

  await client.query(
    `INSERT INTO camp_payments (
       camp_slug, payment_type, method, amount_cents, reservation_id,
       member_email, recipient_display_name, created_by_contact_id, created_at
     ) VALUES ($1, 'reservation', 'cash', $2, $3, $4, $5, $6, NOW())`,
    [
      campSlug,
      amountCents,
      reservationId,
      `resnexus+${resNumber}@import.ldma.org`,
      guestName || "Guest",
      CREATED_BY,
    ]
  );
  return amountCents;
}

async function run() {
  const { execute, resNumbers } = parseArgs(process.argv.slice(2));
  if (resNumbers.length === 0) {
    console.error("Usage: --res=37582,37568 [--execute]");
    process.exit(1);
  }
  if (!connectionString) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();

  console.log(execute ? "EXECUTE repair" : "DRY RUN (pass --execute to write)");

  for (const { campSlug, filename } of RESNEXUS_IMPORT_FILES) {
    const path = join(DATA_DIR, filename);
    if (!existsSync(path)) continue;

    const csv = readFileSync(path, "utf8");
    const allRows = parseResNexusCsv(csv);

    for (const resNumber of resNumbers) {
      const rows = allRows.filter((r) => r.resNumber === resNumber);
      if (rows.length === 0) continue;

      const dbRes = await client.query(
        `SELECT id, site_id, reservation_type, member_display_name,
                guest_first_name, guest_last_name, check_in_date, check_out_date
         FROM camp_reservations
         WHERE camp_slug = $1 AND external_res_number = $2 AND import_source = $3
         LIMIT 1`,
        [campSlug, resNumber, IMPORT_SOURCE]
      );
      if (dbRes.rows.length === 0) {
        console.log(`  ✗ Res#${resNumber} not found in ${campSlug}`);
        continue;
      }

      const reservation = dbRes.rows[0] as {
        id: string;
        site_id: string;
        reservation_type: string;
        member_display_name: string | null;
        guest_first_name: string | null;
        guest_last_name: string | null;
        check_in_date: string;
        check_out_date: string;
      };

      const site = await loadSiteRates(client, campSlug, reservation.site_id);
      if (!site) {
        console.log(`  ✗ Res#${resNumber} site not found`);
        continue;
      }

      const parsed = buildReservationFromRows(campSlug, resNumber, rows, {
        memberRateDaily: site.member_rate_daily != null ? Number(site.member_rate_daily) : 20,
        memberRateMonthly: site.member_rate_monthly != null ? Number(site.member_rate_monthly) : 540,
        nonMemberRateDaily:
          site.non_member_rate_daily != null ? Number(site.non_member_rate_daily) : 45,
      });
      if (!parsed) {
        console.log(`  ✗ Res#${resNumber} could not parse CSV`);
        continue;
      }

      const paidTotal = parsed.periods.reduce((s, p) => s + p.amountPaidCents, 0);
      const guestName =
        parsed.guestName ||
        [reservation.guest_first_name, reservation.guest_last_name].filter(Boolean).join(" ").trim() ||
        reservation.member_display_name ||
        "Guest";

      console.log(
        `\nRes#${resNumber} ${guestName} (${campSlug})` +
          `\n  type: ${reservation.reservation_type} → ${parsed.reservationType}` +
          `\n  ResNexus paid: $${(paidTotal / 100).toFixed(2)}` +
          `\n  site: ${site.site_code}`
      );

      if (execute) {
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

        const inserted = await ensurePaymentLedger(
          client,
          reservation.id,
          campSlug,
          resNumber,
          guestName,
          paidTotal,
          execute
        );
        if (inserted > 0) {
          console.log(`  → inserted camp_payment $${(inserted / 100).toFixed(2)}`);
        }

        const balance = await resyncReservationBillingFromDb(reservation.id);
        console.log(
          `  → balance after resync: due $${(balance.totalDueCents / 100).toFixed(2)}, ` +
            `paid $${(balance.totalPaidCents / 100).toFixed(2)}, ` +
            `owes $${(balance.balanceDueCents / 100).toFixed(2)}`
        );
      }
    }
  }

  await client.end();
  if (!execute) console.log("\nNo changes written. Run with --execute to repair.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
