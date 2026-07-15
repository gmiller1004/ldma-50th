import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { sql, hasDb } from "@/lib/db";
import { getCampBySlug } from "@/lib/directory-camps";
import { listBillingPeriods } from "@/lib/reservation-billing";
import { lookupMember } from "@/lib/salesforce";
import { verifyReservationPayToken } from "@/lib/reservation-pay-token";
import { formatSiteAssignmentLabel, type CampSiteRow } from "@/lib/public-camp-booking";
import { PUBLIC_BOOKING_IMPORT_SOURCE } from "@/lib/public-camp-booking";
import { summarizeReservationPaymentObligations } from "@/lib/reservation-balance-due";
import { toDateOnlyStr } from "@/lib/reservation-dates";

function publicBookingActorId(): string {
  return process.env.PUBLIC_BOOKING_ACTOR_CONTACT_ID?.trim() || "public-web-self-service";
}

type ReservationPayRow = {
  id: string;
  camp_slug: string;
  check_in_date: string;
  check_out_date: string;
  reservation_type: string;
  member_contact_id: string | null;
  member_number: string | null;
  member_display_name: string | null;
  guest_first_name: string | null;
  guest_last_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  status: string;
  site_code: string | null;
  site_name: string;
  site_type: string;
  special_type: string | null;
};

async function loadReservation(reservationId: string): Promise<ReservationPayRow | null> {
  if (!hasDb() || !sql) return null;
  const rows = await sql`
    SELECT r.id, r.camp_slug, r.check_in_date, r.check_out_date, r.reservation_type,
           r.member_contact_id, r.member_number, r.member_display_name,
           r.guest_first_name, r.guest_last_name, r.guest_email, r.guest_phone, r.status,
           s.site_code, s.name AS site_name, s.site_type, s.special_type
    FROM camp_reservations r
    JOIN camp_sites s ON s.id = r.site_id
    WHERE r.id = ${reservationId}
    LIMIT 1
  `;
  return (Array.isArray(rows) ? rows[0] : undefined) as ReservationPayRow | null;
}

function recipientForRow(row: ReservationPayRow): { email: string; name: string } | null {
  if (row.reservation_type === "guest") {
    const email = row.guest_email?.trim();
    if (!email) return null;
    const name =
      [row.guest_first_name, row.guest_last_name].filter(Boolean).join(" ").trim() || "Guest";
    return { email, name };
  }
  const name = row.member_display_name?.trim() || (row.member_number ? `#${row.member_number}` : "Member");
  const guestEmail = row.guest_email?.trim();
  if (guestEmail) return { email: guestEmail, name };
  return null;
}

async function resolveRecipient(row: ReservationPayRow): Promise<{ email: string; name: string } | null> {
  const direct = recipientForRow(row);
  if (direct) return direct;
  if (row.reservation_type !== "member") return null;
  const memberNumber = row.member_number?.trim();
  if (!memberNumber) return null;
  const member = await lookupMember(memberNumber);
  if (!member.valid || !member.email?.trim()) return null;
  const name =
    row.member_display_name?.trim() ||
    [member.firstName, member.lastName].filter(Boolean).join(" ").trim() ||
    `Member #${memberNumber}`;
  return { email: member.email.trim(), name };
}

/**
 * GET /api/camp/booking/pay-balance?token=...
 * Reservation summary for pay-balance page.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  const parsed = token ? await verifyReservationPayToken(token) : null;
  if (!parsed) {
    return NextResponse.json({ error: "Invalid or expired payment link." }, { status: 400 });
  }

  const row = await loadReservation(parsed.reservationId);
  if (!row || row.status === "cancelled") {
    return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
  }

  const recipient = await resolveRecipient(row);
  if (!recipient) {
    return NextResponse.json({ error: "No email on file for this reservation." }, { status: 400 });
  }

  const periods = await listBillingPeriods(row.id);
  const checkInDate = toDateOnlyStr(row.check_in_date);
  const checkOutDate = toDateOnlyStr(row.check_out_date);
  const obligations = summarizeReservationPaymentObligations({
    periods,
    checkInDate,
    checkOutDate,
    reservationType: row.reservation_type,
  });
  const campName = getCampBySlug(row.camp_slug)?.name ?? row.camp_slug;
  const siteLabel = formatSiteAssignmentLabel({
    site_code: row.site_code,
    name: row.site_name,
    site_type: row.site_type,
    special_type: row.special_type,
  } as CampSiteRow);

  return NextResponse.json({
    campName,
    campSlug: row.camp_slug,
    guestOrMemberName: recipient.name,
    email: recipient.email,
    checkInDate,
    checkOutDate,
    siteLabel,
    balanceDueCents: obligations.payableNowCents,
    totalRemainingCents: obligations.totalUnpaidCents,
    balanceDueBeforeArrivalCents: obligations.balanceDueBeforeArrivalCents,
    nextPaymentDueDate: obligations.nextScheduledPayment?.dueDate ?? null,
    nextPaymentDueCents: obligations.nextScheduledPayment?.amountCents ?? null,
    paidInFull: obligations.paidInFull,
    nothingPayableNow: obligations.payableNowCents < 1 && obligations.totalUnpaidCents > 0,
  });
}

/**
 * POST /api/camp/booking/pay-balance
 * Stripe Checkout for remaining site-fee balance.
 */
export async function POST(request: NextRequest) {
  const secretKey = process.env.STRIPE_RESTRICTED_KEY || process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: "Payments are not configured" }, { status: 503 });
  }

  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const parsed = token ? await verifyReservationPayToken(token) : null;
  if (!parsed) {
    return NextResponse.json({ error: "Invalid or expired payment link." }, { status: 400 });
  }

  const row = await loadReservation(parsed.reservationId);
  if (!row || row.status === "cancelled") {
    return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
  }

  const recipient = await resolveRecipient(row);
  if (!recipient) {
    return NextResponse.json({ error: "No email on file for this reservation." }, { status: 400 });
  }

  const periods = await listBillingPeriods(row.id);
  const checkInDate = toDateOnlyStr(row.check_in_date);
  const checkOutDate = toDateOnlyStr(row.check_out_date);
  const obligations = summarizeReservationPaymentObligations({
    periods,
    checkInDate,
    checkOutDate,
    reservationType: row.reservation_type,
  });
  if (obligations.paidInFull) {
    return NextResponse.json({ error: "This reservation is already paid in full." }, { status: 400 });
  }
  if (obligations.payableNowCents < 1) {
    return NextResponse.json(
      {
        error: obligations.nextScheduledPayment
          ? `Your next payment of ${(obligations.nextScheduledPayment.amountCents / 100).toFixed(2)} is due on ${obligations.nextScheduledPayment.dueDate}.`
          : "No payment is due at this time.",
      },
      { status: 400 }
    );
  }

  const campName = getCampBySlug(row.camp_slug)?.name ?? row.camp_slug;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  const chargeCents = obligations.payableNowCents;

  const metadata: Record<string, string> = {
    self_service: "true",
    payment_type: "reservation",
    payment_only: "true",
    camp_slug: row.camp_slug,
    camp_name: campName,
    created_by_contact_id: publicBookingActorId(),
    recipient_email: recipient.email,
    recipient_display_name: recipient.name,
    amount_cents: String(chargeCents),
    reservation_id: row.id,
    reservation_type: row.reservation_type,
    import_source: PUBLIC_BOOKING_IMPORT_SOURCE,
  };

  if (row.reservation_type === "member") {
    metadata.member_contact_id = row.member_contact_id ?? "";
    metadata.member_number = row.member_number ?? "";
    metadata.member_display_name = row.member_display_name ?? "";
  } else {
    metadata.guest_first_name = row.guest_first_name ?? "";
    metadata.guest_last_name = row.guest_last_name ?? "";
    metadata.guest_email = row.guest_email ?? "";
    metadata.guest_phone = row.guest_phone ?? "";
  }

  const stripe = new Stripe(secretKey);
  try {
    const sessionCheckout = await stripe.checkout.sessions.create({
      mode: "payment",
      currency: "usd",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: chargeCents,
            product_data: {
              name: `${campName} — Campsite balance`,
              description: `Balance due for stay ${toDateOnlyStr(row.check_in_date)} to ${toDateOnlyStr(row.check_out_date)}`,
            },
          },
        },
      ],
      success_url: `${baseUrl}/reservations/pay?token=${encodeURIComponent(token)}&paid=1`,
      cancel_url: `${baseUrl}/reservations/pay?token=${encodeURIComponent(token)}`,
      customer_email: recipient.email,
      metadata,
    });

    if (!sessionCheckout.url) {
      return NextResponse.json({ error: "Checkout session has no URL" }, { status: 500 });
    }
    return NextResponse.json({ url: sessionCheckout.url });
  } catch (e) {
    console.error("[pay-balance] Stripe error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to start checkout" },
      { status: 500 }
    );
  }
}
