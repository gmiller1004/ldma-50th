/**
 * Read-only: confirm the reminder-cadence migration is on the DB and show what reminders went out recently.
 *   npx tsx --env-file=.env.local scripts/inspect-reminder-cadence-prod.ts
 */
import { sql } from "@/lib/db";

async function main() {
  if (!sql) throw new Error("no db");

  const cols = (await sql`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_name IN ('camp_reservations', 'camp_billing_periods') AND column_name LIKE 'balance_reminder%'
    ORDER BY table_name, column_name
  `) as { table_name: string; column_name: string }[];
  console.log("reminder columns:");
  for (const c of cols) console.log(`  ${c.table_name}.${c.column_name}`);

  const has = (t: string, c: string) => cols.some((x) => x.table_name === t && x.column_name === c);
  if (!has("camp_billing_periods", "balance_reminder_5d_sent_at")) {
    console.log("\nNew cadence columns are MISSING — migration not applied.");
    return;
  }

  const recent = (await sql`
    SELECT 'period' AS kind, r.camp_slug, r.member_display_name, r.guest_last_name,
           bp.balance_reminder_5d_sent_at::text AS d5, bp.balance_reminder_due_sent_at::text AS due
    FROM camp_billing_periods bp JOIN camp_reservations r ON r.id = bp.reservation_id
    WHERE bp.balance_reminder_5d_sent_at > NOW() - INTERVAL '8 days'
       OR bp.balance_reminder_due_sent_at > NOW() - INTERVAL '8 days'
    UNION ALL
    SELECT 'arrival', r.camp_slug, r.member_display_name, r.guest_last_name,
           r.balance_reminder_5d_sent_at::text, r.balance_reminder_due_sent_at::text
    FROM camp_reservations r
    WHERE r.balance_reminder_5d_sent_at > NOW() - INTERVAL '8 days'
       OR r.balance_reminder_due_sent_at > NOW() - INTERVAL '8 days'
    ORDER BY 1, 2
  `) as Record<string, string | null>[];
  console.log(`\nnew-cadence reminders sent in the last 8 days: ${recent.length}`);
  for (const r of recent) {
    console.log(`  ${r.kind} · ${r.camp_slug} · ${r.member_display_name ?? r.guest_last_name} · 5d ${r.d5 ?? "—"} · due ${r.due ?? "—"}`);
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
