import { sql, hasDb } from "./db";

export async function getAvatarUrl(contactId: string | null): Promise<string | null> {
  if (!contactId || !hasDb() || !sql) return null;
  const rows = await sql`SELECT avatar_url FROM member_avatars WHERE contact_id = ${contactId}`;
  const arr = Array.isArray(rows) ? rows : [];
  const row = arr[0] as { avatar_url: string } | undefined;
  return row?.avatar_url ?? null;
}

export async function setAvatarUrl(contactId: string, avatarUrl: string): Promise<void> {
  if (!hasDb() || !sql) return;
  await sql`
    INSERT INTO member_avatars (contact_id, avatar_url, updated_at)
    VALUES (${contactId}, ${avatarUrl}, NOW())
    ON CONFLICT (contact_id) DO UPDATE SET avatar_url = EXCLUDED.avatar_url, updated_at = NOW()
  `;
}
