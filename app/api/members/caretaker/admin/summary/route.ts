import { NextResponse } from "next/server";
import { getCaretakerAccess } from "@/lib/caretaker-auth";
import { buildCaretakerAdminSummary } from "@/lib/caretaker-admin-summary";

export async function GET() {
  const access = await getCaretakerAccess();
  if (!access || access.mode !== "admin") {
    return NextResponse.json({ error: "Caretaker admin access required" }, { status: 403 });
  }

  try {
    const payload = await buildCaretakerAdminSummary();
    return NextResponse.json(payload);
  } catch (e) {
    console.error("[caretaker-admin] summary failed:", e);
    return NextResponse.json({ error: "Failed to load summary" }, { status: 500 });
  }
}
