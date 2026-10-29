/**
 * Read-only: comped ($0 override) reservations at Stanton, current and upcoming.
 *   npx tsx --env-file=.env.local scripts/inspect-stanton-comps.ts [YYYY-MM-DD]
 */
import { sql } from "@/lib/db";
import { getReservationNetPaidCents } from "@/lib/reservation-billing";
import { toDateOnlyStr } from "@/lib/reservation-dates";

const today =
  process.argv[2] ?? new Date().toLocaleDateString("en-CA", { timeZone: "America/Phoenix" });
const money = (c: number) => `$${(c / 100).toFixed(2)}`;

type Row = {
  id: string;
  site_code: string | null;
  name: string;
  reservation_type: string;
  status: string;
  check_in_date: string | Date;
  check_out_date: string | Date;
  nights: number;
  calculated_total_cents: number | null;
  amount_override_cents: number | null;
  override_reason: string | null;
  invoice_number: string | null;
};

async function main() {
  if (!sql) throw new Error("no db");

  const rows = (await sql`
    SELECT r.id, s.site_code,
           COALESCE(NULLIF(r.member_display_name, ''), TRIM(CONCAT(r.guest_first_name, ' ', r.guest_last_name))) AS name,
           r.reservation_type, r.status, r.check_in_date, r.check_out_date, r.nights,
           r.calculated_total_cents, r.amount_override_cents, r.override_reason, r.invoice_number
    FROM camp_reservations r JOIN camp_sites s ON s.id = r.site_id
    WHERE r.camp_slug = 'stanton-arizona'
      AND r.status <> 'cancelled'
      AND r.check_out_date > ${today}::date
      AND (
        r.amount_override_cents = 0
        OR (r.amount_override_cents IS NULL AND COALESCE(r.calculated_total_cents, 0) = 0)
      )
    ORDER BY r.check_in_date, s.site_code
  `) as Row[];

  const print = async (label: string, list: Row[]) => {
    console.log(`\n${label}: ${list.length}`);
    for (const r of list) {
      const paid = await getReservationNetPaidCents(r.id);
      console.log(
        `  site ${r.site_code} · ${r.name} (${r.reservation_type}, ${r.status}) · ` +
          `${toDateOnlyStr(r.check_in_date)} → ${toDateOnlyStr(r.check_out_date)} (${r.nights}n) · ` +
          `std ${money(r.calculated_total_cents ?? 0)} · paid ${money(paid)} · ${r.invoice_number ?? "—"} · ` +
          `reason: ${r.override_reason ?? "(none)"}`
      );
    }
  };

  const isComp = (r: Row) => r.amount_override_cents === 0 && !!r.override_reason?.trim();
  const isCurrent = (r: Row) => toDateOnlyStr(r.check_in_date) <= today;

  console.log(`As of ${today} (Arizona)`);
  await print("Comped, stay covers today", rows.filter((r) => isComp(r) && isCurrent(r)));
  await print("Comped, arriving later", rows.filter((r) => isComp(r) && !isCurrent(r)));
  await print("$0 total but not marked as a comp", rows.filter((r) => !isComp(r)));
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
