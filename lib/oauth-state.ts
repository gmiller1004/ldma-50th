import { sql, hasDb } from "./db";

export type OAuthStateResult = {
  memberNumber: string;
  codeVerifier: string | null;
};

/** Store OAuth state -> member_number for callback lookup (cookies may not be sent on redirect). */
export async function setOAuthState(
  state: string,
  memberNumber: string,
  expiresAt: Date,
  codeVerifier?: string
): Promise<void> {
  if (!hasDb() || !sql) {
    throw new Error("Database not configured. Cannot store OAuth state.");
  }
  await sql`
    INSERT INTO oauth_state (state, member_number, expires_at, code_verifier)
    VALUES (${state}, ${memberNumber}, ${expiresAt.toISOString()}::timestamptz, ${codeVerifier ?? null})
    ON CONFLICT (state) DO UPDATE SET
      member_number = EXCLUDED.member_number,
      expires_at = EXCLUDED.expires_at,
      code_verifier = EXCLUDED.code_verifier
  `;
}

/** Look up member_number and code_verifier by state and delete (one-time use). */
export async function consumeOAuthState(
  state: string
): Promise<OAuthStateResult | null> {
  if (!hasDb() || !sql) {
    console.error("[oauth-state] Database not configured");
    return null;
  }
  const rows = await sql`
    DELETE FROM oauth_state
    WHERE state = ${state} AND expires_at > NOW()
    RETURNING member_number, code_verifier
  `;
  const arr = Array.isArray(rows) ? rows : [];
  const row = arr[0] as { member_number: string; code_verifier: string | null } | undefined;
  if (!row) return null;
  return {
    memberNumber: row.member_number,
    codeVerifier: row.code_verifier ?? null,
  };
}
