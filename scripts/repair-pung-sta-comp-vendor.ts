/**
 * Stanton: comp Michael Pung's reservation as a vendor (per Kathy).
 * Sets the stay total to $0 with an override reason and rebuilds billing periods.
 *
 *   npx tsx --env-file=.env.local scripts/repair-pung-sta-comp-vendor.ts            (dry run)
 *   npx tsx --env-file=.env.local scripts/repair-pung-sta-comp-vendor.ts --execute
 */
import { sql } from "@/lib/db";
import { reservationBillingMode } from "@/lib/camp-billing-mode";
import {
  getReservationNetPaidCents,
  siteRatesFromRow,
  syncBillingPeriodsForReservation,
} from "@/lib/reservation-billing";
import { toDateOnlyStr } from "@/lib/reservation-dates";

const execute = process.argv.includes("--execute");
const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const COMP_REASON = "Comped — vendor (per Kathy)";

type Row = {
  id: string;
  site_code: string | null;
  site_name: string;
  member_display_name: string | null;
  guest_first_name: string | null;
  guest_last_name: string | null;
  reservation_type: string;
  status: string;
  check_in_date: string | Date;
  check_out_date: string | Date;
  nights: number;
  billing_mode: string | null;
  calculated_total_cents: number | null;
  amount_override_cents: number | null;
  override_reason: string | null;
  price_override_flag: boolean | null;
  invoice_number: string | null;
  member_rate_daily: number | string | null;
  member_rate_monthly: number | string | null;
  non_member_rate_daily: number | string | null;
};

async function main() {
  if (!sql) throw new Error("no db");

  const rows = (await sql`
    SELECT r.id, s.site_code, s.name AS site_name, r.member_display_name, r.guest_first_name, r.guest_last_name,
           r.reservation_type, r.status, r.check_in_date, r.check_out_date, r.nights, r.billing_mode,
           r.calculated_total_cents, r.amount_override_cents, r.override_reason, r.price_override_flag,
           r.invoice_number, s.member_rate_daily, s.member_rate_monthly, s.non_member_rate_daily
    FROM camp_reservations r JOIN camp_sites s ON s.id = r.site_id
    WHERE r.camp_slug = 'stanton-arizona'
      AND r.status <> 'cancelled'
      AND (
        r.member_display_name ILIKE '%pung%'
        OR r.guest_last_name ILIKE 'pung'
      )
    ORDER BY r.check_in_date
  `) as Row[];

  for (const r of rows) {
    const name =
      r.member_display_name || [r.guest_first_name, r.guest_last_name].filter(Boolean).join(" ") || "?";
    const paid = await getReservationNetPaidCents(r.id);
    console.log(
      `${r.id} · site ${r.site_code ?? r.site_name} · ${name} (${r.reservation_type}, ${r.status}) · ` +
        `${toDateOnlyStr(r.check_in_date)} → ${toDateOnlyStr(r.check_out_date)} (${r.nights}n) · ` +
        `calc ${money(r.calculated_total_cents ?? 0)} · override ${
          r.price_override_flag ? money(r.amount_override_cents ?? 0) : "none"
        } · net paid ${money(paid)} · invoice ${r.invoice_number ?? "—"}`
    );
  }

  if (rows.length !== 1) {
    throw new Error(`Expected exactly 1 active Stanton reservation for Pung, found ${rows.length}`);
  }
  const r = rows[0];
  const paid = await getReservationNetPaidCents(r.id);
  if (paid > 0) {
    console.log(`\nNote: ${money(paid)} already paid — comping leaves this as a credit. No refund is issued here.`);
  }

  if (!execute) {
    console.log(`\nDry run — would set total to $0.00 with reason "${COMP_REASON}". Pass --execute to apply.`);
    return;
  }

  await sql`
    UPDATE camp_reservations
    SET amount_override_cents = 0, override_reason = ${COMP_REASON}, price_override_flag = TRUE, updated_at = NOW()
    WHERE id = ${r.id}
  `;

  const balance = await syncBillingPeriodsForReservation({
    reservationId: r.id,
    checkInDate: toDateOnlyStr(r.check_in_date),
    checkOutDate: toDateOnlyStr(r.check_out_date),
    isMember: r.reservation_type === "member",
    rates: siteRatesFromRow(r),
    billingMode: reservationBillingMode(r.billing_mode),
    effectiveTotalCents: 0,
  });

  console.log(
    `\nApplied. Total due ${money(balance.totalDueCents)} · paid ${money(balance.totalPaidCents)} · balance ${money(
      balance.balanceDueCents
    )}`
  );
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
