import { NextRequest, NextResponse } from "next/server";
import { getCaretakerContext } from "@/lib/caretaker-auth";
import { campUsesReservations } from "@/lib/reservation-camps";
import { buildCancelPreview } from "@/lib/cancel-reservation";

/**
 * GET /api/members/caretaker/reservations/[id]/cancel-preview
 * Refund preview before cancelling.
 */
export async function GET(
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

  const { id } = await params;
  const preview = await buildCancelPreview(id, caretaker.campSlug);
  if (!preview) {
    return NextResponse.json({ error: "Reservation not found or already cancelled" }, { status: 404 });
  }

  return NextResponse.json({ preview });
}
