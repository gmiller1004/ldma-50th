/**
 * Read-only: render a reservation's printable receipt to an HTML file for review.
 *   npx tsx --env-file=.env.local scripts/preview-receipt.ts <reservationId> <outFile.html>
 */
import { writeFileSync } from "node:fs";
import { sql } from "@/lib/db";
import {
  getReservationBalance,
  listBillingPeriods,
  listReservationPayments,
} from "@/lib/reservation-billing";
import { getCampBySlug } from "@/lib/directory-camps";
import { toDateOnlyStr } from "@/lib/reservation-dates";
import { buildReceiptHtml } from "@/app/members/caretaker/printReservationReceipt";

async function main() {
  const [id, out] = process.argv.slice(2);
  if (!sql || !id || !out) throw new Error("usage: preview-receipt.ts <reservationId> <outFile.html>");

  const [r] = (await sql`
    SELECT r.*, s.name AS site_name FROM camp_reservations r JOIN camp_sites s ON s.id = r.site_id WHERE r.id = ${id}
  `) as Record<string, unknown>[];
  if (!r) throw new Error("reservation not found");

  const [periods, balance, payments] = await Promise.all([
    listBillingPeriods(id),
    getReservationBalance(id),
    listReservationPayments(id),
  ]);
  const isMember = r.reservation_type === "member";

  const html = buildReceiptHtml(
    {
      campName: getCampBySlug(String(r.camp_slug))?.name ?? String(r.camp_slug),
      partyName: isMember
        ? String(r.member_display_name ?? "Member")
        : `${r.guest_first_name ?? ""} ${r.guest_last_name ?? ""}`.trim() || "Guest",
      memberNumber: isMember ? (r.member_number as string | null) : null,
      siteName: r.site_name as string,
      checkInDate: toDateOnlyStr(r.check_in_date as string),
      checkOutDate: toDateOnlyStr(r.check_out_date as string),
      nights: r.nights as number,
      invoiceNumber: r.invoice_number as string | null,
      status: String(r.status),
      billingPeriods: periods,
      payments: payments as never,
      importedPaidCents: Number(r.imported_paid_cents ?? 0),
      totalDueCents: balance.totalDueCents,
      totalPaidCents: balance.totalPaidCents,
      balanceDueCents: balance.balanceDueCents,
    },
    new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
  );
  writeFileSync(out, html);
  console.log(`wrote ${out}`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
