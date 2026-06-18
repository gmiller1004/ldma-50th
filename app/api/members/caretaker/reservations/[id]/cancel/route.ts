import { NextRequest, NextResponse } from "next/server";
import { getCaretakerWriteContextFromRequest } from "@/lib/caretaker-auth";
import { campUsesReservations } from "@/lib/reservation-camps";
import { executeCancellation } from "@/lib/cancel-reservation";

/**
 * POST /api/members/caretaker/reservations/[id]/cancel
 * Cancel reservation and process site-fee refund per policy.
 */
export async function POST(
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

  const { id } = await params;
  const result = await executeCancellation({
    reservationId: id,
    campSlug: caretaker.campSlug,
    createdByContactId: caretaker.contactId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, preview: result.preview });
}
