import { NextRequest, NextResponse } from "next/server";
import { getCaretakerWriteContextFromRequest } from "@/lib/caretaker-auth";
import { campUsesReservations } from "@/lib/reservation-camps";
import { buildCancelPreview } from "@/lib/cancel-reservation";

/**
 * GET /api/members/caretaker/reservations/[id]/cancel-preview?waiveCancellationFee=1
 * Refund preview before cancelling.
 */
export async function GET(
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
  const waive =
    request.nextUrl.searchParams.get("waiveCancellationFee") === "1" ||
    request.nextUrl.searchParams.get("waiveCancellationFee") === "true";
  const preview = await buildCancelPreview(id, caretaker.campSlug, undefined, waive);
  if (!preview) {
    return NextResponse.json({ error: "Reservation not found or already cancelled" }, { status: 404 });
  }

  return NextResponse.json({ preview });
}
