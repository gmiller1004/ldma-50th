import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sessionCookieName, verifySessionToken } from "@/lib/session";
import { clearShopifyToken } from "@/lib/shopify-tokens";

export async function POST() {
  // Clear Shopify store connection before clearing session (need memberNumber from session)
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(sessionCookieName())?.value;
    if (token) {
      const session = await verifySessionToken(token);
      if (session?.memberNumber) {
        await clearShopifyToken(session.memberNumber);
      }
    }
  } catch {
    // Ignore errors; clearing session is the main goal
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName(), "", {
    maxAge: 0,
    path: "/",
  });
  return response;
}
