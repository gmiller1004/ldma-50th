/**
 * Lock existing Stanton reservations at their current totals before a rate-card update.
 * Sets price_override_flag so later billing syncs do not reprice from new camp_sites rates.
 *
 * Skips cancelled reservations and reservations that already have price_override_flag.
 *
 *   npm run db:lock:stanton-rates
 *   npm run db:lock:stanton-rates -- --execute
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const CAMP_SLUG = "stanton-arizona";
const OVERRIDE_REASON = "Rate lock — pre-Stanton v02 price update";

function loadEnvLocal() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const envPath = join(root, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

async function run() {
  loadEnvLocal();

  const {
    syncBillingPeriodsForReservation,
    siteRatesFromRow,
  } = await import("../lib/reservation-billing.ts");
  const { toDateOnlyStr } = await import("../lib/reservation-dates.ts");

  const url =
    process.env.STORAGE_DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL;
  if (!url) {
    console.error("No database URL");
    process.exit(1);
  }

  const execute = process.argv.includes("--execute");
  const client = new pg.Client({ connectionString: url });
  await client.connect();

  const { rows } = await client.query(
    `SELECT r.id, r.invoice_number, r.status, r.reservation_type,
            r.check_in_date, r.check_out_date,
            r.calculated_total_cents, r.amount_override_cents, r.price_override_flag,
            r.override_reason, r.member_display_name, r.guest_first_name, r.guest_last_name,
            s.member_rate_daily, s.member_rate_monthly, s.non_member_rate_daily,
            s.name AS site_name,
            COALESCE((
              SELECT SUM(bp.amount_due_cents)::int
              FROM camp_billing_periods bp
              WHERE bp.reservation_id = r.id AND bp.status != 'cancelled'
            ), r.calculated_total_cents, 0) AS current_total_cents
     FROM camp_reservations r
     JOIN camp_sites s ON s.id = r.site_id
     WHERE r.camp_slug = $1
       AND r.status != 'cancelled'
     ORDER BY r.invoice_number NULLS LAST, r.created_at`,
    [CAMP_SLUG]
  );

  console.log(execute ? "EXECUTE Stanton rate locks" : "DRY RUN (pass --execute to write)");
  console.log(`Found ${rows.length} non-cancelled Stanton reservations\n`);

  let lockCount = 0;
  let skipAlreadyLocked = 0;
  let skipZero = 0;

  for (const row of rows) {
    const name =
      row.member_display_name ||
      [row.guest_first_name, row.guest_last_name].filter(Boolean).join(" ").trim() ||
      "Guest";
    const invoice = row.invoice_number || row.id;
    const currentTotal = Number(row.current_total_cents) || 0;

    if (row.price_override_flag) {
      skipAlreadyLocked++;
      console.log(
        `  · skip ${invoice} ${name} (already locked @ $${((row.amount_override_cents ?? 0) / 100).toFixed(2)} — ${row.override_reason || "override"})`
      );
      continue;
    }

    if (currentTotal < 0) {
      skipZero++;
      console.log(`  · skip ${invoice} ${name} (invalid total ${currentTotal})`);
      continue;
    }

    lockCount++;
    console.log(
      `  ✓ lock ${invoice} ${name} @ $${(currentTotal / 100).toFixed(2)} (${row.site_name})`
    );

    if (execute) {
      await client.query(
        `UPDATE camp_reservations
         SET amount_override_cents = $2,
             override_reason = $3,
             price_override_flag = TRUE,
             updated_at = NOW()
         WHERE id = $1`,
        [row.id, currentTotal, OVERRIDE_REASON]
      );

      const checkInDate = toDateOnlyStr(row.check_in_date);
      const checkOutDate = toDateOnlyStr(row.check_out_date);
      const rates = siteRatesFromRow(row);
      await syncBillingPeriodsForReservation({
        reservationId: row.id,
        checkInDate,
        checkOutDate,
        isMember: row.reservation_type === "member",
        rates,
        effectiveTotalCents: currentTotal,
      });
    }
  }

  await client.end();
  console.log(
    `\nSummary: ${lockCount} to lock, ${skipAlreadyLocked} already locked, ${skipZero} skipped`
  );
  if (!execute) {
    console.log("Dry run only — re-run with --execute to write.");
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
