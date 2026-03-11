import { NextRequest, NextResponse } from "next/server";
import { getCaretakerContext } from "@/lib/caretaker-auth";
import { sql, hasDb } from "@/lib/db";
import { campUsesReservations } from "@/lib/reservation-camps";
import { sendPaymentReceiptEmail } from "@/lib/sendgrid";

/**
 * POST /api/members/caretaker/payments/record-cash
 * Record a cash payment for past-due (maintenance/membership). Sends receipt (CC gricci@goldprospectors.org).
 * Body: { paymentType: 'past_due', amountCents, maintenanceAmountCents, membershipAmountCents, memberContactId, memberNumber, recipientEmail, recipientDisplayName }
 */
export async function POST(request: NextRequest) {
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

  let body: {
    paymentType?: string;
    amountCents?: number;
    maintenanceAmountCents?: number;
    membershipAmountCents?: number;
    memberContactId?: string;
    memberNumber?: string;
    recipientEmail?: string;
    recipientDisplayName?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.paymentType !== "past_due") {
    return NextResponse.json({ error: "paymentType must be 'past_due'" }, { status: 400 });
  }

  const amountCents = typeof body.amountCents === "number" ? body.amountCents : 0;
  const maintenanceAmountCents = typeof body.maintenanceAmountCents === "number" ? body.maintenanceAmountCents : 0;
  const membershipAmountCents = typeof body.membershipAmountCents === "number" ? body.membershipAmountCents : 0;
  const memberContactId = typeof body.memberContactId === "string" ? body.memberContactId.trim() || null : null;
  const memberNumber = typeof body.memberNumber === "string" ? body.memberNumber.trim() || null : null;
  const recipientEmail = typeof body.recipientEmail === "string" ? body.recipientEmail.trim() : "";
  const recipientDisplayName = typeof body.recipientDisplayName === "string" ? body.recipientDisplayName.trim() : "Guest";

  if (amountCents < 1 || maintenanceAmountCents + membershipAmountCents !== amountCents) {
    return NextResponse.json(
      { error: "amountCents must equal maintenanceAmountCents + membershipAmountCents and be positive" },
      { status: 400 }
    );
  }
  if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    return NextResponse.json({ error: "Valid recipientEmail required" }, { status: 400 });
  }

  const inserted = await sql`
    INSERT INTO camp_payments (
      camp_slug, payment_type, method, amount_cents, reservation_id,
      member_contact_id, member_number, member_email, recipient_display_name,
      maintenance_amount_cents, membership_amount_cents, created_by_contact_id, created_at
    )
    VALUES (
      ${caretaker.campSlug}, 'past_due', 'cash', ${amountCents}, NULL,
      ${memberContactId}, ${memberNumber}, ${recipientEmail}, ${recipientDisplayName},
      ${maintenanceAmountCents}, ${membershipAmountCents}, ${caretaker.contactId}, NOW()
    )
    RETURNING id
  `;
  const row = (Array.isArray(inserted) ? inserted : [])[0] as { id: string } | undefined;
  const paymentId = row?.id;

  const lineItems: { label: string; amountCents: number }[] = [];
  if (maintenanceAmountCents > 0) lineItems.push({ label: "Maintenance", amountCents: maintenanceAmountCents });
  if (membershipAmountCents > 0) lineItems.push({ label: "Membership", amountCents: membershipAmountCents });
  const paymentDate = new Date().toISOString().slice(0, 10);
  const receiptSent = await sendPaymentReceiptEmail(
    recipientEmail,
    caretaker.campName,
    lineItems,
    amountCents,
    "cash",
    paymentDate
  ).catch((e) => {
    console.error("[caretaker] past-due receipt email failed:", e);
    return false;
  });

  if (receiptSent && paymentId) {
    await sql`UPDATE camp_payments SET receipt_sent_at = NOW() WHERE id = ${paymentId}`;
  }

  return NextResponse.json({ ok: true });
}
