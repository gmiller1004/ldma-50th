import { NextRequest, NextResponse } from "next/server";
import { getCaretakerWriteContextFromRequest } from "@/lib/caretaker-auth";
import { sql, hasDb } from "@/lib/db";
import { campUsesReservations } from "@/lib/reservation-camps";
import { lookupMemberByContactId, updateContact } from "@/lib/salesforce";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * PATCH /api/members/caretaker/reservations/[id]/contact
 * Link an imported member to Salesforce, or update contact email/phone (member → SF, guest → reservation row).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caretaker = await getCaretakerWriteContextFromRequest(request);
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
  let body: {
    linkMember?: {
      contactId?: string;
      memberNumber?: string;
      memberDisplayName?: string;
    };
    salesforceContact?: {
      email?: string;
      phone?: string;
    };
    guestContact?: {
      email?: string;
      phone?: string;
    };
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rows = await sql`
    SELECT id, reservation_type, member_contact_id, member_number, member_display_name,
           guest_email, guest_phone
    FROM camp_reservations
    WHERE id = ${id} AND camp_slug = ${caretaker.campSlug}
    LIMIT 1
  `;
  const row = (Array.isArray(rows) ? rows[0] : undefined) as
    | {
        id: string;
        reservation_type: string;
        member_contact_id: string | null;
        member_number: string | null;
        member_display_name: string | null;
        guest_email: string | null;
        guest_phone: string | null;
      }
    | undefined;
  if (!row) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  if (body.linkMember) {
    if (row.reservation_type !== "member") {
      return NextResponse.json({ error: "Only member reservations can be linked to Salesforce" }, { status: 400 });
    }
    const contactId = body.linkMember.contactId?.trim() ?? "";
    const memberNumber = body.linkMember.memberNumber?.trim() ?? "";
    const memberDisplayName = body.linkMember.memberDisplayName?.trim() ?? "";
    if (!contactId || !memberNumber || !memberDisplayName) {
      return NextResponse.json({ error: "contactId, memberNumber, and memberDisplayName required" }, { status: 400 });
    }

    const sf = await lookupMemberByContactId(contactId);
    if (sf.status === "not_found") {
      return NextResponse.json({ error: sf.error ?? "Salesforce contact not found" }, { status: 404 });
    }
    if (sf.status !== "found" || !sf.member.valid) {
      return NextResponse.json({ error: "Salesforce contact not found" }, { status: 404 });
    }
    if (sf.member.contactId !== contactId) {
      return NextResponse.json({ error: "Contact mismatch" }, { status: 400 });
    }

    await sql`
      UPDATE camp_reservations
      SET member_contact_id = ${contactId},
          member_number = ${memberNumber},
          member_display_name = ${memberDisplayName},
          updated_at = NOW()
      WHERE id = ${id}
    `;

    return NextResponse.json({
      ok: true,
      memberContactId: contactId,
      memberNumber,
      memberDisplayName,
      email: sf.member.email?.trim() || null,
      phone: sf.member.phone?.trim() || null,
    });
  }

  if (body.salesforceContact) {
    if (row.reservation_type !== "member" || !row.member_contact_id) {
      return NextResponse.json({ error: "Reservation has no linked Salesforce contact" }, { status: 400 });
    }
    const email =
      body.salesforceContact.email !== undefined ? body.salesforceContact.email.trim() : undefined;
    const phone =
      body.salesforceContact.phone !== undefined ? body.salesforceContact.phone.trim() : undefined;
    if (email === undefined && phone === undefined) {
      return NextResponse.json({ error: "Provide email and/or phone to update" }, { status: 400 });
    }
    if (email !== undefined && email && !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const result = await updateContact(row.member_contact_id, { email, phone });
    if (!result.success) {
      return NextResponse.json({ error: result.error ?? "Salesforce update failed" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      email: email ?? null,
      phone: phone ?? null,
    });
  }

  if (body.guestContact) {
    if (row.reservation_type !== "guest") {
      return NextResponse.json({ error: "Guest contact updates apply to guest reservations only" }, { status: 400 });
    }
    const email = body.guestContact.email !== undefined ? body.guestContact.email.trim() : undefined;
    const phone = body.guestContact.phone !== undefined ? body.guestContact.phone.trim() : undefined;
    if (email === undefined && phone === undefined) {
      return NextResponse.json({ error: "Provide email and/or phone to update" }, { status: 400 });
    }
    if (email !== undefined && email && !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const nextEmail = email !== undefined ? email || null : row.guest_email;
    const nextPhone = phone !== undefined ? phone || null : row.guest_phone;

    await sql`
      UPDATE camp_reservations
      SET guest_email = ${nextEmail}, guest_phone = ${nextPhone}, updated_at = NOW()
      WHERE id = ${id}
    `;

    return NextResponse.json({
      ok: true,
      guestEmail: nextEmail,
      guestPhone: nextPhone,
    });
  }

  return NextResponse.json({ error: "No contact update specified" }, { status: 400 });
}
