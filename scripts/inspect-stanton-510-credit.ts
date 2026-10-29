/**
 * Read-only: find Stanton reservations matching Kathy's report ($510 prior-season credit,
 * $190 early-arrival, $320 November payment, unexpected $130 credit) and dump their ledgers.
 *
 *   npx tsx --env-file=.env.local scripts/inspect-stanton-510-credit.ts [nameFragment]
 */
import { sql } from "@/lib/db";
import { getReservationNetPaidCents } from "@/lib/reservation-billing";
import { toDateOnlyStr } from "@/lib/reservation-dates";

const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const nameArg = process.argv[2];

async function main() {
  if (!sql) throw new Error("no db");

  const candidates = (nameArg
    ? await sql`
        SELECT r.id FROM camp_reservations r
        WHERE r.camp_slug = 'stanton-arizona' AND r.status <> 'cancelled'
          AND (r.member_display_name ILIKE ${"%" + nameArg + "%"} OR r.guest_last_name ILIKE ${"%" + nameArg + "%"})
      `
    : await sql`
        SELECT DISTINCT r.id FROM camp_reservations r
        LEFT JOIN camp_payments p ON p.reservation_id = r.id
        WHERE r.camp_slug = 'stanton-arizona' AND r.status <> 'cancelled'
          AND r.check_in_date >= '2026-09-01'
          AND (r.imported_paid_cents = 51000 OR p.amount_cents IN (32000, 19000, 51000))
      `) as { id: string }[];

  for (const { id } of candidates) {
    const [r] = (await sql`
      SELECT r.id, s.site_code, r.member_display_name, r.guest_first_name, r.guest_last_name, r.reservation_type,
             r.status, r.check_in_date, r.check_out_date, r.nights, r.billing_mode, r.calculated_total_cents,
             r.amount_override_cents, r.override_reason, r.price_override_flag, r.imported_paid_cents,
             r.invoice_number, r.import_source, r.created_at::text, r.checked_in_at::text
      FROM camp_reservations r JOIN camp_sites s ON s.id = r.site_id WHERE r.id = ${id}
    `) as Record<string, unknown>[];
    const payments = (await sql`
      SELECT created_at::text, payment_type, method, amount_cents, invoice_number, created_by_contact_id
      FROM camp_payments WHERE reservation_id = ${id} ORDER BY created_at
    `) as Record<string, unknown>[];
    const voids = (await sql`
      SELECT original_created_at::text, method, amount_cents, reason FROM camp_payment_voids WHERE reservation_id = ${id}
    `) as Record<string, unknown>[];
    const periods = (await sql`
      SELECT period_index, period_start, period_end, nights, amount_due_cents, amount_paid_cents, due_date
      FROM camp_billing_periods WHERE reservation_id = ${id} ORDER BY period_index
    `) as Record<string, unknown>[];

    const net = await getReservationNetPaidCents(id);
    const due = periods.reduce((s, p) => s + Number(p.amount_due_cents), 0);
    const name =
      (r.member_display_name as string) || `${r.guest_first_name ?? ""} ${r.guest_last_name ?? ""}`.trim();

    console.log(`\n=== ${name} · site ${r.site_code} · ${r.invoice_number} · ${r.reservation_type} · ${r.status}`);
    console.log(
      `stay ${toDateOnlyStr(r.check_in_date as string)} → ${toDateOnlyStr(r.check_out_date as string)} (${r.nights}n) · ` +
        `mode ${r.billing_mode} · calc ${money(Number(r.calculated_total_cents ?? 0))} · ` +
        `override ${r.price_override_flag ? `${money(Number(r.amount_override_cents ?? 0))} (${r.override_reason})` : "none"} · ` +
        `imported credit ${money(Number(r.imported_paid_cents ?? 0))} · source ${r.import_source} · checked in ${r.checked_in_at ?? "—"}`
    );
    console.log("payments:");
    for (const p of payments) {
      console.log(`  ${p.created_at} ${p.payment_type}/${p.method} ${money(Number(p.amount_cents))} by ${p.created_by_contact_id}`);
    }
    if (voids.length) {
      console.log("voided:");
      for (const v of voids) console.log(`  ${v.original_created_at} ${v.method} ${money(Number(v.amount_cents))} — ${v.reason}`);
    }
    console.log("periods:");
    for (const p of periods) {
      console.log(
        `  #${p.period_index} ${toDateOnlyStr(p.period_start as string)} → ${toDateOnlyStr(p.period_end as string)} ` +
          `(${p.nights}n) due ${money(Number(p.amount_due_cents))} paid ${money(Number(p.amount_paid_cents))} due_date ${p.due_date ? toDateOnlyStr(p.due_date as string) : "—"}`
      );
    }
    console.log(`TOTAL due ${money(due)} · net paid ${money(net)} · balance ${money(due - net)}`);
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
