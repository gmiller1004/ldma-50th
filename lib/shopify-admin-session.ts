import { sql, hasDb } from "@/lib/db";

export async function saveShopifyAdminSession(
  shopDomain: string,
  accessToken: string,
  scope: string
): Promise<void> {
  if (!hasDb() || !sql) {
    throw new Error("Database not configured; cannot store Shopify Admin session.");
  }
  await sql`
    INSERT INTO shopify_admin_session (shop_domain, access_token, scope, updated_at)
    VALUES (${shopDomain}, ${accessToken}, ${scope}, NOW())
    ON CONFLICT (shop_domain) DO UPDATE SET
      access_token = EXCLUDED.access_token,
      scope = EXCLUDED.scope,
      updated_at = NOW()
  `;
}
