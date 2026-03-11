import { NextRequest, NextResponse } from "next/server";
import { getCaretakerContext } from "@/lib/caretaker-auth";
import { sql, hasDb } from "@/lib/db";
import { campUsesReservations } from "@/lib/reservation-camps";
import { lookupMember } from "@/lib/salesforce";
import { computeReservationTotalCents } from "@/lib/reservation-pricing";
import {
  sendCaretakerCheckInWelcomeEmail,
  sendCaretakerGuestCheckInWelcomeEmail,
  sendPaymentReceiptEmail,
  sendReservationModifiedEmail,
} from "@/lib/sendgrid";
import { syncReservationToKlaviyo } from "@/lib/klaviyo-camp-stay";

type ReservationRow = {
  id: string;
  site_id: string;
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
};

function rowToJson(row: ReservationRow) {
  return {
    id: row.id,
    siteId: row.site_id,
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
  };
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Normalize DB date (string or Date) to YYYY-MM-DD. */
function toDateOnlyStr(val: string | Date | null | undefined): string {
  if (val == null) return "";
  if (typeof val === "string") return val.slice(0, 10);
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val).slice(0, 10);
}

/**
 * PATCH /api/members/caretaker/reservations/[id]
 * Body: { checkInDate?: "YYYY-MM-DD", checkOutDate?: "YYYY-MM-DD", checkIn?: true } — update dates and/or mark as checked in.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Reservation id required" }, { status: 400 });
  }

  let body: {
    checkInDate?: string;
    checkOutDate?: string;
    checkIn?: boolean;
    paymentMethod?: string;
    amountCents?: number;
    recipientEmail?: string;
    recipientDisplayName?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const existing = await sql`
    SELECT id, site_id, camp_slug, check_in_date, check_out_date, nights, status,
           reservation_type, member_contact_id, member_number, member_display_name, guest_first_name, guest_last_name, guest_email, guest_phone
    FROM camp_reservations
    WHERE id = ${id} AND camp_slug = ${caretaker.campSlug}
    LIMIT 1
  `;
  const existingArr = Array.isArray(existing) ? existing : [];
  type ExistingRow = {
    site_id: string;
    check_in_date: string;
    check_out_date: string;
    nights: number;
    status: string;
    reservation_type: string;
    member_contact_id: string | null;
    member_number: string | null;
    member_display_name: string | null;
    guest_first_name: string | null;
    guest_last_name: string | null;
    guest_email: string | null;
    guest_phone: string | null;
  };
  const existingRow = existingArr[0] as ExistingRow | undefined;
  if (!existingRow) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }
  if (existingRow.status === "cancelled") {
    return NextResponse.json({ error: "Cannot update cancelled reservation" }, { status: 400 });
  }

  const setCheckInRequested = body.checkIn === true;
  if (setCheckInRequested) {
    const today = new Date().toISOString().slice(0, 10);
    const effectiveCheckIn = typeof body.checkInDate === "string" && DATE_REGEX.test(body.checkInDate.trim())
      ? body.checkInDate.trim().slice(0, 10)
      : toDateOnlyStr(existingRow.check_in_date);
    if (effectiveCheckIn && today < effectiveCheckIn) {
      return NextResponse.json(
        { error: "Check-in is only allowed on or after the reservation check-in date. Edit the reservation to move the check-in date earlier if needed." },
        { status: 400 }
      );
    }
  }

  // Resolve new check-in and check-out (from body or keep existing); normalize DB dates (may be Date objects)
  const checkInCandidate = typeof body.checkInDate === "string" && DATE_REGEX.test(body.checkInDate.trim()) ? body.checkInDate.trim() : null;
  const checkOutCandidate = typeof body.checkOutDate === "string" && DATE_REGEX.test(body.checkOutDate.trim()) ? body.checkOutDate.trim() : null;
  const newCheckIn = checkInCandidate ?? toDateOnlyStr(existingRow.check_in_date);
  const newCheckOut = checkOutCandidate ?? toDateOnlyStr(existingRow.check_out_date);

  if (newCheckIn >= newCheckOut) {
    return NextResponse.json({ error: "Check-out date must be after check-in date" }, { status: 400 });
  }

  const datesChanged = checkInCandidate !== null || checkOutCandidate !== null;
  const today = new Date().toISOString().slice(0, 10);
  const reservationCheckIn = toDateOnlyStr(existingRow.check_in_date);

  if (datesChanged) {
    const overlap = await sql`
      SELECT id FROM camp_reservations
      WHERE site_id = ${existingRow.site_id}
        AND id != ${id}
        AND status != 'cancelled'
        AND check_in_date < ${newCheckOut}
        AND check_out_date > ${newCheckIn}
      LIMIT 1
    `;
    if (Array.isArray(overlap) && overlap.length > 0) {
      return NextResponse.json({ error: "Site is not available for the new dates" }, { status: 400 });
    }
    const checkIn = new Date(newCheckIn);
    const checkOut = new Date(newCheckOut);
    const newNights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (24 * 60 * 60 * 1000)));
    const oldNights = existingRow.nights ?? 1;

    const siteRates = await sql`
      SELECT member_rate_daily, non_member_rate_daily FROM camp_sites WHERE id = ${existingRow.site_id} LIMIT 1
    `;
    const rates = (Array.isArray(siteRates) ? siteRates : [])[0] as { member_rate_daily: number | null; non_member_rate_daily: number | null } | undefined;
    const isMember = existingRow.reservation_type === "member";
    const oldTotalCents = computeReservationTotalCents(
      oldNights,
      null,
      isMember,
      rates?.member_rate_daily ?? null,
      rates?.non_member_rate_daily ?? null
    );
    const newTotalCents = computeReservationTotalCents(
      newNights,
      null,
      isMember,
      rates?.member_rate_daily ?? null,
      rates?.non_member_rate_daily ?? null
    );
    const differenceCents = newTotalCents - oldTotalCents;

    if (differenceCents > 0) {
      const paymentMethod = body.paymentMethod === "cash" ? "cash" : null;
      const cashAllowed = reservationCheckIn <= today;
      if (!paymentMethod) {
        return NextResponse.json(
          {
            error: cashAllowed
              ? "Additional nights require payment. Pay with cash here or use card."
              : "Additional nights require payment. Card only (cash allowed when check-in is today or in the past).",
            amountDueCents: differenceCents,
            requirePayment: true,
          },
          { status: 400 }
        );
      }
      if (paymentMethod === "cash" && !cashAllowed) {
        return NextResponse.json(
          { error: "Cash only allowed when reservation check-in is today or in the past. Use card for this change." },
          { status: 400 }
        );
      }
      const amountCents = typeof body.amountCents === "number" ? body.amountCents : 0;
      const recipientEmail = typeof body.recipientEmail === "string" ? body.recipientEmail.trim() : "";
      const recipientDisplayName = typeof body.recipientDisplayName === "string" ? body.recipientDisplayName.trim() : "Guest";
      if (amountCents !== differenceCents || !recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
        return NextResponse.json(
          { error: `Valid payment required: $${(differenceCents / 100).toFixed(2)} for additional nights`, amountDueCents: differenceCents },
          { status: 400 }
        );
      }

      await sql`
        INSERT INTO camp_payments (
          camp_slug, payment_type, method, amount_cents, reservation_id,
          member_contact_id, member_number, member_email, recipient_display_name,
          created_by_contact_id, created_at
        )
        VALUES (
          ${caretaker.campSlug}, 'reservation', 'cash', ${amountCents}, ${id},
          ${existingRow.member_contact_id}, ${existingRow.member_number}, ${recipientEmail}, ${recipientDisplayName},
          ${caretaker.contactId}, NOW()
        )
      `;
      const receiptSent = await sendPaymentReceiptEmail(
        recipientEmail,
        caretaker.campName,
        [{ label: "Additional nights (reservation extension)", amountCents }],
        amountCents,
        "cash",
        today
      ).catch((e) => {
        console.error("[caretaker] payment receipt email failed:", e);
        return false;
      });
      if (receiptSent) {
        await sql`
          UPDATE camp_payments SET receipt_sent_at = NOW()
          WHERE id = (SELECT id FROM camp_payments WHERE reservation_id = ${id} AND method = 'cash' ORDER BY created_at DESC LIMIT 1)
        `;
      }
    }

    await sql`
      UPDATE camp_reservations
      SET check_in_date = ${newCheckIn}, check_out_date = ${newCheckOut}, nights = ${newNights}, updated_at = NOW()
      WHERE id = ${id}
    `;

    const siteRes = await sql`SELECT name FROM camp_sites WHERE id = ${existingRow.site_id} LIMIT 1`;
    const siteName = ((Array.isArray(siteRes) ? siteRes : []) as { name: string }[])[0]?.name ?? "Site";
    if (existingRow.reservation_type === "member" && existingRow.member_number) {
      try {
        const member = await lookupMember(existingRow.member_number);
        const email = member.valid && member.email?.trim() ? member.email.trim() : null;
        if (email) {
          await sendReservationModifiedEmail(
            email,
            caretaker.campName,
            siteName,
            newCheckIn,
            newCheckOut,
            existingRow.member_display_name || `#${existingRow.member_number}`
          );
        }
      } catch (e) {
        console.error("[caretaker] reservation modified email failed:", e);
      }
    } else if (existingRow.reservation_type === "guest" && existingRow.guest_email) {
      try {
        await sendReservationModifiedEmail(
          existingRow.guest_email,
          caretaker.campName,
          siteName,
          newCheckIn,
          newCheckOut,
          existingRow.guest_first_name || "Guest"
        );
      } catch (e) {
        console.error("[caretaker] reservation modified email failed:", e);
      }
    }
  }

  const setCheckIn = body.checkIn === true;
  const emailCheckIn = toDateOnlyStr(datesChanged ? newCheckIn : existingRow.check_in_date);
  const emailCheckOut = toDateOnlyStr(datesChanged ? newCheckOut : existingRow.check_out_date);

  let welcomeEmailSent = false;
  if (setCheckIn) {
    // Send welcome email (await so it completes before response — avoids serverless killing the process)
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ldma-50th.vercel.app";
    if (existingRow.reservation_type === "member" && existingRow.member_number) {
      try {
        const member = await lookupMember(String(existingRow.member_number).trim());
        const email = member.valid && member.email?.trim() ? member.email.trim() : null;
        if (email) {
          const sent = await sendCaretakerCheckInWelcomeEmail(
            email,
            caretaker.campName,
            existingRow.member_display_name || `#${existingRow.member_number}`,
            emailCheckIn,
            emailCheckOut
          );
          welcomeEmailSent = sent;
        } else {
          console.warn("[caretaker] Check-in welcome email skipped: no email on file for member", existingRow.member_number);
        }
      } catch (e) {
        console.error("[caretaker] reservation check-in welcome email failed:", e);
      }
    } else if (existingRow.reservation_type === "guest" && existingRow.guest_email) {
      try {
        const sent = await sendCaretakerGuestCheckInWelcomeEmail(
          existingRow.guest_email,
          caretaker.campName,
          existingRow.guest_first_name || "Guest",
          emailCheckIn,
          emailCheckOut,
          baseUrl
        );
        welcomeEmailSent = sent;
      } catch (e) {
        console.error("[caretaker] reservation check-in welcome email failed:", e);
      }
    }
  }

  if (setCheckIn) {
    await sql`
      UPDATE camp_reservations
      SET status = 'checked_in', checked_in_at = COALESCE(checked_in_at, NOW()), updated_at = NOW()
      WHERE id = ${id}
    `;
  }

  const updated = await sql`
    SELECT id, site_id, camp_slug, check_in_date, check_out_date, nights,
           reservation_type, member_contact_id, member_number, member_display_name,
           guest_first_name, guest_last_name, guest_email, guest_phone,
           status, checked_in_at, created_at, updated_at
    FROM camp_reservations WHERE id = ${id} LIMIT 1
  `;
  const row = (Array.isArray(updated) ? updated : [])[0] as ReservationRow | undefined;
  if (!row) return NextResponse.json({ ok: true, id, welcomeEmailSent: setCheckIn ? welcomeEmailSent : undefined });
  syncReservationToKlaviyo(row).catch((e) => console.error("[Klaviyo] sync after PATCH:", e));
  const payload = rowToJson(row) as Record<string, unknown>;
  if (setCheckIn) payload.welcomeEmailSent = welcomeEmailSent;
  return NextResponse.json(payload);
  } catch (e) {
    console.error("[caretaker] PATCH reservation error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Check-in or update failed" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/members/caretaker/reservations/[id]
 * Cancel reservation (set status = cancelled).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Reservation id required" }, { status: 400 });
  }

  const existing = await sql`
    SELECT id, camp_slug, check_out_date, reservation_type, member_number, member_display_name,
           guest_email, guest_first_name, guest_last_name, status
    FROM camp_reservations
    WHERE id = ${id} AND camp_slug = ${caretaker.campSlug}
    LIMIT 1
  `;
  const existingRow = (Array.isArray(existing) ? existing : [])[0] as {
    id: string;
    camp_slug: string;
    check_out_date: string;
    reservation_type: string;
    member_number: string | null;
    member_display_name: string | null;
    guest_email: string | null;
    guest_first_name: string | null;
    guest_last_name: string | null;
    status: string;
  } | undefined;
  if (!existingRow) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  await sql`
    UPDATE camp_reservations
    SET status = 'cancelled', updated_at = NOW()
    WHERE id = ${id}
  `;

  syncReservationToKlaviyo({ ...existingRow, status: "cancelled" }).catch((e) =>
    console.error("[Klaviyo] sync after cancel:", e)
  );

  return NextResponse.json({ ok: true, cancelled: true });
}
