import { NextResponse } from "next/server";
import { getCaretakerAccess } from "@/lib/caretaker-auth";
import { fetchSiteArByCamp } from "@/lib/caretaker-site-ar";

/**
 * GET /api/members/caretaker/admin/site-ar
 * Site-fee accounts receivable by camp (admin read-only).
 */
export async function GET() {
  const access = await getCaretakerAccess();
  if (!access || access.mode !== "admin") {
    return NextResponse.json({ error: "Caretaker admin access required" }, { status: 403 });
  }

  const camps = await fetchSiteArByCamp();
  const totals = camps.reduce(
    (acc, c) => ({
      balanceDueCents: acc.balanceDueCents + c.balanceDueCents,
      overdueCents: acc.overdueCents + c.overdueCents,
      reservationsWithBalance: acc.reservationsWithBalance + c.reservationsWithBalance,
      overdueReservations: acc.overdueReservations + c.overdueReservations,
    }),
    { balanceDueCents: 0, overdueCents: 0, reservationsWithBalance: 0, overdueReservations: 0 }
  );

  return NextResponse.json({ camps, totals });
}
