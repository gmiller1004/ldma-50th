import { NextRequest, NextResponse } from "next/server";
import { getCaretakerContext, getCaretakerWriteContext } from "@/lib/caretaker-auth";
import { sql, hasDb } from "@/lib/db";
import {
  campUsesReservations,
  caretakerAllowsCashCheckIn,
  caretakerEarliestCheckInDate,
  isNonBookableSite,
} from "@/lib/reservation-camps";
import {
  computeStayTotalCents,
  siteRatesFromRow,
  stayNights,
  syncBillingPeriodsForReservation,
} from "@/lib/reservation-billing";
import { lookupMember } from "@/lib/salesforce";
import { sendPaymentReceiptEmail, sendReservationConfirmationEmail } from "@/lib/sendgrid";
import { syncReservationToKlaviyo } from "@/lib/klaviyo-camp-stay";
import { summarizeReservationBalances } from "@/lib/reservation-billing";
import { parseReservationPricingBody, withReservationInvoice } from "@/lib/reservation-create-metadata";

type ReservationRow = {
  id: string;
  site_id: string;
  site_name?: string;
  camp_slug: string;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  reservation_type: string;
  member_contact_id: string | null;
  member_number: string | null;
  member_display_name: string | null;
  guest_first_name: string | null;
  guest_last_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  status: string;
  checked_in_at: string | null;
  created_at: string;
  updated_at: string;
  event_product_handle?: string | null;
  event_site_type?: string | null;
};

function rowToJson(row: ReservationRow) {
  return {
    id: row.id,
    siteId: row.site_id,
    siteName: row.site_name ?? null,
    campSlug: row.camp_slug,
    checkInDate: row.check_in_date,
    checkOutDate: row.check_out_date,
    nights: row.nights,
    reservationType: row.reservation_type,
    memberContactId: row.member_contact_id,
    memberNumber: row.member_number,
    memberDisplayName: row.member_display_name,
    guestFirstName: row.guest_first_name,
    guestLastName: row.guest_last_name,
    guestEmail: row.guest_email,
    guestPhone: row.guest_phone,
    status: row.status,
    checkedInAt: row.checked_in_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    eventProductHandle: row.event_product_handle ?? null,
    eventSiteType: row.event_site_type ?? null,
  };
}

/**
 * GET /api/members/caretaker/reservations?status=active|archived|all
 */
export async function GET(request: NextRequest) {
  const caretaker = await getCaretakerContext();
  if (!caretaker) {
    return NextResponse.json({ error: "Caretaker access required" }, { status: 403 });
  }
  if (!campUsesReservations(caretaker.campSlug)) {
    return NextResponse.json({ error: "Reservation system not available for this camp" }, { status: 403 });
  }
  if (!hasDb() || !sql) {
    return NextResponse.json({ error: "Database not available" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "active";
  const today = new Date().toISOString().slice(0, 10);

  let rows: ReservationRow[];
  if (status === "active") {
    const r = await sql`
      SELECT r.id, r.site_id, s.name AS site_name, r.camp_slug, r.check_in_date, r.check_out_date, r.nights,
             r.reservation_type, r.member_contact_id, r.member_number, r.member_display_name,
             r.guest_first_name, r.guest_last_name, r.guest_email, r.guest_phone,
             r.status, r.checked_in_at, r.created_at, r.updated_at, r.event_product_handle, r.event_site_type
      FROM camp_reservations r
      LEFT JOIN camp_sites s ON s.id = r.site_id
      WHERE r.camp_slug = ${caretaker.campSlug} AND r.check_out_date >= ${today} AND r.status != 'cancelled'
      ORDER BY r.check_in_date ASC, r.created_at ASC
    `;
    rows = (Array.isArray(r) ? r : []) as ReservationRow[];
  } else if (status === "archived") {
    const r = await sql`
      SELECT r.id, r.site_id, s.name AS site_name, r.camp_slug, r.check_in_date, r.check_out_date, r.nights,
             r.reservation_type, r.member_contact_id, r.member_number, r.member_display_name,
             r.guest_first_name, r.guest_last_name, r.guest_email, r.guest_phone,
             r.status, r.checked_in_at, r.created_at, r.updated_at, r.event_product_handle, r.event_site_type
      FROM camp_reservations r
      LEFT JOIN camp_sites s ON s.id = r.site_id
      WHERE r.camp_slug = ${caretaker.campSlug} AND (r.check_out_date < ${today} OR r.status = 'cancelled')
      ORDER BY r.check_out_date DESC, r.created_at DESC
    `;
    rows = (Array.isArray(r) ? r : []) as ReservationRow[];
  } else {
    const r = await sql`
      SELECT r.id, r.site_id, s.name AS site_name, r.camp_slug, r.check_in_date, r.check_out_date, r.nights,
             r.reservation_type, r.member_contact_id, r.member_number, r.member_display_name,
             r.guest_first_name, r.guest_last_name, r.guest_email, r.guest_phone,
             r.status, r.checked_in_at, r.created_at, r.updated_at, r.event_product_handle, r.event_site_type
      FROM camp_reservations r
      LEFT JOIN camp_sites s ON s.id = r.site_id
      WHERE r.camp_slug = ${caretaker.campSlug}
      ORDER BY r.check_out_date DESC, r.created_at DESC
    `;
    rows = (Array.isArray(r) ? r : []) as ReservationRow[];
  }

  const ids = rows.map((r) => r.id);
  const balanceMap = await summarizeReservationBalances(ids);

  return NextResponse.json({
    reservations: rows.map((row) => {
      const base = rowToJson(row);
      const balance = balanceMap.get(row.id);
      return {
        ...base,
        balanceDueCents: balance?.balanceDueCents ?? 0,
        siteFeesPaidCents: balance?.totalPaidCents ?? 0,
        siteFeesDueCents: balance?.totalDueCents ?? 0,
        hasOverdueSiteFee: balance?.hasOverduePeriod ?? false,
        nextSiteFeeDueDate: balance?.nextDueDate ?? null,
      };
    }),
  });
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function sendReservationConfirmation(
  row: ReservationRow,
  campName: string,
  siteName: string
): Promise<void> {
  if (row.reservation_type === "guest") {
    const email = row.guest_email?.trim();
    if (email && EMAIL_REGEX.test(email)) {
      const name = [row.guest_first_name, row.guest_last_name].filter(Boolean).join(" ").trim() || "Guest";
      await sendReservationConfirmationEmail(email, campName, siteName, row.check_in_date, row.check_out_date, name);
    }
    return;
  }
  const member = await lookupMember(row.member_number ?? "");
  if (member.valid && member.email?.trim()) {
    const name =
      row.member_display_name?.trim() ||
      [member.firstName, member.lastName].filter(Boolean).join(" ").trim() ||
      "Member";
    await sendReservationConfirmationEmail(member.email.trim(), campName, siteName, row.check_in_date, row.check_out_date, name);
  }
}

/**
 * POST /api/members/caretaker/reservations
 * Create reservation with billing periods. Cash when check-in is today or backdated within policy.
 */
export async function POST(request: NextRequest) {
  let body: {
    siteId?: string;
    checkInDate?: string;
    checkOutDate?: string;
    type?: string;
    paymentMethod?: string;
    amountCents?: number;
    recipientEmail?: string;
    recipientDisplayName?: string;
    memberContactId?: string;
    memberNumber?: string;
    memberDisplayName?: string;
    guestFirstName?: string;
    guestLastName?: string;
    guestEmail?: string;
    guestPhone?: string;
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

  const siteId = typeof body.siteId === "string" ? body.siteId.trim() : "";
  const checkInDate = typeof body.checkInDate === "string" ? body.checkInDate.trim() : "";
  const checkOutDate = typeof body.checkOutDate === "string" ? body.checkOutDate.trim() : "";
  const type = body.type === "member" || body.type === "guest" ? body.type : null;

  if (!siteId || !/^\d{4}-\d{2}-\d{2}$/.test(checkInDate) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOutDate)) {
    return NextResponse.json(
      { error: "siteId, checkInDate, checkOutDate required (YYYY-MM-DD)" },
      { status: 400 }
    );
  }
  if (checkInDate >= checkOutDate) {
    return NextResponse.json({ error: "checkOutDate must be after checkInDate" }, { status: 400 });
  }
  if (!type) {
    return NextResponse.json({ error: "type required: 'member' or 'guest'" }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const earliestCheckIn = caretakerEarliestCheckInDate(today);
  if (checkInDate < earliestCheckIn) {
    return NextResponse.json(
      { error: `Check-in cannot be more than ${earliestCheckIn === today ? "0" : "7"} days in the past` },
      { status: 400 }
    );
  }

  const nights = stayNights(checkInDate, checkOutDate);

  const siteRows = await sql`
    SELECT id, name, site_type, site_code, member_rate_daily, member_rate_monthly, non_member_rate_daily
    FROM camp_sites WHERE id = ${siteId} AND camp_slug = ${caretaker.campSlug} LIMIT 1
  `;
  const siteRow = (Array.isArray(siteRows) ? siteRows : [])[0] as {
    id: string;
    name: string;
    site_type: string;
    site_code: string | null;
    member_rate_daily: number | null;
    member_rate_monthly: number | null;
    non_member_rate_daily: number | null;
  } | undefined;
  if (!siteRow) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }
  if (isNonBookableSite(caretaker.campSlug, siteRow.name, siteRow.site_code)) {
    return NextResponse.json(
      { error: "This site is reserved for caretaker use and cannot be booked." },
      { status: 400 }
    );
  }

  const rates = siteRatesFromRow(siteRow);
  const isMember = type === "member";
  const totalDueCents = computeStayTotalCents({ checkInDate, checkOutDate, isMember, rates });

  const pricingParsed = parseReservationPricingBody(body, totalDueCents < 1 ? 0 : totalDueCents);
  if (!pricingParsed.ok) {
    return NextResponse.json({ error: pricingParsed.error }, { status: 400 });
  }
  const pricing = await withReservationInvoice(caretaker.campSlug, pricingParsed.pricing);
  const payCents = pricingParsed.paymentAmountCents;
  const isComp = pricing.effectiveTotalCents === 0;

  if (!isComp && totalDueCents < 1) {
    return NextResponse.json({ error: "Site rates are not configured for this site" }, { status: 400 });
  }

  const paymentMethod =
    body.paymentMethod === "cash" ? "cash" : body.paymentMethod === "none" ? "none" : null;
  if (!isComp) {
    if (!paymentMethod || paymentMethod === "none") {
      return NextResponse.json(
        { error: "Payment required. For same-day or recent check-in pay cash; otherwise use card checkout." },
        { status: 400 }
      );
    }
    if (!caretakerAllowsCashCheckIn(checkInDate, today)) {
      return NextResponse.json(
        { error: "Cash payment is only allowed when check-in is today or within the past 7 days. Use card for future check-in." },
        { status: 400 }
      );
    }
  }

  const recipientEmail = typeof body.recipientEmail === "string" ? body.recipientEmail.trim() : "";
  const recipientDisplayName =
    typeof body.recipientDisplayName === "string" ? body.recipientDisplayName.trim() : "Guest";
  if (!isComp && (payCents < 0 || payCents > pricing.effectiveTotalCents)) {
    return NextResponse.json(
      { error: `Payment must be between $0.00 and $${(pricing.effectiveTotalCents / 100).toFixed(2)}` },
      { status: 400 }
    );
  }
  if (!isComp && (!recipientEmail || !EMAIL_REGEX.test(recipientEmail))) {
    return NextResponse.json({ error: "Valid recipient email required for payment" }, { status: 400 });
  }

  const overlap = await sql`
    SELECT id FROM camp_reservations
    WHERE site_id = ${siteId} AND status != 'cancelled'
      AND check_in_date < ${checkOutDate} AND check_out_date > ${checkInDate}
    LIMIT 1
  `;
  if (Array.isArray(overlap) && overlap.length > 0) {
    return NextResponse.json({ error: "Site is not available for the selected dates" }, { status: 400 });
  }

  let row: ReservationRow | undefined;

  if (type === "member") {
    const memberContactId = typeof body.memberContactId === "string" ? body.memberContactId.trim() : "";
    const memberNumber = typeof body.memberNumber === "string" ? body.memberNumber.trim() : "";
    const memberDisplayName = typeof body.memberDisplayName === "string" ? body.memberDisplayName.trim() : null;
    if (!memberContactId || !memberNumber) {
      return NextResponse.json({ error: "memberContactId and memberNumber required for member reservation" }, { status: 400 });
    }
    const inserted = await sql`
      INSERT INTO camp_reservations (
        site_id, camp_slug, check_in_date, check_out_date, nights,
        reservation_type, member_contact_id, member_number, member_display_name,
        status, created_by_contact_id,
        invoice_number, calculated_total_cents, amount_override_cents, override_reason, price_override_flag
      )
      VALUES (
        ${siteId}, ${caretaker.campSlug}, ${checkInDate}, ${checkOutDate}, ${nights},
        'member', ${memberContactId}, ${memberNumber}, ${memberDisplayName},
        'reserved', ${caretaker.contactId},
        ${pricing.invoiceNumber}, ${pricing.calculatedTotalCents}, ${pricing.amountOverrideCents},
        ${pricing.overrideReason}, ${pricing.priceOverrideFlag}
      )
      RETURNING id, site_id, camp_slug, check_in_date, check_out_date, nights,
                reservation_type, member_contact_id, member_number, member_display_name,
                guest_first_name, guest_last_name, guest_email, guest_phone,
                status, checked_in_at, created_at, updated_at
    `;
    row = (Array.isArray(inserted) ? inserted : [])[0] as ReservationRow | undefined;
    if (!row) return NextResponse.json({ error: "Insert failed" }, { status: 500 });

    if (payCents > 0) {
      await sql`
        INSERT INTO camp_payments (
          camp_slug, payment_type, method, amount_cents, reservation_id,
          member_contact_id, member_number, member_email, recipient_display_name,
          invoice_number, created_by_contact_id, created_at
        )
        VALUES (
          ${caretaker.campSlug}, 'reservation', 'cash', ${payCents}, ${row.id},
          ${memberContactId}, ${memberNumber}, ${recipientEmail}, ${recipientDisplayName},
          ${pricing.invoiceNumber}, ${caretaker.contactId}, NOW()
        )
      `;
    }
  } else {
    const guestFirstName = typeof body.guestFirstName === "string" ? body.guestFirstName.trim() : "";
    const guestLastName = typeof body.guestLastName === "string" ? body.guestLastName.trim() : "";
    const guestEmail = typeof body.guestEmail === "string" ? body.guestEmail.trim() : "";
    const guestPhone = typeof body.guestPhone === "string" ? body.guestPhone.trim() || null : null;
    if (!guestFirstName || !guestLastName || !guestEmail || !EMAIL_REGEX.test(guestEmail)) {
      return NextResponse.json(
        { error: "guestFirstName, guestLastName, and valid guestEmail required for guest reservation" },
        { status: 400 }
      );
    }
    const inserted = await sql`
      INSERT INTO camp_reservations (
        site_id, camp_slug, check_in_date, check_out_date, nights,
        reservation_type, guest_first_name, guest_last_name, guest_email, guest_phone,
        status, created_by_contact_id,
        invoice_number, calculated_total_cents, amount_override_cents, override_reason, price_override_flag
      )
      VALUES (
        ${siteId}, ${caretaker.campSlug}, ${checkInDate}, ${checkOutDate}, ${nights},
        'guest', ${guestFirstName}, ${guestLastName}, ${guestEmail}, ${guestPhone},
        'reserved', ${caretaker.contactId},
        ${pricing.invoiceNumber}, ${pricing.calculatedTotalCents}, ${pricing.amountOverrideCents},
        ${pricing.overrideReason}, ${pricing.priceOverrideFlag}
      )
      RETURNING id, site_id, camp_slug, check_in_date, check_out_date, nights,
                reservation_type, member_contact_id, member_number, member_display_name,
                guest_first_name, guest_last_name, guest_email, guest_phone,
                status, checked_in_at, created_at, updated_at
    `;
    row = (Array.isArray(inserted) ? inserted : [])[0] as ReservationRow | undefined;
    if (!row) return NextResponse.json({ error: "Insert failed" }, { status: 500 });

    if (payCents > 0) {
      await sql`
        INSERT INTO camp_payments (
          camp_slug, payment_type, method, amount_cents, reservation_id,
          member_email, recipient_display_name, invoice_number,
          created_by_contact_id, created_at
        )
        VALUES (
          ${caretaker.campSlug}, 'reservation', 'cash', ${payCents}, ${row.id},
          ${recipientEmail}, ${recipientDisplayName}, ${pricing.invoiceNumber},
          ${caretaker.contactId}, NOW()
        )
      `;
    }
  }

  await syncBillingPeriodsForReservation({
    reservationId: row.id,
    checkInDate,
    checkOutDate,
    isMember,
    rates,
    effectiveTotalCents: pricing.effectiveTotalCents,
  });

  syncReservationToKlaviyo(row).catch((e) => console.error("[Klaviyo] sync after create:", e));

  const siteNameRows = await sql`SELECT name FROM camp_sites WHERE id = ${row.site_id} LIMIT 1`;
  const siteName = (Array.isArray(siteNameRows) ? siteNameRows[0] : undefined) as { name: string } | undefined;
  const siteNameStr = siteName?.name ?? "Site";

  const reservationDetails = {
    recipientName:
      row.reservation_type === "member"
        ? row.member_display_name?.trim() || "Member"
        : [row.guest_first_name, row.guest_last_name].filter(Boolean).join(" ").trim() || "Guest",
    checkInDate: row.check_in_date,
    checkOutDate: row.check_out_date,
    siteName: siteNameStr,
  };
  const receiptSent =
    payCents > 0
      ? await sendPaymentReceiptEmail(
          recipientEmail,
          caretaker.campName,
          [{ label: "Camp site fee", amountCents: payCents }],
          payCents,
          "cash",
          today,
          reservationDetails
        ).catch((e) => {
          console.error("[caretaker] payment receipt email failed:", e);
          return false;
        })
      : false;
  if (receiptSent) {
    await sql`
      UPDATE camp_payments SET receipt_sent_at = NOW()
      WHERE id = (SELECT id FROM camp_payments WHERE reservation_id = ${row.id} AND method = 'cash' ORDER BY created_at DESC LIMIT 1)
    `;
  }
  sendReservationConfirmation(row, caretaker.campName, siteNameStr).catch((e) =>
    console.error("[caretaker] reservation confirmation email failed:", e)
  );

  return NextResponse.json(rowToJson({ ...row, site_name: siteNameStr }), { status: 201 });
}
