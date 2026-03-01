import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/session";
import { getAuthorizationUrl } from "@/lib/customer-account-api";
import { randomBytes } from "crypto";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("member_session")?.value;
    if (!token) {
      return NextResponse.redirect(new URL("/members/login", getBaseUrl()));
    }

    const session = await verifySessionToken(token);
    if (!session) {
      return NextResponse.redirect(new URL("/members/login", getBaseUrl()));
    }

    const baseUrl = getBaseUrl();
    const redirectUri = `${baseUrl}/api/members/shopify-oauth/callback`;
    const state = `${randomBytes(16).toString("hex")}_${session.memberNumber}`;

    const authUrl = await getAuthorizationUrl(redirectUri, state);
    return NextResponse.redirect(authUrl);
  } catch (e) {
    console.error("[shopify-oauth/start]", e);
    return NextResponse.redirect(new URL("/members/profile?shopify_error=1", getBaseUrl()));
  }
}

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://ldma-50th.vercel.app";
}
