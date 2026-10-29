/**
 * Read-only: timeline for Loren Simmons (Stanton site 43).
 *   npx tsx --env-file=.env.local scripts/inspect-simmons-timeline.ts
 */
import { sql } from "@/lib/db";

const ID = "f5e79cdc-beba-4bd7-bfa1-55ee81999a01";

async function main() {
  if (!sql) throw new Error("no db");
  const cols = (await sql`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_name IN ('camp_reservations', 'camp_billing_periods', 'camp_payments')
      AND column_name IN ('created_at', 'updated_at', 'notes', 'internal_notes', 'caretaker_notes')
  `) as { table_name: string; column_name: string }[];
  console.log("timestamp/note columns:", cols.map((c) => `${c.table_name}.${c.column_name}`).join(", "));

  const [r] = (await sql`SELECT * FROM camp_reservations WHERE id = ${ID}`) as Record<string, unknown>[];
  console.log("\nreservation row:");
  for (const [k, v] of Object.entries(r ?? {})) {
    if (v !== null && v !== "" && v !== false) console.log(`  ${k}: ${v instanceof Date ? v.toISOString() : String(v)}`);
  }

  const hasPeriodCreated = cols.some((c) => c.table_name === "camp_billing_periods" && c.column_name === "created_at");
  if (hasPeriodCreated) {
    const periods = (await sql`
      SELECT period_index, created_at::text, status FROM camp_billing_periods WHERE reservation_id = ${ID} ORDER BY period_index
    `) as Record<string, unknown>[];
    console.log("\nperiod rows written at:");
    for (const p of periods) console.log(`  #${p.period_index} ${p.created_at} ${p.status}`);
  }

  const payments = (await sql`
    SELECT p.*, p.created_at::text AS created_text FROM camp_payments p WHERE reservation_id = ${ID}
  `) as Record<string, unknown>[];
  console.log("\npayments:");
  for (const p of payments) {
    const keep = Object.entries(p).filter(([, v]) => v !== null && v !== "");
    console.log("  " + keep.map(([k, v]) => `${k}=${v instanceof Date ? v.toISOString() : String(v)}`).join(" · "));
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
