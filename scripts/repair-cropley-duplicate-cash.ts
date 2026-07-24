/**
 * Repair Phil Cropley LM-2026-0003: duplicate cash payments from failed UI retries.
 * Keep the earliest $150 cash payment; delete the rest; resync billing.
 *
 *   npx tsx scripts/repair-cropley-duplicate-cash.ts
 *   npx tsx scripts/repair-cropley-duplicate-cash.ts --execute
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const RESERVATION_ID = "e8d8d215-9ccf-4a7f-a158-5ecadb398b7e";
const KEEP_PAYMENT_ID = "f7de16a7-0b93-4090-a6d7-07fc1778eff2"; // earliest cash 2026-07-23 17:06:30

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
  const { resyncReservationBillingFromDb } = await import("../lib/reservation-billing");

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

  const cash = await client.query(
    `SELECT id, amount_cents, created_at::text
     FROM camp_payments
     WHERE reservation_id = $1 AND method = 'cash' AND payment_type = 'reservation'
     ORDER BY created_at ASC`,
    [RESERVATION_ID]
  );
  console.log(execute ? "EXECUTE" : "DRY RUN");
  console.log("Cash payments:", cash.rows);

  const toDelete = cash.rows.filter((r) => r.id !== KEEP_PAYMENT_ID);
  console.log(
    `Keep ${KEEP_PAYMENT_ID}; delete ${toDelete.length} duplicates ($${(toDelete.reduce((s, r) => s + r.amount_cents, 0) / 100).toFixed(2)})`
  );

  if (execute) {
    if (toDelete.length > 0) {
      await client.query(
        `DELETE FROM camp_payments WHERE id = ANY($1::uuid[])`,
        [toDelete.map((r) => r.id)]
      );
    }
    await client.end();

    const balance = await resyncReservationBillingFromDb(RESERVATION_ID);
    console.log("Resynced:", balance);

    const client2 = new pg.Client({ connectionString: url });
    await client2.connect();
    const periods = await client2.query(
      `SELECT period_index, due_date::text, amount_due_cents, amount_paid_cents, status
       FROM camp_billing_periods WHERE reservation_id = $1 ORDER BY period_index`,
      [RESERVATION_ID]
    );
    const payments = await client2.query(
      `SELECT id, method, amount_cents, created_at::text
       FROM camp_payments WHERE reservation_id = $1 ORDER BY created_at`,
      [RESERVATION_ID]
    );
    console.log("Payments after:", payments.rows);
    console.log("Periods after:", periods.rows);
    await client2.end();
  } else {
    await client.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
