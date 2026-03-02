import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/session";
import { clearShopifyToken } from "@/lib/shopify-tokens";

/** Disconnect the store account from the current member profile. Clears stored tokens so user can sign in again. */
export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("member_session")?.value;
    if (!token) {
      return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
    }

    const session = await verifySessionToken(token);
    if (!session?.memberNumber) {
      return NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 });
    }

    await clearShopifyToken(session.memberNumber);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[shopify-disconnect]", e);
    return NextResponse.json({ ok: false, error: "Failed to disconnect" }, { status: 500 });
  }
}
