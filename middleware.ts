import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  GPAA_MREF_COOKIE,
  GPAA_MREF_QUERY_PARAM,
  gpaaMrefCookieOptions,
  sanitizeGpaaMref,
} from "@/lib/gpaa-mref";

// Paths that require member authentication
const MEMBER_ONLY_PREFIXES = ["/directory"];

function requiresAuth(pathname: string): boolean {
  return MEMBER_ONLY_PREFIXES.some((prefix) =>
    pathname === prefix || pathname.startsWith(prefix + "/")
  );
}

function withGpaaMrefCookie(request: NextRequest, response: NextResponse) {
  const mref = sanitizeGpaaMref(request.nextUrl.searchParams.get(GPAA_MREF_QUERY_PARAM));
  if (!mref) return response;
  response.cookies.set(
    GPAA_MREF_COOKIE,
    mref,
    gpaaMrefCookieOptions(request.nextUrl.hostname)
  );
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (requiresAuth(pathname)) {
    const sessionCookie = request.cookies.get("member_session");
    if (!sessionCookie?.value) {
      const loginUrl = new URL("/members/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return withGpaaMrefCookie(request, NextResponse.redirect(loginUrl));
    }
  }

  return withGpaaMrefCookie(request, NextResponse.next());
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml)$).*)",
  ],
};
