import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/session";
import { getShopifyToken } from "@/lib/shopify-tokens";
import { sql, hasDb } from "@/lib/db";

/** Diagnostic endpoint to debug purchase history / OAuth flow. */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("member_session")?.value;
    const hasSession = Boolean(token);
    let session: { memberNumber: string } | null = null;
    if (token) {
      session = await verifySessionToken(token);
    }

    let hasStoredToken = false;
    let oauthStateCount = 0;
    if (session?.memberNumber && hasDb() && sql) {
      const stored = await getShopifyToken(session.memberNumber);
      hasStoredToken = Boolean(stored?.customerAccessToken);
      try {
        const rows = await sql`SELECT COUNT(*) as n FROM oauth_state WHERE expires_at > NOW()`;
        const arr = Array.isArray(rows) ? rows : [];
        oauthStateCount = Number((arr[0] as { n: string | number } | undefined)?.n ?? 0);
      } catch {
        oauthStateCount = -1;
      }
    }

    return NextResponse.json({
      hasSession,
      memberNumber: session?.memberNumber ? `${session.memberNumber.slice(0, 2)}***` : null,
      hasStoredToken,
      oauthStateTableWorks: oauthStateCount >= 0,
      pendingOAuthStates: oauthStateCount,
    });
  } catch (e) {
    return NextResponse.json({
      error: e instanceof Error ? e.message : "Unknown error",
    }, { status: 500 });
  }
}
