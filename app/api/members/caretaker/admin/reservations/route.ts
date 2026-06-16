import { NextRequest, NextResponse } from "next/server";
import { getCaretakerAccess } from "@/lib/caretaker-auth";
import { getValidCampSlugs } from "@/lib/directory-camps";

/**
 * POST /api/members/caretaker/admin/reservations
 * Manual reservation create for any camp (admin). Body: campSlug + same fields as caretaker create.
 */
export async function POST(request: NextRequest) {
  const access = await getCaretakerAccess();
  if (!access || access.mode !== "admin") {
    return NextResponse.json({ error: "Caretaker admin access required" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const campSlug = typeof body.campSlug === "string" ? body.campSlug.trim() : "";
  if (!campSlug || !getValidCampSlugs().includes(campSlug)) {
    return NextResponse.json({ error: "Valid campSlug required" }, { status: 400 });
  }

  const origin = request.nextUrl.origin;
  const res = await fetch(`${origin}/api/members/caretaker/reservations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: request.headers.get("cookie") ?? "",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
