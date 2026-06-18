import { NextRequest, NextResponse } from "next/server";
import { getCaretakerAccess, CARETAKER_ADMIN_CAMP_COOKIE } from "@/lib/caretaker-auth";
import { getValidCampSlugs } from "@/lib/directory-camps";

/**
 * POST — enter caretaker portal view for a camp (directors only).
 * DELETE — return to director dashboard.
 */
export async function POST(request: NextRequest) {
  const access = await getCaretakerAccess();
  if (!access || access.mode !== "admin") {
    return NextResponse.json({ error: "Director access required" }, { status: 403 });
  }

  let body: { campSlug?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const campSlug = typeof body.campSlug === "string" ? body.campSlug.trim() : "";
  if (!campSlug || !getValidCampSlugs().includes(campSlug)) {
    return NextResponse.json({ error: "Valid campSlug required" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true, campSlug });
  res.cookies.set(CARETAKER_ADMIN_CAMP_COOKIE, campSlug, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}

export async function DELETE() {
  const access = await getCaretakerAccess();
  if (!access || access.mode !== "admin") {
    return NextResponse.json({ error: "Director access required" }, { status: 403 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(CARETAKER_ADMIN_CAMP_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
