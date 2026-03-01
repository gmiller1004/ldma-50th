import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/session";
import { exchangeCodeForTokens } from "@/lib/customer-account-api";
import { setShopifyOAuthToken } from "@/lib/shopify-tokens";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = getBaseUrl();
  const doneUrl = `${baseUrl}/members/shopify-oauth/done`;

  if (error) {
    return NextResponse.redirect(
      `${doneUrl}?error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${doneUrl}?error=${encodeURIComponent("Missing code or state")}`
    );
  }

  const parts = state.split("_");
  const memberNumber = parts.length >= 2 ? parts.slice(1).join("_") : null;

  if (!memberNumber) {
    return NextResponse.redirect(
      `${doneUrl}?error=${encodeURIComponent("Invalid state")}`
    );
  }

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("member_session")?.value;
    if (!token) {
      return NextResponse.redirect(
        `${doneUrl}?error=${encodeURIComponent("Session expired")}`
      );
    }

    const session = await verifySessionToken(token);
    if (!session || session.memberNumber !== memberNumber) {
      return NextResponse.redirect(
        `${doneUrl}?error=${encodeURIComponent("Session mismatch")}`
      );
    }

    const redirectUri = `${baseUrl}/api/members/shopify-oauth/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    await setShopifyOAuthToken(
      memberNumber,
      tokens.access_token,
      expiresAt,
      tokens.refresh_token
    );

    return NextResponse.redirect(`${doneUrl}?success=1`);
  } catch (e) {
    console.error("[shopify-oauth/callback]", e);
    const msg = e instanceof Error ? e.message : "Token exchange failed";
    return NextResponse.redirect(
      `${doneUrl}?error=${encodeURIComponent(msg)}`
    );
  }
}

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://ldma-50th.vercel.app";
}
