import { sql, hasDb } from "./db";

/** Store OAuth state -> member_number for callback lookup (cookies may not be sent on redirect). */
export async function setOAuthState(
  state: string,
  memberNumber: string,
  expiresAt: Date
): Promise<void> {
  if (!hasDb() || !sql) {
    throw new Error("Database not configured. Cannot store OAuth state.");
  }
  await sql`
    INSERT INTO oauth_state (state, member_number, expires_at)
    VALUES (${state}, ${memberNumber}, ${expiresAt.toISOString()}::timestamptz)
    ON CONFLICT (state) DO UPDATE SET
      member_number = EXCLUDED.member_number,
      expires_at = EXCLUDED.expires_at
  `;
}

/** Look up member_number by state and delete (one-time use). */
export async function consumeOAuthState(
  state: string
): Promise<string | null> {
  if (!hasDb() || !sql) {
    console.error("[oauth-state] Database not configured");
    return null;
  }
  const rows = await sql`
    DELETE FROM oauth_state
    WHERE state = ${state} AND expires_at > NOW()
    RETURNING member_number
  `;
  const arr = Array.isArray(rows) ? rows : [];
  const row = arr[0] as { member_number: string } | undefined;
  return row?.member_number ?? null;
}
