import { NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/customer-account-api";
import { setShopifyOAuthToken } from "@/lib/shopify-tokens";
import { consumeOAuthState } from "@/lib/oauth-state";

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

  const memberNumber = await consumeOAuthState(state);
  if (!memberNumber) {
    console.error("[shopify-oauth/callback] consumeOAuthState returned null for state:", state?.slice(0, 8) + "...");
    return NextResponse.redirect(
      `${doneUrl}?error=${encodeURIComponent("state_invalid: State not found or expired. Try again.")}`
    );
  }

  try {
    const redirectUri = `${baseUrl}/api/members/shopify-oauth/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    await setShopifyOAuthToken(
      memberNumber,
      tokens.access_token,
      expiresAt,
      tokens.refresh_token
    );
    console.log("[shopify-oauth/callback] Stored token for member", memberNumber.slice(0, 2) + "***");

    return NextResponse.redirect(`${doneUrl}?success=1`);
  } catch (e) {
    console.error("[shopify-oauth/callback]", e);
    const msg = e instanceof Error ? e.message : "Token exchange failed";
    const code = msg.toLowerCase().includes("redirect") ? "redirect_uri_mismatch" : "token_exchange_failed";
    return NextResponse.redirect(
      `${doneUrl}?error=${encodeURIComponent(code + ": " + msg)}`
    );
  }
}

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://ldma-50th.vercel.app";
}
