import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getCaretakerWriteContext } from "@/lib/caretaker-auth";
import { campUsesReservations, isNonBookableSite } from "@/lib/reservation-camps";
import { hasDb, sql } from "@/lib/db";
import { computeStayTotalCents, siteRatesFromRow } from "@/lib/reservation-billing";
import { parseReservationPricingBody } from "@/lib/reservation-create-metadata";

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
    maintenanceAmountCents?: number;
    membershipAmountCents?: number;
    amountOverrideCents?: number;
    overrideReason?: string;
    campSlug?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const campSlugOverride = typeof body.campSlug === "string" ? body.campSlug.trim() : undefined;
  const caretaker = await getCaretakerWriteContext(campSlugOverride);
  if (!caretaker) {
    return NextResponse.json({ error: "Caretaker access required" }, { status: 403 });
  }
  if (!campUsesReservations(caretaker.campSlug)) {
    return NextResponse.json({ error: "Reservation system not available for this camp" }, { status: 403 });
  }
  if (!hasDb() || !sql) {
    return NextResponse.json({ error: "Database not available" }, { status: 503 });
  }

  const secretKey = process.env.STRIPE_RESTRICTED_KEY || process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
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
    const reservationType =
      body.reservationType === "member" || body.reservationType === "guest" ? body.reservationType : "member";

    // Pay site balance on an existing reservation (no date change / no new reservation)
    if (reservationId && !siteId) {
      const resRows = await sql`
        SELECT id, camp_slug, reservation_type, member_contact_id, member_number, member_display_name,
               guest_first_name, guest_last_name, guest_email, guest_phone, status
        FROM camp_reservations
        WHERE id = ${reservationId} AND camp_slug = ${caretaker.campSlug}
        LIMIT 1
      `;
      const res = (Array.isArray(resRows) ? resRows[0] : undefined) as
        | {
            id: string;
            reservation_type: string;
            member_contact_id: string | null;
            member_number: string | null;
            member_display_name: string | null;
            guest_first_name: string | null;
            guest_last_name: string | null;
            guest_email: string | null;
            guest_phone: string | null;
            status: string;
          }
        | undefined;
      if (!res) {
        return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
      }
      if (res.status === "cancelled") {
        return NextResponse.json({ error: "Cannot pay cancelled reservation" }, { status: 400 });
      }
      metadata.reservation_id = reservationId;
      metadata.payment_only = "true";
      metadata.reservation_type = res.reservation_type;
      if (res.reservation_type === "member") {
        metadata.member_contact_id = (res.member_contact_id ?? "").toString();
        metadata.member_number = (res.member_number ?? "").toString();
        metadata.member_display_name = (res.member_display_name ?? "").toString();
      } else {
        metadata.guest_first_name = (res.guest_first_name ?? "").toString();
        metadata.guest_last_name = (res.guest_last_name ?? "").toString();
        metadata.guest_email = (res.guest_email ?? "").toString();
        metadata.guest_phone = (res.guest_phone ?? "").toString();
      }
    } else {
      if (!siteId || !checkInDate || !checkOutDate || nights < 1) {
        return NextResponse.json(
          { error: "Reservation payment requires siteId, checkInDate, checkOutDate, nights" },
          { status: 400 }
        );
      }
      const siteRows = await sql`
        SELECT name, site_code, member_rate_daily, member_rate_monthly, non_member_rate_daily
        FROM camp_sites WHERE id = ${siteId} AND camp_slug = ${caretaker.campSlug} LIMIT 1
      `;
      const site = (Array.isArray(siteRows) ? siteRows : [])[0] as {
        name: string;
        site_code: string | null;
        member_rate_daily: number | null;
        member_rate_monthly: number | null;
        non_member_rate_daily: number | null;
      } | undefined;
      if (!site) {
        return NextResponse.json({ error: "Site not found" }, { status: 404 });
      }
      if (isNonBookableSite(caretaker.campSlug, site.name, site.site_code)) {
        return NextResponse.json(
          { error: "This site is reserved for caretaker use and cannot be booked." },
          { status: 400 }
        );
      }
      const rates = siteRatesFromRow(site);
      const calculatedTotalCents = computeStayTotalCents({
        checkInDate,
        checkOutDate,
        isMember: reservationType === "member",
        rates,
      });
      const pricingParsed = parseReservationPricingBody(
        { amountCents, amountOverrideCents: body.amountOverrideCents, overrideReason: body.overrideReason },
        calculatedTotalCents
      );
      if (!pricingParsed.ok) {
        return NextResponse.json({ error: pricingParsed.error }, { status: 400 });
      }
      metadata.calculated_total_cents = String(pricingParsed.pricing.calculatedTotalCents);
      metadata.effective_total_cents = String(pricingParsed.pricing.effectiveTotalCents);
      metadata.price_override_flag = pricingParsed.pricing.priceOverrideFlag ? "true" : "false";
      if (pricingParsed.pricing.amountOverrideCents != null) {
        metadata.amount_override_cents = String(pricingParsed.pricing.amountOverrideCents);
      }
      if (pricingParsed.pricing.overrideReason) {
        metadata.override_reason = pricingParsed.pricing.overrideReason;
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
    }
  } else {
    metadata.maintenance_amount_cents = String(body.maintenanceAmountCents ?? 0);
    metadata.membership_amount_cents = String(body.membershipAmountCents ?? 0);
    metadata.member_contact_id = (body.memberContactId ?? "").toString().trim();
    metadata.member_number = (body.memberNumber ?? "").toString().trim();
  }

  const lineLabel =
    paymentType === "reservation"
      ? metadata.payment_only === "true"
        ? "Camp site fee"
        : "Camp reservation"
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
