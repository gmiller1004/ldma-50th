import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Paths that require member authentication
const MEMBER_ONLY_PREFIXES = ["/directory"];

function requiresAuth(pathname: string): boolean {
  return MEMBER_ONLY_PREFIXES.some((prefix) =>
    pathname === prefix || pathname.startsWith(prefix + "/")
  );
}

const MAILCHIMP_COOKIE_OPTIONS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
  sameSite: "lax" as const,
};

function setMailchimpCookies(
  response: NextResponse,
  request: NextRequest
): void {
  const mcEid = request.nextUrl.searchParams.get("mc_eid");
  if (mcEid) {
    response.cookies.set("mailchimp_eid", mcEid, MAILCHIMP_COOKIE_OPTIONS);
    const mcCid = request.nextUrl.searchParams.get("mc_cid");
    if (mcCid) {
      response.cookies.set("mailchimp_cid", mcCid, MAILCHIMP_COOKIE_OPTIONS);
    }
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (requiresAuth(pathname)) {
    const sessionCookie = request.cookies.get("member_session");
    if (!sessionCookie?.value) {
      const loginUrl = new URL("/members/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      const redirect = NextResponse.redirect(loginUrl);
      setMailchimpCookies(redirect, request);
      return redirect;
    }
  }

  const res = NextResponse.next();
  setMailchimpCookies(res, request);
  return res;
}

export const config = {
  matcher: [
    "/directory",
    "/directory/:path*",
    "/",
    "/memberships",
    "/memberships/:path*",
    "/shop",
    "/shop/:path*",
    "/members",
    "/members/:path*",
    "/about-events",
    "/customize",
    "/customize/:path*",
  ],
};
