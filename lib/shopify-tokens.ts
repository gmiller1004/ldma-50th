import { sql, hasDb } from "./db";

export type StoredShopifyToken = {
  customerAccessToken: string;
  expiresAt: string;
  refreshToken: string | null;
};

export async function getShopifyToken(
  memberNumber: string
): Promise<StoredShopifyToken | null> {
  if (!memberNumber || !hasDb() || !sql) return null;
  const rows = await sql`
    SELECT customer_access_token, expires_at, refresh_token
    FROM member_shopify_tokens
    WHERE member_number = ${memberNumber}
  `;
  const arr = Array.isArray(rows) ? rows : [];
  const row = arr[0] as {
    customer_access_token: string;
    expires_at: string;
    refresh_token: string | null;
  } | undefined;
  if (!row?.customer_access_token) return null;
  return {
    customerAccessToken: row.customer_access_token,
    expiresAt: row.expires_at,
    refreshToken: row.refresh_token ?? null,
  };
}

/** Store OAuth tokens from Customer Account API. */
export async function setShopifyOAuthToken(
  memberNumber: string,
  accessToken: string,
  expiresAt: string,
  refreshToken: string
): Promise<void> {
  if (!hasDb() || !sql) return;
  await sql`
    INSERT INTO member_shopify_tokens (member_number, customer_access_token, expires_at, refresh_token, updated_at)
    VALUES (${memberNumber}, ${accessToken}, ${expiresAt}::timestamptz, ${refreshToken}, NOW())
    ON CONFLICT (member_number) DO UPDATE SET
      customer_access_token = EXCLUDED.customer_access_token,
      expires_at = EXCLUDED.expires_at,
      refresh_token = EXCLUDED.refresh_token,
      updated_at = NOW()
  `;
}

/** Update stored token after refresh. */
export async function updateShopifyToken(
  memberNumber: string,
  accessToken: string,
  expiresAt: string,
  refreshToken?: string
): Promise<void> {
  if (!hasDb() || !sql) return;
  if (refreshToken) {
    await sql`
      UPDATE member_shopify_tokens
      SET customer_access_token = ${accessToken}, expires_at = ${expiresAt}::timestamptz, refresh_token = ${refreshToken}, updated_at = NOW()
      WHERE member_number = ${memberNumber}
    `;
  } else {
    await sql`
      UPDATE member_shopify_tokens
      SET customer_access_token = ${accessToken}, expires_at = ${expiresAt}::timestamptz, updated_at = NOW()
      WHERE member_number = ${memberNumber}
    `;
  }
}

/** @deprecated Use setShopifyOAuthToken for OAuth. Kept for migration compatibility. */
export async function setShopifyToken(
  memberNumber: string,
  customerAccessToken: string,
  expiresAt: string
): Promise<void> {
  if (!hasDb() || !sql) return;
  await sql`
    INSERT INTO member_shopify_tokens (member_number, customer_access_token, expires_at, updated_at)
    VALUES (${memberNumber}, ${customerAccessToken}, ${expiresAt}::timestamptz, NOW())
    ON CONFLICT (member_number) DO UPDATE SET
      customer_access_token = EXCLUDED.customer_access_token,
      expires_at = EXCLUDED.expires_at,
      updated_at = NOW()
  `;
}

export async function clearShopifyToken(memberNumber: string): Promise<void> {
  if (!hasDb() || !sql) return;
  await sql`
    DELETE FROM member_shopify_tokens WHERE member_number = ${memberNumber}
  `;
}
