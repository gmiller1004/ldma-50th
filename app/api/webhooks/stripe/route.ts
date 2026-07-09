import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { sql, hasDb } from "@/lib/db";
import { getCampBySlug } from "@/lib/directory-camps";
import { sendPaymentReceiptEmail } from "@/lib/sendgrid";
import { syncReservationToKlaviyo } from "@/lib/klaviyo-camp-stay";
import { sendPublicReservationConfirmationIfPending } from "@/lib/public-booking-confirmation";
import { siteRatesFromRow, syncBillingPeriodsForReservation } from "@/lib/reservation-billing";
import { toDateOnlyStr } from "@/lib/reservation-dates";
import { withReservationInvoice } from "@/lib/reservation-create-metadata";
import {
  filterBookableSites,
  isSiteAvailable,
  pickNextAvailableSite,
  PUBLIC_BOOKING_IMPORT_SOURCE,
  type CampSiteRow,
  type ReservationStayRow,
} from "@/lib/public-camp-booking";

/**
 * POST /api/webhooks/stripe
 * Stripe webhook: verify signature, on checkout.session.completed create camp_payments,
 * create reservation if payment_type=reservation and no reservation_id, send receipt (CC gricci@goldprospectors.org).
 * Requires STRIPE_WEBHOOK_SECRET and raw body (request.text()).
 */
export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[webhook] STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let body: string;
  try {
    body = await request.text();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(process.env.STRIPE_RESTRICTED_KEY || process.env.STRIPE_SECRET_KEY || "");
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (e) {
    console.error("[webhook] Stripe signature verification failed:", e);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== "paid") {
    return NextResponse.json({ received: true });
  }

  const metadata = session.metadata as Record<string, string> | null;
  const isSelfService = metadata?.self_service === "true";
  if (
    !metadata?.payment_type ||
    !metadata?.camp_slug ||
    (!isSelfService && !metadata?.created_by_contact_id) ||
    !metadata?.recipient_email ||
    !metadata?.recipient_display_name
  ) {
    console.error("[webhook] Missing required metadata", {
      payment_type: metadata?.payment_type,
      camp_slug: metadata?.camp_slug,
      self_service: metadata?.self_service,
      recipient_email: metadata?.recipient_email ? "(set)" : "(missing)",
    });
    return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
  }

  console.log(
    `[webhook] checkout.session.completed payment_type=${metadata.payment_type} self_service=${isSelfService} email=${metadata.recipient_email}`
  );

  const createdByContactId = metadata.created_by_contact_id || "public-web-self-service";

  const amountCents = Math.round((session.amount_total ?? 0));
  if (amountCents < 1) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  if (!hasDb() || !sql) {
    console.error("[webhook] Database not available");
    return NextResponse.json({ error: "Database not available" }, { status: 503 });
  }

  const campSlug = metadata.camp_slug;
  const paymentType = metadata.payment_type;
  const recipientEmail = metadata.recipient_email;
  const recipientDisplayName = metadata.recipient_display_name;
  const sessionId = session.id;
  const memberContactId = metadata.member_contact_id ?? null;
  const memberNumber = metadata.member_number ?? null;
  const maintenanceAmountCents =
    paymentType === "past_due" ? parseInt(metadata.maintenance_amount_cents ?? "0", 10) || null : null;
  const membershipAmountCents =
    paymentType === "past_due" ? parseInt(metadata.membership_amount_cents ?? "0", 10) || null : null;

  const isPublicWebBooking = metadata.import_source === PUBLIC_BOOKING_IMPORT_SOURCE;

  let reservationId: string | null = metadata.reservation_id || null;

  const existingPaymentRows = await sql`
    SELECT id, reservation_id, receipt_sent_at
    FROM camp_payments
    WHERE stripe_checkout_session_id = ${sessionId}
    LIMIT 1
  `;
  const existingPayment = (Array.isArray(existingPaymentRows) ? existingPaymentRows[0] : undefined) as
    | { id: string; reservation_id: string | null; receipt_sent_at: string | null }
    | undefined;
  const paymentAlreadyRecorded = Boolean(existingPayment);
  if (existingPayment?.reservation_id) {
    reservationId = existingPayment.reservation_id;
  }
  const receiptAlreadySent = Boolean(existingPayment?.receipt_sent_at);

  // If reservation adjustment (card payment for extended stay), update the reservation dates
  const paymentOnly = metadata.payment_only === "true";
  if (paymentType === "reservation" && reservationId && !paymentOnly) {
    const checkInDate = metadata.check_in_date;
    const checkOutDate = metadata.check_out_date;
    const nights = parseInt(metadata.nights ?? "0", 10) || 1;
    if (checkInDate && checkOutDate && nights >= 1) {
      await sql`
        UPDATE camp_reservations
        SET check_in_date = ${checkInDate}, check_out_date = ${checkOutDate}, nights = ${nights}, updated_at = NOW()
        WHERE id = ${reservationId}
      `;
    }
  }

  let siteRates: ReturnType<typeof siteRatesFromRow> | null = null;
  const siteIdForRates = metadata.site_id;
  if (siteIdForRates) {
    const siteRows = await sql`
      SELECT member_rate_daily, member_rate_monthly, non_member_rate_daily
      FROM camp_sites WHERE id = ${siteIdForRates} LIMIT 1
    `;
    const siteRow = (Array.isArray(siteRows) ? siteRows[0] : undefined) as
      | { member_rate_daily: number | null; member_rate_monthly: number | null; non_member_rate_daily: number | null }
      | undefined;
    if (siteRow) siteRates = siteRatesFromRow(siteRow);
  } else if (reservationId) {
    const siteRows = await sql`
      SELECT s.member_rate_daily, s.member_rate_monthly, s.non_member_rate_daily
      FROM camp_reservations r
      JOIN camp_sites s ON s.id = r.site_id
      WHERE r.id = ${reservationId}
      LIMIT 1
    `;
    const siteRow = (Array.isArray(siteRows) ? siteRows[0] : undefined) as
      | { member_rate_daily: number | null; member_rate_monthly: number | null; non_member_rate_daily: number | null }
      | undefined;
    if (siteRow) siteRates = siteRatesFromRow(siteRow);
  }

  let reservationInvoiceNumber: string | null = null;
  let effectiveTotalCents: number | undefined;
  const pricingMeta = {
    calculatedTotalCents: parseInt(metadata.calculated_total_cents ?? "0", 10) || null,
    amountOverrideCents: metadata.amount_override_cents
      ? parseInt(metadata.amount_override_cents, 10)
      : null,
    overrideReason: metadata.override_reason ?? null,
    priceOverrideFlag: metadata.price_override_flag === "true",
    effectiveTotalCents: parseInt(metadata.effective_total_cents ?? "0", 10) || null,
    invoiceNumber: null as string | null,
  };
  if (pricingMeta.effectiveTotalCents != null && pricingMeta.effectiveTotalCents >= 0) {
    effectiveTotalCents = pricingMeta.effectiveTotalCents;
  } else if (pricingMeta.calculatedTotalCents != null && pricingMeta.calculatedTotalCents > 0) {
    effectiveTotalCents = pricingMeta.calculatedTotalCents;
  }

  // If reservation payment and no existing reservation_id, create the reservation
  if (!paymentAlreadyRecorded && paymentType === "reservation" && !reservationId && !paymentOnly) {
    let siteId = metadata.site_id;
    const checkInDate = metadata.check_in_date;
    const checkOutDate = metadata.check_out_date;
    const nights = parseInt(metadata.nights ?? "0", 10) || 1;
    const reservationType = metadata.reservation_type === "guest" ? "guest" : "member";
    const importSource = metadata.import_source === PUBLIC_BOOKING_IMPORT_SOURCE ? PUBLIC_BOOKING_IMPORT_SOURCE : null;
    const bookedSiteTypeLabel = metadata.booked_site_type_label?.trim() || null;

    if (!siteId || !checkInDate || !checkOutDate) {
      console.error("[webhook] Reservation metadata missing site_id/check_in_date/check_out_date");
      return NextResponse.json({ error: "Invalid reservation metadata" }, { status: 400 });
    }

    if (isSelfService && metadata.site_type_key) {
      const siteRows = await sql`
        SELECT id, name, site_code, site_type, special_type, sort_order,
               member_rate_daily, member_rate_monthly, non_member_rate_daily
        FROM camp_sites WHERE camp_slug = ${campSlug}
        ORDER BY sort_order ASC, name ASC
      `;
      const allSites = (Array.isArray(siteRows) ? siteRows : []) as CampSiteRow[];
      const bookable = filterBookableSites(campSlug, allSites);
      const resRows = await sql`
        SELECT site_id, check_in_date, check_out_date
        FROM camp_reservations
        WHERE camp_slug = ${campSlug} AND status != 'cancelled'
          AND check_in_date < ${checkOutDate}::date
          AND check_out_date > ${checkInDate}::date
      `;
      const reservations = (Array.isArray(resRows) ? resRows : []) as ReservationStayRow[];
      const reassigned = pickNextAvailableSite(
        bookable,
        metadata.site_type_key,
        checkInDate,
        checkOutDate,
        reservations
      );
      if (!reassigned) {
        const fallbackId = metadata.site_id;
        if (fallbackId && isSiteAvailable(fallbackId, checkInDate, checkOutDate, reservations)) {
          console.warn(
            `[webhook] Site type reassignment failed; using checkout site ${fallbackId}`
          );
          siteId = fallbackId;
        } else {
          console.error("[webhook] No site available for public booking type");
          return NextResponse.json({ error: "Site type not available" }, { status: 400 });
        }
      } else {
        siteId = reassigned.id;
      }

      const rateRows = await sql`
        SELECT member_rate_daily, member_rate_monthly, non_member_rate_daily
        FROM camp_sites WHERE id = ${siteId} LIMIT 1
      `;
      const rateRow = (Array.isArray(rateRows) ? rateRows[0] : undefined) as
        | { member_rate_daily: number | null; member_rate_monthly: number | null; non_member_rate_daily: number | null }
        | undefined;
      if (rateRow) siteRates = siteRatesFromRow(rateRow);
    }

    const overlap = await sql`
      SELECT id FROM camp_reservations
      WHERE site_id = ${siteId} AND status != 'cancelled'
        AND check_in_date < ${checkOutDate} AND check_out_date > ${checkInDate}
      LIMIT 1
    `;
    if (Array.isArray(overlap) && overlap.length > 0) {
      if (isSelfService && importSource) {
        const recoverRows = memberNumber?.trim()
          ? await sql`
              SELECT id FROM camp_reservations
              WHERE camp_slug = ${campSlug}
                AND import_source = ${importSource}
                AND check_in_date = ${checkInDate}::date
                AND check_out_date = ${checkOutDate}::date
                AND (guest_email = ${recipientEmail} OR member_number = ${memberNumber.trim()})
                AND created_at >= NOW() - INTERVAL '4 hours'
              ORDER BY created_at DESC
              LIMIT 1
            `
          : await sql`
              SELECT id FROM camp_reservations
              WHERE camp_slug = ${campSlug}
                AND import_source = ${importSource}
                AND check_in_date = ${checkInDate}::date
                AND check_out_date = ${checkOutDate}::date
                AND guest_email = ${recipientEmail}
                AND created_at >= NOW() - INTERVAL '4 hours'
              ORDER BY created_at DESC
              LIMIT 1
            `;
        const recovered = (Array.isArray(recoverRows) ? recoverRows[0] : undefined) as
          | { id: string }
          | undefined;
        if (recovered) {
          console.warn(
            `[webhook] Overlap on retry; reusing existing reservation ${recovered.id} for session ${sessionId}`
          );
          reservationId = recovered.id;
        } else {
          console.error("[webhook] Site no longer available for dates");
          return NextResponse.json({ error: "Site not available" }, { status: 400 });
        }
      } else {
        console.error("[webhook] Site no longer available for dates");
        return NextResponse.json({ error: "Site not available" }, { status: 400 });
      }
    }

    if (!reservationId) {
    const invoicePricing = await withReservationInvoice(campSlug, {
      calculatedTotalCents: pricingMeta.calculatedTotalCents ?? amountCents,
      amountOverrideCents: pricingMeta.amountOverrideCents,
      overrideReason: pricingMeta.overrideReason,
      priceOverrideFlag: pricingMeta.priceOverrideFlag,
      effectiveTotalCents: pricingMeta.effectiveTotalCents ?? pricingMeta.calculatedTotalCents ?? 0,
      invoiceNumber: null,
    });
    reservationInvoiceNumber = invoicePricing.invoiceNumber;
    effectiveTotalCents = invoicePricing.effectiveTotalCents;

    if (reservationType === "member") {
      const memberContactId = metadata.member_contact_id ?? "";
      const memberNumber = metadata.member_number ?? "";
      const memberDisplayName = metadata.member_display_name ?? null;
      const memberEmail = recipientEmail.trim();
      const inserted = await sql`
        INSERT INTO camp_reservations (
          site_id, camp_slug, check_in_date, check_out_date, nights,
          reservation_type, member_contact_id, member_number, member_display_name,
          guest_email,
          status, created_by_contact_id, import_source, booked_site_type_label,
          invoice_number, calculated_total_cents, amount_override_cents, override_reason, price_override_flag
        )
        VALUES (
          ${siteId}, ${campSlug}, ${checkInDate}, ${checkOutDate}, ${nights},
          'member', ${memberContactId}, ${memberNumber}, ${memberDisplayName},
          ${memberEmail},
          'reserved', ${createdByContactId}, ${importSource}, ${bookedSiteTypeLabel},
          ${invoicePricing.invoiceNumber}, ${invoicePricing.calculatedTotalCents},
          ${invoicePricing.amountOverrideCents}, ${invoicePricing.overrideReason}, ${invoicePricing.priceOverrideFlag}
        )
        RETURNING id
      `;
      const row = (Array.isArray(inserted) ? inserted : [])[0] as { id: string } | undefined;
      if (row) reservationId = row.id;
    } else {
      const guestFirstName = metadata.guest_first_name ?? "";
      const guestLastName = metadata.guest_last_name ?? "";
      const guestEmail = metadata.guest_email ?? "";
      const guestPhone = metadata.guest_phone ?? null;
      const inserted = await sql`
        INSERT INTO camp_reservations (
          site_id, camp_slug, check_in_date, check_out_date, nights,
          reservation_type, guest_first_name, guest_last_name, guest_email, guest_phone,
          status, created_by_contact_id, import_source, booked_site_type_label,
          invoice_number, calculated_total_cents, amount_override_cents, override_reason, price_override_flag
        )
        VALUES (
          ${siteId}, ${campSlug}, ${checkInDate}, ${checkOutDate}, ${nights},
          'guest', ${guestFirstName}, ${guestLastName}, ${guestEmail}, ${guestPhone},
          'reserved', ${createdByContactId}, ${importSource}, ${bookedSiteTypeLabel},
          ${invoicePricing.invoiceNumber}, ${invoicePricing.calculatedTotalCents},
          ${invoicePricing.amountOverrideCents}, ${invoicePricing.overrideReason}, ${invoicePricing.priceOverrideFlag}
        )
        RETURNING id
      `;
      const row = (Array.isArray(inserted) ? inserted : [])[0] as { id: string } | undefined;
      if (row) reservationId = row.id;
    }
    }
  } else if (reservationId && paymentType === "reservation") {
    const invRows = await sql`
      SELECT invoice_number FROM camp_reservations WHERE id = ${reservationId} LIMIT 1
    `;
    const inv = (Array.isArray(invRows) ? invRows[0] : undefined) as { invoice_number: string | null } | undefined;
    reservationInvoiceNumber = inv?.invoice_number ?? null;
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  if (!paymentAlreadyRecorded) {
    await sql`
      INSERT INTO camp_payments (
        camp_slug, payment_type, method, amount_cents, stripe_checkout_session_id, stripe_payment_intent_id,
        reservation_id, member_contact_id, member_number, member_email, recipient_display_name,
        maintenance_amount_cents, membership_amount_cents, invoice_number, created_by_contact_id, created_at
      )
      VALUES (
        ${campSlug}, ${paymentType}, 'card', ${amountCents}, ${sessionId}, ${paymentIntentId},
        ${reservationId}, ${memberContactId}, ${memberNumber}, ${recipientEmail}, ${recipientDisplayName},
        ${maintenanceAmountCents}, ${membershipAmountCents}, ${reservationInvoiceNumber}, ${createdByContactId}, NOW()
      )
    `;
  }

  if (paymentType === "reservation" && reservationId && !siteRates) {
    const siteRows = await sql`
      SELECT s.member_rate_daily, s.member_rate_monthly, s.non_member_rate_daily
      FROM camp_reservations r
      JOIN camp_sites s ON s.id = r.site_id
      WHERE r.id = ${reservationId}
      LIMIT 1
    `;
    const siteRow = (Array.isArray(siteRows) ? siteRows[0] : undefined) as
      | { member_rate_daily: number | null; member_rate_monthly: number | null; non_member_rate_daily: number | null }
      | undefined;
    if (siteRow) siteRates = siteRatesFromRow(siteRow);
  }

  if (paymentType === "reservation" && reservationId && siteRates) {
    const resDates = await sql`
      SELECT check_in_date, check_out_date, reservation_type
      FROM camp_reservations WHERE id = ${reservationId} LIMIT 1
    `;
    const resDatesRow = (Array.isArray(resDates) ? resDates[0] : undefined) as
      | { check_in_date: string | Date; check_out_date: string | Date; reservation_type: string }
      | undefined;
    if (resDatesRow) {
      try {
        await syncBillingPeriodsForReservation({
          reservationId,
          checkInDate: toDateOnlyStr(resDatesRow.check_in_date),
          checkOutDate: toDateOnlyStr(resDatesRow.check_out_date),
          isMember: resDatesRow.reservation_type === "member",
          rates: siteRates,
          effectiveTotalCents,
        });
      } catch (e) {
        console.error("[webhook] Billing sync failed (continuing to email):", e);
      }
    }
  }

  if (paymentType === "reservation" && reservationId && hasDb() && sql) {
    const resRow = await sql`
      SELECT camp_slug, check_in_date, check_out_date, nights, reservation_type, member_number, member_display_name,
             guest_email, guest_first_name, guest_last_name, status
      FROM camp_reservations WHERE id = ${reservationId} LIMIT 1
    `;
    const row = (Array.isArray(resRow) ? resRow : [])[0] as Parameters<typeof syncReservationToKlaviyo>[0] | undefined;
    if (row) syncReservationToKlaviyo(row).catch((e) => console.error("[webhook] Klaviyo sync:", e));
  }

  const campName = getCampBySlug(campSlug)?.name ?? campSlug;
  const isReservationAdjustment =
    paymentType === "reservation" && Boolean(metadata.reservation_id) && !paymentOnly;
  const lineItems =
    paymentType === "reservation"
      ? [
          {
            label: paymentOnly
              ? "Camp site fee"
              : isReservationAdjustment
                ? "Additional nights (reservation extension)"
                : "Camp reservation",
            amountCents,
          },
        ]
      : [
          ...(maintenanceAmountCents ? [{ label: "Maintenance", amountCents: maintenanceAmountCents }] : []),
          ...(membershipAmountCents ? [{ label: "Membership", amountCents: membershipAmountCents }] : []),
        ];
  if (lineItems.length === 0) lineItems.push({ label: "Payment", amountCents });

  let reservationDetails: { recipientName: string; checkInDate: string; checkOutDate: string; siteName?: string } | undefined;
  if (paymentType === "reservation" && reservationId && hasDb() && sql) {
    const resDetailRows = await sql`
      SELECT r.check_in_date, r.check_out_date, r.reservation_type, r.member_display_name, r.guest_first_name, r.guest_last_name, r.site_id
      FROM camp_reservations r WHERE r.id = ${reservationId} LIMIT 1
    `;
    const resDetail = (Array.isArray(resDetailRows) ? resDetailRows[0] : undefined) as
      | {
          check_in_date: string | Date;
          check_out_date: string | Date;
          reservation_type: string;
          member_display_name: string | null;
          guest_first_name: string | null;
          guest_last_name: string | null;
          site_id: string;
        }
      | undefined;
    if (resDetail) {
      const recipientName =
        resDetail.reservation_type === "member"
          ? (resDetail.member_display_name?.trim() || "Member")
          : [resDetail.guest_first_name, resDetail.guest_last_name].filter(Boolean).join(" ").trim() || "Guest";
      let siteName: string | undefined;
      if (resDetail.site_id) {
        const siteRows = await sql`SELECT name FROM camp_sites WHERE id = ${resDetail.site_id} LIMIT 1`;
        const siteRow = (Array.isArray(siteRows) ? siteRows[0] : undefined) as { name: string } | undefined;
        siteName = siteRow?.name;
      }
      reservationDetails = {
        recipientName: recipientDisplayName || recipientName,
        checkInDate: toDateOnlyStr(resDetail.check_in_date),
        checkOutDate: toDateOnlyStr(resDetail.check_out_date),
        siteName,
      };
    }
  }

  const paymentDate = new Date().toISOString().slice(0, 10);
  if (!receiptAlreadySent) {
    const receiptSent = await sendPaymentReceiptEmail(
    recipientEmail,
    campName,
    lineItems as { label: string; amountCents: number }[],
    amountCents,
    "card",
    paymentDate,
    reservationDetails ?? null,
    { bccMrs: isSelfService }
    ).catch((e) => {
      console.error("[webhook] Receipt email failed:", e);
      return false;
    });
    if (receiptSent) {
      await sql`
        UPDATE camp_payments SET receipt_sent_at = NOW() WHERE stripe_checkout_session_id = ${sessionId}
      `;
    } else {
      console.error(
        `[webhook] Payment receipt not sent for session ${sessionId} → ${recipientEmail}`
      );
    }
  } else {
    console.log(`[webhook] Receipt already sent for session ${sessionId}`);
  }

  if (isPublicWebBooking && reservationId) {
    const confirmationResult = await sendPublicReservationConfirmationIfPending(reservationId).catch(
      (e) => {
        console.error("[webhook] Public confirmation email error:", e);
        return "failed" as const;
      }
    );
    console.log(
      `[webhook] Public booking confirmation ${confirmationResult} for reservation ${reservationId}`
    );
  }

  return NextResponse.json({ received: true });
}
