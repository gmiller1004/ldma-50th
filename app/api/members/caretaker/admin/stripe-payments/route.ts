import { NextRequest, NextResponse } from "next/server";
import { getCaretakerAccess } from "@/lib/caretaker-auth";
import { sql, hasDb } from "@/lib/db";
import { getValidCampSlugs } from "@/lib/directory-camps";

const MAX_ROWS = 500;

type PaymentRow = {
  id: string;
  created_at: string;
  amount_cents: number;
  payment_type: string;
  recipient_display_name: string;
  member_email: string;
  reservation_id: string | null;
  stripe_checkout_session_id: string | null;
};

function rowToJson(row: PaymentRow) {
  return {
    id: row.id,
    createdAt: row.created_at,
    amountCents: row.amount_cents,
    paymentType: row.payment_type,
    recipientDisplayName: row.recipient_display_name,
    memberEmail: row.member_email,
    reservationId: row.reservation_id,
    stripeCheckoutSessionId: row.stripe_checkout_session_id,
  };
}

function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/**
 * GET /api/members/caretaker/admin/stripe-payments?campSlug=...&from=YYYY-MM-DD&to=YYYY-MM-DD
 * Card payments recorded when Stripe Checkout completed (camp_payments with checkout session id).
 */
export async function GET(request: NextRequest) {
  const access = await getCaretakerAccess();
  if (!access || access.mode !== "admin") {
    return NextResponse.json({ error: "Caretaker admin access required" }, { status: 403 });
  }
  if (!hasDb() || !sql) {
    return NextResponse.json({ error: "Database not available" }, { status: 503 });
  }

  const campSlug = request.nextUrl.searchParams.get("campSlug")?.trim() ?? "";
  if (!campSlug || !getValidCampSlugs().includes(campSlug)) {
    return NextResponse.json({ error: "Invalid camp" }, { status: 400 });
  }

  const fromRaw = request.nextUrl.searchParams.get("from")?.trim() ?? "";
  const toRaw = request.nextUrl.searchParams.get("to")?.trim() ?? "";
  const from = fromRaw && isIsoDate(fromRaw) ? fromRaw : null;
  const to = toRaw && isIsoDate(toRaw) ? toRaw : null;

  if (from && to && from > to) {
    return NextResponse.json({ error: "from must be on or before to" }, { status: 400 });
  }

  try {
    let rows: PaymentRow[];
    if (from && to) {
      const r = await sql`
        SELECT id, created_at, amount_cents, payment_type, recipient_display_name, member_email,
               reservation_id, stripe_checkout_session_id
        FROM camp_payments
        WHERE camp_slug = ${campSlug}
          AND stripe_checkout_session_id IS NOT NULL
          AND method = 'card'
          AND created_at::date >= ${from}::date
          AND created_at::date <= ${to}::date
        ORDER BY created_at DESC
        LIMIT ${MAX_ROWS}
      `;
      rows = (Array.isArray(r) ? r : []) as PaymentRow[];
    } else if (from) {
      const r = await sql`
        SELECT id, created_at, amount_cents, payment_type, recipient_display_name, member_email,
               reservation_id, stripe_checkout_session_id
        FROM camp_payments
        WHERE camp_slug = ${campSlug}
          AND stripe_checkout_session_id IS NOT NULL
          AND method = 'card'
          AND created_at::date >= ${from}::date
        ORDER BY created_at DESC
        LIMIT ${MAX_ROWS}
      `;
      rows = (Array.isArray(r) ? r : []) as PaymentRow[];
    } else if (to) {
      const r = await sql`
        SELECT id, created_at, amount_cents, payment_type, recipient_display_name, member_email,
               reservation_id, stripe_checkout_session_id
        FROM camp_payments
        WHERE camp_slug = ${campSlug}
          AND stripe_checkout_session_id IS NOT NULL
          AND method = 'card'
          AND created_at::date <= ${to}::date
        ORDER BY created_at DESC
        LIMIT ${MAX_ROWS}
      `;
      rows = (Array.isArray(r) ? r : []) as PaymentRow[];
    } else {
      const r = await sql`
        SELECT id, created_at, amount_cents, payment_type, recipient_display_name, member_email,
               reservation_id, stripe_checkout_session_id
        FROM camp_payments
        WHERE camp_slug = ${campSlug}
          AND stripe_checkout_session_id IS NOT NULL
          AND method = 'card'
        ORDER BY created_at DESC
        LIMIT ${MAX_ROWS}
      `;
      rows = (Array.isArray(r) ? r : []) as PaymentRow[];
    }

    return NextResponse.json({ payments: rows.map(rowToJson) });
  } catch (e) {
    console.error("[caretaker-admin] stripe payments query failed:", e);
    return NextResponse.json({ error: "Failed to load payments" }, { status: 500 });
  }
}
