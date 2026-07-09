import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { cookies } from "next/headers";
import { sql, hasDb } from "@/lib/db";
import { campUsesReservations } from "@/lib/reservation-camps";
import { getCampBySlug, getValidCampSlugs } from "@/lib/directory-camps";
import { verifySessionToken } from "@/lib/session";
import { lookupMember } from "@/lib/salesforce";
import { siteRatesFromRow } from "@/lib/reservation-billing";
import { computeStayPricing } from "@/lib/reservation-pricing";
import {
  buildSiteTypeAvailability,
  computePublicPaymentOptions,
  filterBookableSites,
  firstBillingPeriodCents,
  formatSiteTypeGroupLabel,
  parseSiteTypeGroupKey,
  pickNextAvailableSite,
  PUBLIC_BOOKING_IMPORT_SOURCE,
  type CampSiteRow,
  type ReservationStayRow,
  validatePublicBookingRequest,
} from "@/lib/public-camp-booking";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicBookingActorId(): string {
  return process.env.PUBLIC_BOOKING_ACTOR_CONTACT_ID?.trim() || "public-web-self-service";
}

/**
 * POST /api/camp/booking/checkout
 * Stripe Checkout for public campsite reservation (site type assigned on payment).
 */
export async function POST(request: NextRequest) {
  if (!hasDb() || !sql) {
    return NextResponse.json({ error: "Database not available" }, { status: 503 });
  }

  const secretKey = process.env.STRIPE_RESTRICTED_KEY || process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: "Payments are not configured" }, { status: 503 });
  }

  let body: {
    campSlug?: string;
    checkIn?: string;
    checkOut?: string;
    siteTypeKey?: string;
    paymentOption?: string;
    guestFirstName?: string;
    guestLastName?: string;
    guestEmail?: string;
    guestPhone?: string;
    useMemberRate?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const campSlug = typeof body.campSlug === "string" ? body.campSlug.trim() : "";
  const checkIn = typeof body.checkIn === "string" ? body.checkIn.trim() : "";
  const checkOut = typeof body.checkOut === "string" ? body.checkOut.trim() : "";
  const siteTypeKey = typeof body.siteTypeKey === "string" ? body.siteTypeKey.trim() : "";
  const paymentOption = body.paymentOption === "deposit" ? "deposit" : "full";
  const useMemberRate = body.useMemberRate === true;

  if (!campSlug || !getValidCampSlugs().includes(campSlug)) {
    return NextResponse.json({ error: "Valid camp required" }, { status: 400 });
  }
  if (!campUsesReservations(campSlug)) {
    return NextResponse.json({ error: "Online reservations are not available for this camp" }, { status: 403 });
  }
  if (!siteTypeKey) {
    return NextResponse.json({ error: "Site type is required" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("member_session")?.value;
  const session = token ? await verifySessionToken(token) : null;

  let reservationType: "member" | "guest" = "guest";
  let memberContactId: string | null = null;
  let memberNumber: string | null = null;
  let memberDisplayName: string | null = null;
  let guestFirstName = typeof body.guestFirstName === "string" ? body.guestFirstName.trim() : "";
  let guestLastName = typeof body.guestLastName === "string" ? body.guestLastName.trim() : "";
  let guestEmail = typeof body.guestEmail === "string" ? body.guestEmail.trim() : "";
  const guestPhone = typeof body.guestPhone === "string" ? body.guestPhone.trim() : "";

  if (useMemberRate) {
    if (!session?.memberNumber) {
      return NextResponse.json({ error: "Log in to book at the member rate." }, { status: 401 });
    }
    const member = await lookupMember(session.memberNumber);
    if (!member.valid) {
      return NextResponse.json({ error: "Member account not found. Log in again." }, { status: 401 });
    }
    reservationType = "member";
    memberContactId = member.contactId ?? session.contactId ?? null;
    memberNumber = session.memberNumber;
    memberDisplayName =
      [member.firstName, member.lastName].filter(Boolean).join(" ").trim() || `Member #${memberNumber}`;
    guestEmail = member.email?.trim() || guestEmail;
    guestFirstName = member.firstName?.trim() || guestFirstName;
    guestLastName = member.lastName?.trim() || guestLastName;
  }

  if (!guestEmail || !EMAIL_REGEX.test(guestEmail)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }
  if (reservationType === "guest") {
    if (!guestFirstName || !guestLastName) {
      return NextResponse.json({ error: "First and last name are required" }, { status: 400 });
    }
  }

  const validation = validatePublicBookingRequest({
    campSlug,
    checkIn,
    checkOut,
    reservationType,
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const siteRows = await sql`
    SELECT id, name, site_code, site_type, special_type, sort_order,
           member_rate_daily, member_rate_monthly, non_member_rate_daily
    FROM camp_sites
    WHERE camp_slug = ${campSlug}
    ORDER BY sort_order ASC, name ASC
  `;
  const allSites = (Array.isArray(siteRows) ? siteRows : []) as CampSiteRow[];
  const bookable = filterBookableSites(campSlug, allSites);

  const resRows = await sql`
    SELECT site_id, check_in_date, check_out_date
    FROM camp_reservations
    WHERE camp_slug = ${campSlug} AND status != 'cancelled'
      AND check_in_date < ${checkOut}::date
      AND check_out_date > ${checkIn}::date
  `;
  const reservations = (Array.isArray(resRows) ? resRows : []) as ReservationStayRow[];

  const availability = buildSiteTypeAvailability({
    campSlug,
    checkIn,
    checkOut,
    sites: allSites,
    reservations,
  });
  const typeRow = availability.find((t) => t.siteTypeKey === siteTypeKey);
  if (!typeRow || typeRow.soldOut) {
    return NextResponse.json({ error: "That site type is no longer available for these dates." }, { status: 400 });
  }

  const assignedSite = pickNextAvailableSite(bookable, siteTypeKey, checkIn, checkOut, reservations);
  if (!assignedSite) {
    return NextResponse.json({ error: "That site type is no longer available for these dates." }, { status: 400 });
  }

  const rates = siteRatesFromRow(assignedSite);
  const isMember = reservationType === "member";
  const pricing = computeStayPricing({ checkInDate: checkIn, checkOutDate: checkOut, isMember, rates });
  const firstPeriodCents = firstBillingPeriodCents(checkIn, checkOut, isMember, rates);
  const paymentOptions = computePublicPaymentOptions({
    totalCents: pricing.totalCents,
    firstPeriodCents,
    usesMonthlyMemberRate: pricing.usesMonthlyMemberRate,
    isMember,
  });
  const selectedPayment = paymentOptions.find((o) => o.id === paymentOption) ?? paymentOptions[0];
  if (!selectedPayment || selectedPayment.amountCents < 1) {
    return NextResponse.json({ error: "Invalid payment amount" }, { status: 400 });
  }

  const parsedType = parseSiteTypeGroupKey(siteTypeKey);
  const bookedSiteTypeLabel = formatSiteTypeGroupLabel(parsedType.specialType, parsedType.siteType);
  const camp = getCampBySlug(campSlug);
  const campName = camp?.name ?? campSlug;
  const recipientDisplayName =
    reservationType === "member"
      ? memberDisplayName || "Member"
      : [guestFirstName, guestLastName].filter(Boolean).join(" ").trim() || "Guest";

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  const metadata: Record<string, string> = {
    self_service: "true",
    payment_type: "reservation",
    camp_slug: campSlug,
    camp_name: campName,
    created_by_contact_id: publicBookingActorId(),
    recipient_email: guestEmail,
    recipient_display_name: recipientDisplayName,
    amount_cents: String(selectedPayment.amountCents),
    site_id: assignedSite.id,
    site_type_key: siteTypeKey,
    booked_site_type_label: bookedSiteTypeLabel,
    check_in_date: checkIn,
    check_out_date: checkOut,
    nights: String(validation.nights),
    reservation_type: reservationType,
    calculated_total_cents: String(pricing.totalCents),
    effective_total_cents: String(pricing.totalCents),
    price_override_flag: "false",
    import_source: PUBLIC_BOOKING_IMPORT_SOURCE,
  };

  if (reservationType === "member") {
    metadata.member_contact_id = memberContactId ?? "";
    metadata.member_number = memberNumber ?? "";
    metadata.member_display_name = memberDisplayName ?? "";
  } else {
    metadata.guest_first_name = guestFirstName;
    metadata.guest_last_name = guestLastName;
    metadata.guest_email = guestEmail;
    metadata.guest_phone = guestPhone;
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
            unit_amount: selectedPayment.amountCents,
            product_data: {
              name: `${campName} — Campsite reservation`,
              description: `${bookedSiteTypeLabel} · ${checkIn} to ${checkOut}`,
            },
          },
        },
      ],
      success_url: `${baseUrl}/campgrounds/${campSlug}?reservation=success`,
      cancel_url: `${baseUrl}/campgrounds/${campSlug}?reservation=cancelled`,
      customer_email: guestEmail,
      metadata,
    });

    if (!sessionCheckout.url) {
      return NextResponse.json({ error: "Checkout session has no URL" }, { status: 500 });
    }
    return NextResponse.json({ url: sessionCheckout.url });
  } catch (e) {
    console.error("[public-booking] Stripe checkout error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to start checkout" },
      { status: 500 }
    );
  }
}
