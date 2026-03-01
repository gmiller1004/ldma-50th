import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Paths that require member authentication
const MEMBER_ONLY_PREFIXES = ["/directory"];

function requiresAuth(pathname: string): boolean {
  return MEMBER_ONLY_PREFIXES.some((prefix) =>
    pathname === prefix || pathname.startsWith(prefix + "/")
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!requiresAuth(pathname)) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get("member_session");
  if (!sessionCookie?.value) {
    const loginUrl = new URL("/members/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/directory", "/directory/:path*"],
};
