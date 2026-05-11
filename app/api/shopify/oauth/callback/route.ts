import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { saveShopifyAdminSession } from "@/lib/shopify-admin-session";
import {
  getOAuthRedirectUri,
  normalizeInstallShop,
} from "@/lib/shopify-admin-oauth";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "shopify_admin_oauth_state";

export async function GET(request: Request) {
  const clientId = process.env.SHOPIFY_ADMIN_API_CLIENT_ID?.trim();
  const clientSecret = process.env.SHOPIFY_ADMIN_API_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Shopify Admin OAuth client credentials not configured" },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const oauthError = searchParams.get("error_description") || searchParams.get("error");
  if (oauthError) {
    return NextResponse.json(
      { error: "Shopify OAuth error", detail: oauthError },
      { status: 400 }
    );
  }

  const shop = normalizeInstallShop(searchParams.get("shop"));
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!shop || !code || !state) {
    return NextResponse.json(
      { error: "Missing shop, code, or state" },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  if (!expectedState || expectedState !== state) {
    return NextResponse.json({ error: "Invalid OAuth state" }, { status: 403 });
  }

  const redirectUri = getOAuthRedirectUri();
  if (!redirectUri) {
    return NextResponse.json(
      { error: "Redirect URI not configured (NEXT_PUBLIC_SITE_URL or SHOPIFY_OAUTH_REDIRECT_URI)" },
      { status: 503 }
    );
  }

  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    console.error("[shopify/oauth/callback] token exchange failed:", errText);
    return NextResponse.json(
      { error: "Token exchange failed", detail: errText.slice(0, 500) },
      { status: 502 }
    );
  }

  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
    scope?: string;
  };
  if (!tokenJson.access_token) {
    return NextResponse.json(
      { error: "Token response missing access_token" },
      { status: 502 }
    );
  }

  try {
    await saveShopifyAdminSession(shop, tokenJson.access_token, tokenJson.scope || "");
  } catch (e) {
    console.error("[shopify/oauth/callback] DB save failed:", e);
    return NextResponse.json(
      {
        error:
          "Could not store token (database missing migrations?). Run scripts/migrate-shopify-admin-session.sql via db:migrate.",
      },
      { status: 500 }
    );
  }

  const res = NextResponse.redirect(`https://${shop}/admin/settings/apps`);
  res.cookies.set(STATE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return res;
}
