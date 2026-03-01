/**
 * Shopify Customer Account API
 * OAuth 2.0 + GraphQL for customer orders (supports OTP login).
 */

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

/** Build the OAuth authorization URL for redirect. */
export async function getAuthorizationUrl(
  redirectUri: string,
  state: string
): Promise<string> {
  const config = await getOpenIdConfig();
  if (!CLIENT_ID) throw new Error("SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID not set");

  const url = new URL(config.authorization_endpoint);
  url.searchParams.set("scope", "openid email customer-account-api:full");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);

  return url.toString();
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  id_token?: string;
};

/** Exchange authorization code for tokens (confidential client). */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<TokenResponse> {
  const config = await getOpenIdConfig();
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID or _SECRET not set");
  }

  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("client_id", CLIENT_ID);
  body.set("redirect_uri", redirectUri);
  body.set("code", code);

  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

  const res = await fetch(config.token_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: body.toString(),
  });

  const data = (await res.json()) as TokenResponse & { error?: string; error_description?: string };
  if (!res.ok) {
    throw new Error(data.error_description || data.error || "Token exchange failed");
  }

  return data;
}

/** Refresh access token using refresh_token. */
export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const config = await getOpenIdConfig();
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID or _SECRET not set");
  }

  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("client_id", CLIENT_ID);
  body.set("refresh_token", refreshToken);

  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

  const res = await fetch(config.token_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
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

  if (!res.ok) {
    throw new Error(`Customer Account API error: ${res.status}`);
  }

  const json = await res.json() as Record<string, unknown>;
  const errs = json.errors as Array<{ message: string }> | undefined;
  if (errs && errs.length > 0) {
    throw new Error(errs[0].message || "Failed to fetch orders");
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
