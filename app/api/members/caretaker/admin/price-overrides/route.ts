import { NextResponse } from "next/server";
import { getCaretakerAccess } from "@/lib/caretaker-auth";
import { fetchFlaggedPriceOverrides } from "@/lib/caretaker-site-ar";

/**
 * GET /api/members/caretaker/admin/price-overrides
 * Reservations with caretaker price overrides (admin review).
 */
export async function GET() {
  const access = await getCaretakerAccess();
  if (!access || access.mode !== "admin") {
    return NextResponse.json({ error: "Caretaker admin access required" }, { status: 403 });
  }

  const rows = await fetchFlaggedPriceOverrides(200);
  return NextResponse.json({ overrides: rows });
}
