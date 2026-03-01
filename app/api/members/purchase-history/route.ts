import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/session";
import {
  getCustomerOrders,
  refreshAccessToken,
} from "@/lib/customer-account-api";
import {
  getShopifyToken,
  clearShopifyToken,
  updateShopifyToken,
} from "@/lib/shopify-tokens";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("member_session")?.value;
    if (!token) {
      return NextResponse.json({ needsLogin: true }, { status: 200 });
    }

    const session = await verifySessionToken(token);
    if (!session) {
      return NextResponse.json({ needsLogin: true }, { status: 200 });
    }

    const stored = await getShopifyToken(session.memberNumber);
    if (!stored) {
      return NextResponse.json({ needsLogin: true }, { status: 200 });
    }

    let accessToken = stored.customerAccessToken;
    const now = new Date();
    const expiresAt = new Date(stored.expiresAt);

    // Refresh if access token is expired (or expires in < 60s) and we have refresh_token
    if (
      stored.refreshToken &&
      (expiresAt.getTime() - now.getTime() < 60 * 1000)
    ) {
      try {
        const refreshed = await refreshAccessToken(stored.refreshToken);
        const newExpiresAt = new Date(
          Date.now() + refreshed.expires_in * 1000
        ).toISOString();
        await updateShopifyToken(
          session.memberNumber,
          refreshed.access_token,
          newExpiresAt,
          refreshed.refresh_token
        );
        accessToken = refreshed.access_token;
      } catch {
        await clearShopifyToken(session.memberNumber);
        return NextResponse.json({ needsLogin: true }, { status: 200 });
      }
    }

    try {
      const orders = await getCustomerOrders(accessToken, 50);
      return NextResponse.json({ needsLogin: false, orders });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      const isAuthError = msg.includes("401") || msg.includes("unauthorized") || msg.includes("token");
      if (isAuthError) {
        await clearShopifyToken(session.memberNumber);
        return NextResponse.json({ needsLogin: true }, { status: 200 });
      }
      console.error("[purchase-history] getCustomerOrders failed:", e);
      return NextResponse.json({
        needsLogin: false,
        orders: [],
        error: "Unable to load orders. Please try again.",
      }, { status: 200 });
    }
  } catch (e) {
    console.error("[purchase-history]", e);
    return NextResponse.json(
      { error: "Failed to load purchase history" },
      { status: 500 }
    );
  }
}
