/**
 * Admin API access for event sync and webhooks enrichment.
 * Priority:
 * 1) SHOPIFY_ADMIN_ACCESS_TOKEN (offline token from OAuth or pasted)
 * 2) Row in shopify_admin_session (OAuth callback wrote here)
 * 3) Client credentials grant (Dev Dashboard app + shop in same org)
 */

import { sql, hasDb } from "@/lib/db";

export const SHOPIFY_ADMIN_REST_API_VERSION =
  process.env.SHOPIFY_ADMIN_API_VERSION || "2026-04";

let cachedToken: { token: string; expiresAt: number } | null = null;

export function getShopifyShopDomain(): string | null {
  const raw =
    process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN?.trim() ||
    process.env.SHOPIFY_SHOP_DOMAIN?.trim();
  if (!raw) return null;
  return raw.replace(/^https?:\/\//, "").split("/")[0].toLowerCase();
}

export async function getShopifyAdminAccessToken(): Promise<string | null> {
  const envTok = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim();
  if (envTok) return envTok;

  const shop = getShopifyShopDomain();
  if (shop && hasDb() && sql) {
    const rows = await sql`
      SELECT access_token FROM shopify_admin_session
      WHERE shop_domain = ${shop} LIMIT 1
    `;
    const row = (Array.isArray(rows) ? rows : [])[0] as
      | { access_token: string }
      | undefined;
    if (row?.access_token) return row.access_token;
  }

  const clientId = process.env.SHOPIFY_ADMIN_API_CLIENT_ID?.trim();
  const clientSecret = process.env.SHOPIFY_ADMIN_API_CLIENT_SECRET?.trim();
  if (!shop || !clientId || !clientSecret) return null;

  const now = Date.now();
  if (cachedToken && now < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    console.error("[shopify-admin-auth] client_credentials failed:", await res.text());
    return null;
  }

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;

  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 86_400;
  cachedToken = { token: data.access_token, expiresAt: now + expiresIn * 1000 };
  return data.access_token;
}

export async function shopifyAdminGraphql<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<{ data?: T; errors?: unknown } | null> {
  const token = await getShopifyAdminAccessToken();
  const shop = getShopifyShopDomain();
  if (!token || !shop) return null;

  const res = await fetch(`https://${shop}/admin/api/${SHOPIFY_ADMIN_REST_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    console.error("[shopify-admin] GraphQL HTTP error:", res.status, await res.text());
    return null;
  }

  return (await res.json()) as { data?: T; errors?: unknown };
}

export async function shopifyAdminRestJson<T>(
  path: string,
  init?: RequestInit
): Promise<T | null> {
  const token = await getShopifyAdminAccessToken();
  const shop = getShopifyShopDomain();
  if (!token || !shop) return null;

  const url = `https://${shop}/admin/api/${SHOPIFY_ADMIN_REST_API_VERSION}${path.startsWith("/") ? path : `/${path}`}`;
  const method = init?.method ?? "GET";
  const headers: Record<string, string> = {
    "X-Shopify-Access-Token": token,
    ...(init?.headers as Record<string, string>),
  };
  if (method !== "GET" && method !== "HEAD") {
    headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
  }

  const res = await fetch(url, {
    ...init,
    headers,
  });

  if (!res.ok) {
    console.error("[shopify-admin] REST error:", path, res.status, await res.text());
    return null;
  }

  return (await res.json()) as T;
}

/**
 * REST GET that returns parsed JSON + Link header (orders pagination).
 */
export async function shopifyAdminRestJsonWithLink<T>(
  path: string,
  init?: RequestInit
): Promise<{ json: T | null; linkHeader: string | null }> {
  const token = await getShopifyAdminAccessToken();
  const shop = getShopifyShopDomain();
  if (!token || !shop) return { json: null, linkHeader: null };

  const url = `https://${shop}/admin/api/${SHOPIFY_ADMIN_REST_API_VERSION}${path.startsWith("/") ? path : `/${path}`}`;
  const method = init?.method ?? "GET";
  const headers: Record<string, string> = {
    "X-Shopify-Access-Token": token,
    ...(init?.headers as Record<string, string>),
  };
  if (method !== "GET" && method !== "HEAD") {
    headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
  }

  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    console.error("[shopify-admin] REST error:", path, res.status, await res.text());
    return { json: null, linkHeader: null };
  }

  return {
    json: (await res.json()) as T,
    linkHeader: res.headers.get("Link"),
  };
}

/** Next page path for orders list, e.g. `/orders.json?page_info=...` */
export function nextShopifyAdminPathFromLinkHeader(
  linkHeader: string | null
): string | null {
  if (!linkHeader) return null;
  const m = linkHeader.match(/<([^>]+)>\s*;\s*rel="next"/i);
  if (!m) return null;
  try {
    const u = new URL(m[1]);
    const prefix = `/admin/api/${SHOPIFY_ADMIN_REST_API_VERSION}`;
    if (!u.pathname.startsWith(prefix)) return null;
    return u.pathname.slice(prefix.length) + u.search;
  } catch {
    return null;
  }
}

/**
 * HMAC key for Admin API webhooks (orders/refunds). Shopify signs with the app's client secret.
 * Prefer explicit Admin secret so SHOPIFY_WEBHOOK_SECRET can remain for unrelated integrations.
 */
export function getShopifyWebhookSecret(): string | null {
  return (
    process.env.SHOPIFY_ADMIN_WEBHOOK_SECRET?.trim() ||
    process.env.SHOPIFY_ADMIN_API_CLIENT_SECRET?.trim() ||
    process.env.SHOPIFY_WEBHOOK_SECRET?.trim() ||
    null
  );
}
