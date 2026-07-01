import { NextRequest, NextResponse } from "next/server";
import { getCaretakerAccess } from "@/lib/caretaker-auth";
import { sql, hasDb } from "@/lib/db";
import { getValidCampSlugs } from "@/lib/directory-camps";
import {
  buildPaymentsCsv,
  compDbRowToExport,
  isIsoDate,
  paymentDbRowToExport,
  sortPaymentExportRows,
  type PaymentExportRow,
} from "@/lib/caretaker-payments-export";

type PaymentDbRow = Parameters<typeof paymentDbRowToExport>[0];
type CompDbRow = Parameters<typeof compDbRowToExport>[0];

/**
 * GET /api/members/caretaker/admin/payments-export?from=YYYY-MM-DD&to=YYYY-MM-DD&campSlug=optional
 * All payment methods (card, cash, refunds) plus $0 comp reservations in range.
 */
export async function GET(request: NextRequest) {
  const access = await getCaretakerAccess();
  if (!access || access.mode !== "admin") {
    return NextResponse.json({ error: "Caretaker admin access required" }, { status: 403 });
  }
  if (!hasDb() || !sql) {
    return NextResponse.json({ error: "Database not available" }, { status: 503 });
  }

  const fromRaw = request.nextUrl.searchParams.get("from")?.trim() ?? "";
  const toRaw = request.nextUrl.searchParams.get("to")?.trim() ?? "";
  const from = fromRaw && isIsoDate(fromRaw) ? fromRaw : null;
  const to = toRaw && isIsoDate(toRaw) ? toRaw : null;

  if (!from || !to) {
    return NextResponse.json({ error: "from and to dates are required (YYYY-MM-DD)" }, { status: 400 });
  }
  if (from > to) {
    return NextResponse.json({ error: "from must be on or before to" }, { status: 400 });
  }

  const campSlugParam = request.nextUrl.searchParams.get("campSlug")?.trim() ?? "";
  const campSlug =
    campSlugParam && getValidCampSlugs().includes(campSlugParam) ? campSlugParam : null;
  if (campSlugParam && !campSlug) {
    return NextResponse.json({ error: "Invalid camp" }, { status: 400 });
  }

  try {
    let paymentRows: PaymentDbRow[];
    let compRows: CompDbRow[];

    if (campSlug) {
      const paymentResult = await sql`
        SELECT
          p.created_at,
          p.recipient_display_name,
          p.method,
          p.payment_type,
          p.amount_cents,
          p.camp_slug,
          p.maintenance_amount_cents,
          p.membership_amount_cents,
          p.invoice_number,
          s.name AS site_name,
          r.check_in_date,
          r.check_out_date,
          r.nights
        FROM camp_payments p
        LEFT JOIN camp_reservations r ON r.id = p.reservation_id
        LEFT JOIN camp_sites s ON s.id = r.site_id
        WHERE p.created_at::date >= ${from}::date
          AND p.created_at::date <= ${to}::date
          AND p.camp_slug = ${campSlug}
        ORDER BY p.created_at ASC
      `;
      paymentRows = (Array.isArray(paymentResult) ? paymentResult : []) as PaymentDbRow[];

      const compResult = await sql`
        SELECT
          r.created_at,
          r.camp_slug,
          r.reservation_type,
          r.member_display_name,
          r.guest_first_name,
          r.guest_last_name,
          r.override_reason,
          r.invoice_number,
          s.name AS site_name,
          r.check_in_date,
          r.check_out_date,
          r.nights
        FROM camp_reservations r
        LEFT JOIN camp_sites s ON s.id = r.site_id
        WHERE r.camp_slug = ${campSlug}
          AND r.status != 'cancelled'
          AND r.amount_override_cents = 0
          AND r.override_reason IS NOT NULL
          AND TRIM(r.override_reason) <> ''
          AND r.created_at::date >= ${from}::date
          AND r.created_at::date <= ${to}::date
          AND NOT EXISTS (
            SELECT 1 FROM camp_payments p WHERE p.reservation_id = r.id
          )
        ORDER BY r.created_at ASC
      `;
      compRows = (Array.isArray(compResult) ? compResult : []) as CompDbRow[];
    } else {
      const paymentResult = await sql`
        SELECT
          p.created_at,
          p.recipient_display_name,
          p.method,
          p.payment_type,
          p.amount_cents,
          p.camp_slug,
          p.maintenance_amount_cents,
          p.membership_amount_cents,
          p.invoice_number,
          s.name AS site_name,
          r.check_in_date,
          r.check_out_date,
          r.nights
        FROM camp_payments p
        LEFT JOIN camp_reservations r ON r.id = p.reservation_id
        LEFT JOIN camp_sites s ON s.id = r.site_id
        WHERE p.created_at::date >= ${from}::date
          AND p.created_at::date <= ${to}::date
        ORDER BY p.created_at ASC
      `;
      paymentRows = (Array.isArray(paymentResult) ? paymentResult : []) as PaymentDbRow[];

      const compResult = await sql`
        SELECT
          r.created_at,
          r.camp_slug,
          r.reservation_type,
          r.member_display_name,
          r.guest_first_name,
          r.guest_last_name,
          r.override_reason,
          r.invoice_number,
          s.name AS site_name,
          r.check_in_date,
          r.check_out_date,
          r.nights
        FROM camp_reservations r
        LEFT JOIN camp_sites s ON s.id = r.site_id
        WHERE r.status != 'cancelled'
          AND r.amount_override_cents = 0
          AND r.override_reason IS NOT NULL
          AND TRIM(r.override_reason) <> ''
          AND r.created_at::date >= ${from}::date
          AND r.created_at::date <= ${to}::date
          AND NOT EXISTS (
            SELECT 1 FROM camp_payments p WHERE p.reservation_id = r.id
          )
        ORDER BY r.created_at ASC
      `;
      compRows = (Array.isArray(compResult) ? compResult : []) as CompDbRow[];
    }

    const rows: PaymentExportRow[] = [
      ...paymentRows.map(paymentDbRowToExport),
      ...compRows.map(compDbRowToExport),
    ].sort(sortPaymentExportRows);

    const csv = buildPaymentsCsv(rows);
    const campSuffix = campSlug ? `-${campSlug}` : "";
    const filename = `ldma-payments${campSuffix}-${from}-to-${to}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[caretaker-admin] payments export failed:", e);
    return NextResponse.json({ error: "Failed to generate payment report" }, { status: 500 });
  }
}
