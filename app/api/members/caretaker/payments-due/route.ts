import { NextResponse } from "next/server";
import { getCaretakerContext } from "@/lib/caretaker-auth";
import { campUsesReservations } from "@/lib/reservation-camps";
import { fetchPaymentsDueForCamp } from "@/lib/caretaker-site-ar";

/**
 * GET /api/members/caretaker/payments-due
 * Site fees due within 7 days or overdue for this camp.
 */
export async function GET() {
  const caretaker = await getCaretakerContext();
  if (!caretaker) {
    return NextResponse.json({ error: "Caretaker access required" }, { status: 403 });
  }
  if (!campUsesReservations(caretaker.campSlug)) {
    return NextResponse.json({ items: [] });
  }

  const items = await fetchPaymentsDueForCamp(caretaker.campSlug, 7);
  return NextResponse.json({ items });
}
