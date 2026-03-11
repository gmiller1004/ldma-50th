import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getCaretakerContext } from "@/lib/caretaker-auth";
import { campUsesReservations } from "@/lib/reservation-camps";

/**
 * POST /api/members/caretaker/payments/checkout-session
 * Create a Stripe Checkout Session for reservation (new or adjustment) or past_due.
 * Body: { amountCents, paymentType: 'reservation'|'past_due', recipientEmail, recipientDisplayName, ...metadata }
 * For reservation_creation: siteId, checkInDate, checkOutDate, nights, reservationType, memberContactId?, memberNumber?, memberDisplayName?, guestFirstName?, guestLastName?, guestEmail?, guestPhone?
 * For reservation_adjustment: reservationId (existing), siteId, checkInDate, checkOutDate, nights, ...
 * For past_due: maintenanceAmountCents?, membershipAmountCents?, memberContactId, memberNumber
 * Returns { url: string } for redirect.
 */
export async function POST(request: NextRequest) {
  const caretaker = await getCaretakerContext();
  if (!caretaker) {
    return NextResponse.json({ error: "Caretaker access required" }, { status: 403 });
  }
  if (!campUsesReservations(caretaker.campSlug)) {
    return NextResponse.json({ error: "Reservation system not available for this camp" }, { status: 403 });
  }

  const secretKey = process.env.STRIPE_RESTRICTED_KEY || process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  let body: {
    amountCents?: number;
    paymentType?: string;
    recipientEmail?: string;
    recipientDisplayName?: string;
    siteId?: string;
    checkInDate?: string;
    checkOutDate?: string;
    nights?: number;
    reservationType?: string;
    reservationId?: string;
    memberContactId?: string;
    memberNumber?: string;
    memberDisplayName?: string;
    guestFirstName?: string;
    guestLastName?: string;
    guestEmail?: string;
    guestPhone?: string;
    eventProductHandle?: string;
    eventSiteType?: string;
    maintenanceAmountCents?: number;
    membershipAmountCents?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const amountCents = typeof body.amountCents === "number" ? body.amountCents : 0;
  const paymentType = body.paymentType === "reservation" || body.paymentType === "past_due" ? body.paymentType : null;
  const recipientEmail = typeof body.recipientEmail === "string" ? body.recipientEmail.trim() : "";
  const recipientDisplayName = typeof body.recipientDisplayName === "string" ? body.recipientDisplayName.trim() : "Guest";

  if (amountCents < 1) {
    return NextResponse.json({ error: "amountCents must be positive" }, { status: 400 });
  }
  if (!paymentType) {
    return NextResponse.json({ error: "paymentType required: 'reservation' or 'past_due'" }, { status: 400 });
  }
  if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    return NextResponse.json({ error: "Valid recipientEmail required" }, { status: 400 });
  }

  const stripe = new Stripe(secretKey);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;

  const campNameForStripe = caretaker.campName || caretaker.campSlug;
  const metadata: Record<string, string> = {
    payment_type: paymentType,
    camp_slug: caretaker.campSlug,
    camp_name: campNameForStripe,
    created_by_contact_id: caretaker.contactId,
    recipient_email: recipientEmail,
    recipient_display_name: recipientDisplayName,
    amount_cents: String(amountCents),
  };

  if (paymentType === "reservation") {
    const reservationId = typeof body.reservationId === "string" ? body.reservationId.trim() : "";
    const siteId = typeof body.siteId === "string" ? body.siteId.trim() : "";
    const checkInDate = typeof body.checkInDate === "string" ? body.checkInDate.trim() : "";
    const checkOutDate = typeof body.checkOutDate === "string" ? body.checkOutDate.trim() : "";
    const nights = typeof body.nights === "number" ? body.nights : 0;
    const reservationType = body.reservationType === "member" || body.reservationType === "guest" ? body.reservationType : "member";
    if (!siteId || !checkInDate || !checkOutDate || nights < 1) {
      return NextResponse.json(
        { error: "Reservation payment requires siteId, checkInDate, checkOutDate, nights" },
        { status: 400 }
      );
    }
    metadata.site_id = siteId;
    metadata.check_in_date = checkInDate;
    metadata.check_out_date = checkOutDate;
    metadata.nights = String(nights);
    metadata.reservation_type = reservationType;
    if (reservationId) metadata.reservation_id = reservationId;
    if (reservationType === "member") {
      metadata.member_contact_id = (body.memberContactId ?? "").toString().trim();
      metadata.member_number = (body.memberNumber ?? "").toString().trim();
      metadata.member_display_name = (body.memberDisplayName ?? "").toString().trim();
    } else {
      metadata.guest_first_name = (body.guestFirstName ?? "").toString().trim();
      metadata.guest_last_name = (body.guestLastName ?? "").toString().trim();
      metadata.guest_email = (body.guestEmail ?? "").toString().trim();
      metadata.guest_phone = (body.guestPhone ?? "").toString().trim();
    }
    const eventProductHandle = typeof body.eventProductHandle === "string" ? body.eventProductHandle.trim() : "";
    const eventSiteType = body.eventSiteType === "upgrade_hookup" ? "upgrade_hookup" : "";
    if (eventProductHandle) metadata.event_product_handle = eventProductHandle;
    if (eventSiteType) metadata.event_site_type = eventSiteType;
  } else {
    metadata.maintenance_amount_cents = String(body.maintenanceAmountCents ?? 0);
    metadata.membership_amount_cents = String(body.membershipAmountCents ?? 0);
    metadata.member_contact_id = (body.memberContactId ?? "").toString().trim();
    metadata.member_number = (body.memberNumber ?? "").toString().trim();
  }

  const lineLabel =
    paymentType === "reservation"
      ? "Camp reservation"
      : "Past-due (maintenance/membership)";
  const productName = `${campNameForStripe} — ${lineLabel}`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      currency: "usd",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: productName,
              description: recipientDisplayName ? `Payment for ${recipientDisplayName}` : undefined,
            },
          },
        },
      ],
      success_url: `${baseUrl}/members/caretaker?payment=success`,
      cancel_url: `${baseUrl}/members/caretaker?payment=cancelled`,
      customer_email: recipientEmail,
      metadata,
    });

    const url = session.url;
    if (!url) {
      return NextResponse.json({ error: "Checkout session has no URL" }, { status: 500 });
    }
    return NextResponse.json({ url });
  } catch (e) {
    console.error("[caretaker] Stripe checkout session error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
