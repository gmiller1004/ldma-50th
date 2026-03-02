/**
 * Shopify Customer Account API
 * OAuth 2.0 + GraphQL for customer orders (supports OTP login).
 * Uses PKCE (public client) for Headless channel - produces shcat_ tokens.
 */

import { randomBytes, createHash } from "crypto";

const SHOP_DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
const CLIENT_ID = process.env.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID;
const CLIENT_SECRET = process.env.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_SECRET;
type OpenIdConfig = {
  authorization_endpoint: string;
  token_endpoint: string;
  end_session_endpoint: string;
};

type CustomerAccountApiConfig = {
  graphql_api: string;
};

let cachedOpenId: OpenIdConfig | null = null;
let cachedGraphqlApi: string | null = null;

async function getOpenIdConfig(): Promise<OpenIdConfig> {
  if (cachedOpenId) return cachedOpenId;
  if (!SHOP_DOMAIN) throw new Error("NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN not set");
  const res = await fetch(`https://${SHOP_DOMAIN}/.well-known/openid-configuration`);
  if (!res.ok) throw new Error("Failed to fetch OpenID config");
  cachedOpenId = (await res.json()) as OpenIdConfig;
  return cachedOpenId!;
}

async function getGraphqlEndpoint(): Promise<string> {
  if (cachedGraphqlApi) return cachedGraphqlApi;
  if (!SHOP_DOMAIN) throw new Error("NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN not set");
  const res = await fetch(`https://${SHOP_DOMAIN}/.well-known/customer-account-api`);
  if (!res.ok) throw new Error("Failed to fetch Customer Account API config");
  const config = (await res.json()) as CustomerAccountApiConfig;
  cachedGraphqlApi = config.graphql_api;
  return cachedGraphqlApi!;
}

/** Generate PKCE code_verifier and code_challenge (S256). */
export function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { codeVerifier: verifier, codeChallenge: challenge };
}

/** Build the OAuth authorization URL for redirect. Uses PKCE for public client (produces shcat_ tokens). */
export async function getAuthorizationUrl(
  redirectUri: string,
  state: string,
  pkce?: { codeVerifier: string; codeChallenge: string }
): Promise<string> {
  const config = await getOpenIdConfig();
  if (!CLIENT_ID) throw new Error("SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID not set");

  const url = new URL(config.authorization_endpoint);
  url.searchParams.set("scope", "openid email customer-account-api:full");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);

  if (pkce) {
    url.searchParams.set("code_challenge", pkce.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
  }

  return url.toString();
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  id_token?: string;
};

/** Exchange authorization code for tokens. Prefers PKCE (public client) when codeVerifier is provided; falls back to confidential client. */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
  codeVerifier?: string
): Promise<TokenResponse> {
  const config = await getOpenIdConfig();
  if (!CLIENT_ID) throw new Error("SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID not set");

  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("client_id", CLIENT_ID);
  body.set("redirect_uri", redirectUri);
  body.set("code", code);
  if (codeVerifier) {
    body.set("code_verifier", codeVerifier);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (CLIENT_SECRET && !codeVerifier) {
    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
    headers.Authorization = `Basic ${credentials}`;
  }

  const res = await fetch(config.token_endpoint, {
    method: "POST",
    headers,
    body: body.toString(),
  });

  const data = (await res.json()) as TokenResponse & { error?: string; error_description?: string };
  if (!res.ok) {
    throw new Error(data.error_description || data.error || "Token exchange failed");
  }

  return data;
}

/** Refresh access token using refresh_token. Supports both confidential (with secret) and public clients. */
export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const config = await getOpenIdConfig();
  if (!CLIENT_ID) throw new Error("SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID not set");

  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("client_id", CLIENT_ID);
  body.set("refresh_token", refreshToken);

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (CLIENT_SECRET) {
    headers.Authorization = `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`;
  }

  const res = await fetch(config.token_endpoint, {
    method: "POST",
    headers,
    body: body.toString(),
  });

  const data = (await res.json()) as TokenResponse & { error?: string; error_description?: string };
  if (!res.ok) {
    throw new Error(data.error_description || data.error || "Token refresh failed");
  }

  return data;
}

export type CustomerOrder = {
  id: string;
  name: string;
  orderNumber: number;
  processedAt: string;
  totalPrice: { amount: string; currencyCode: string };
  lineItems: Array<{
    title: string;
    quantity: number;
    originalTotalPrice: { amount: string };
  }>;
};

/** Fetch customer orders via Customer Account API. */
export async function getCustomerOrders(
  accessToken: string,
  first = 50
): Promise<CustomerOrder[]> {
  const endpoint = await getGraphqlEndpoint();

  const query = `
    query getCustomerOrders($first: Int!) {
      customer {
        orders(first: $first, sortKey: PROCESSED_AT, reverse: true) {
          nodes {
            id
            name
            number
            processedAt
            totalPrice {
              amount
              currencyCode
            }
            lineItems(first: 50) {
              nodes {
                title
                quantity
                originalTotalPrice {
                  amount
                }
              }
            }
          }
        }
      }
    }
  `;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ query, variables: { first } }),
  });

  const text = await res.text();
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    if (text.trimStart().startsWith("<")) {
      throw new Error(
        `Customer Account API returned HTML instead of JSON (status ${res.status}). The endpoint may be incorrect or unavailable.`
      );
    }
    throw new Error(`Customer Account API returned invalid JSON: ${text.slice(0, 100)}`);
  }
  const errs = json.errors as Array<{ message: string }> | undefined;
  if (errs && errs.length > 0) {
    const msg = errs[0].message || "Failed to fetch orders";
    console.error("[customer-account-api] GraphQL errors:", JSON.stringify(errs));
    throw new Error(msg);
  }

  if (!res.ok) {
    const body = typeof json === "object" ? JSON.stringify(json) : String(json);
    throw new Error(`Customer Account API error: ${res.status} - ${body}`);
  }

  const data = json.data as Record<string, unknown> | undefined;
  const customer = data?.customer as Record<string, unknown> | undefined;
  const orders = customer?.orders as { nodes?: Array<{
    id: string;
    name: string;
    number: number;
    processedAt: string;
    totalPrice: { amount: string; currencyCode: string };
    lineItems: { nodes?: Array<{
      title: string;
      quantity: number;
      originalTotalPrice: { amount: string };
    }> };
  }> } | undefined;
  const nodes = orders?.nodes ?? [];
  return nodes.map((n) => ({
    id: n.id,
    name: n.name,
    orderNumber: n.number,
    processedAt: n.processedAt,
    totalPrice: n.totalPrice,
    lineItems: (n.lineItems?.nodes ?? []).map((li) => ({
      title: li.title,
      quantity: li.quantity,
      originalTotalPrice: li.originalTotalPrice,
    })),
  }));
}
