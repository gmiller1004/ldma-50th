import { NextRequest, NextResponse } from "next/server";
import { getCaretakerAccess } from "@/lib/caretaker-auth";
import { buildCaretakerAdminSummary } from "@/lib/caretaker-admin-summary";

export async function GET(request: NextRequest) {
  const access = await getCaretakerAccess();
  if (!access || access.mode !== "admin") {
    return NextResponse.json({ error: "Caretaker admin access required" }, { status: 403 });
  }

  const from = request.nextUrl.searchParams.get("revenueFrom")?.trim() ?? "";
  const to = request.nextUrl.searchParams.get("revenueTo")?.trim() ?? "";

  try {
    const payload = await buildCaretakerAdminSummary({
      revenueFrom: from || null,
      revenueTo: to || null,
    });
    return NextResponse.json(payload);
  } catch (e) {
    console.error("[caretaker-admin] summary failed:", e);
    return NextResponse.json({ error: "Failed to load summary" }, { status: 500 });
  }
}
