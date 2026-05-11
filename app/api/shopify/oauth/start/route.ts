import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import {
  adminOAuthScopes,
  getOAuthRedirectUri,
  normalizeInstallShop,
} from "@/lib/shopify-admin-oauth";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "shopify_admin_oauth_state";

export async function GET(request: Request) {
  const clientId = process.env.SHOPIFY_ADMIN_API_CLIENT_ID?.trim();
  if (!clientId) {
    return NextResponse.json(
      { error: "SHOPIFY_ADMIN_API_CLIENT_ID not configured" },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const shop = normalizeInstallShop(searchParams.get("shop"));
  if (!shop) {
    return NextResponse.json(
      {
        error:
          "Invalid or disallowed shop. Pass ?shop=my-store or ?shop=my-store.myshopify.com matching NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN.",
      },
      { status: 400 }
    );
  }

  const redirectUri = getOAuthRedirectUri();
  if (!redirectUri) {
    return NextResponse.json(
      {
        error:
          "Set SHOPIFY_OAUTH_REDIRECT_URI or NEXT_PUBLIC_SITE_URL so redirect_uri can be built.",
      },
      { status: 503 }
    );
  }

  const state = randomBytes(24).toString("hex");
  const scopes = adminOAuthScopes();

  const authorize = new URL(`https://${shop}/admin/oauth/authorize`);
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("scope", scopes);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("state", state);

  const res = NextResponse.redirect(authorize.toString());
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return res;
}
