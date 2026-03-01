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
