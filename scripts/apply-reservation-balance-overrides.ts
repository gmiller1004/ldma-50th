/**
 * Apply caretaker-approved balance overrides for specific ResNexus site-move corrections.
 *
 *   npx tsx scripts/apply-reservation-balance-overrides.ts
 *   npx tsx scripts/apply-reservation-balance-overrides.ts --execute
 */
import pg from "pg";
import { applyReservationBalanceOverride } from "../lib/reservation-billing";

const { Client } = pg;
const IMPORT_SOURCE = "resnexus";

const connectionString =
  process.env.STORAGE_DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL;

/** Res# → balance due in cents (after credits already on file). */
const OVERRIDES: { resNumber: string; campSlug: string; balanceDueCents: number; reason: string }[] = [
  {
    resNumber: "37582",
    campSlug: "stanton-arizona",
    balanceDueCents: 363_000,
    reason: "LDMA member rate for 8-month stay after ResNexus credit (Brian Frank, Res#37582)",
  },
  {
    resNumber: "37568",
    campSlug: "stanton-arizona",
    balanceDueCents: 0,
    reason: "Paid in full at LDMA member rate $171 (Tami Somara, Res#37568)",
  },
];

async function run() {
  const execute = process.argv.includes("--execute");
  if (!connectionString) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();

  console.log(execute ? "EXECUTE balance overrides" : "DRY RUN (pass --execute to write)\n");

  for (const item of OVERRIDES) {
    const res = await client.query(
      `SELECT id, member_display_name, guest_first_name, guest_last_name
       FROM camp_reservations
       WHERE camp_slug = $1 AND external_res_number = $2 AND import_source = $3
       LIMIT 1`,
      [item.campSlug, item.resNumber, IMPORT_SOURCE]
    );
    if (res.rows.length === 0) {
      console.log(`✗ Res#${item.resNumber} not found`);
      continue;
    }

    const row = res.rows[0] as {
      id: string;
      member_display_name: string | null;
      guest_first_name: string | null;
      guest_last_name: string | null;
    };
    const name =
      row.member_display_name ||
      [row.guest_first_name, row.guest_last_name].filter(Boolean).join(" ").trim() ||
      "Guest";

    console.log(
      `Res#${item.resNumber} ${name}: target balance $${(item.balanceDueCents / 100).toFixed(2)}`
    );

    if (execute) {
      const balance = await applyReservationBalanceOverride({
        reservationId: row.id,
        balanceDueCents: item.balanceDueCents,
        overrideReason: item.reason,
      });
      console.log(
        `  → due $${(balance.totalDueCents / 100).toFixed(2)}, ` +
          `paid $${(balance.totalPaidCents / 100).toFixed(2)}, ` +
          `owes $${(balance.balanceDueCents / 100).toFixed(2)}`
      );
    }
  }

  await client.end();
  if (!execute) console.log("\nNo changes written. Run with --execute to apply.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
