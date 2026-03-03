import { sql, hasDb } from "./db";

export async function getCommentDigestEnabled(memberNumber: string): Promise<boolean> {
  if (!memberNumber || !hasDb() || !sql) return false;
  const rows = await sql`
    SELECT comment_digest_enabled FROM member_notification_preferences
    WHERE member_number = ${memberNumber}
  `;
  const arr = Array.isArray(rows) ? rows : [];
  const row = arr[0] as { comment_digest_enabled: boolean } | undefined;
  return row?.comment_digest_enabled ?? false;
}

export async function setCommentDigestEnabled(
  memberNumber: string,
  enabled: boolean
): Promise<void> {
  if (!hasDb() || !sql) return;
  await sql`
    INSERT INTO member_notification_preferences (member_number, comment_digest_enabled, updated_at)
    VALUES (${memberNumber}, ${enabled}, NOW())
    ON CONFLICT (member_number) DO UPDATE SET
      comment_digest_enabled = EXCLUDED.comment_digest_enabled,
      updated_at = NOW()
  `;
}

export async function getMembersWithCommentDigestEnabled(): Promise<string[]> {
  if (!hasDb() || !sql) return [];
  const rows = await sql`
    SELECT member_number FROM member_notification_preferences
    WHERE comment_digest_enabled = true
  `;
  const arr = Array.isArray(rows) ? rows : [];
  return (arr as { member_number: string }[]).map((r) => r.member_number);
}

export async function getExclusiveOffersNotify(memberNumber: string): Promise<boolean> {
  if (!memberNumber || !hasDb() || !sql) return false;
  try {
    const rows = await sql`
      SELECT exclusive_offers_notify FROM member_notification_preferences
      WHERE member_number = ${memberNumber}
    `;
    const arr = Array.isArray(rows) ? rows : [];
    const row = arr[0] as { exclusive_offers_notify?: boolean } | undefined;
    return row?.exclusive_offers_notify ?? false;
  } catch {
    return false;
  }
}

export async function setExclusiveOffersNotify(
  memberNumber: string,
  enabled: boolean
): Promise<void> {
  if (!hasDb() || !sql) return;
  await sql`
    INSERT INTO member_notification_preferences (member_number, comment_digest_enabled, exclusive_offers_notify, updated_at)
    VALUES (${memberNumber}, false, ${enabled}, NOW())
    ON CONFLICT (member_number) DO UPDATE SET
      exclusive_offers_notify = EXCLUDED.exclusive_offers_notify,
      updated_at = NOW()
  `;
}

export async function getMembersWithExclusiveOffersNotify(): Promise<string[]> {
  if (!hasDb() || !sql) return [];
  try {
    const rows = await sql`
      SELECT member_number FROM member_notification_preferences
      WHERE exclusive_offers_notify = true
    `;
    const arr = Array.isArray(rows) ? rows : [];
    return (arr as { member_number: string }[]).map((r) => r.member_number);
  } catch {
    return [];
  }
}

export async function getExclusiveOffersNotifiedProductIds(): Promise<string[]> {
  if (!hasDb() || !sql) return [];
  try {
    const rows = await sql`
      SELECT shopify_product_id FROM exclusive_offers_notified_products
    `;
    const arr = Array.isArray(rows) ? rows : [];
    return (arr as { shopify_product_id: string }[]).map((r) => r.shopify_product_id);
  } catch {
    return [];
  }
}

export async function recordExclusiveOffersNotified(productIds: string[]): Promise<void> {
  if (!hasDb() || !sql || productIds.length === 0) return;
  for (const id of productIds) {
    await sql`
      INSERT INTO exclusive_offers_notified_products (shopify_product_id, notified_at)
      VALUES (${id}, NOW())
      ON CONFLICT (shopify_product_id) DO NOTHING
    `;
  }
}
