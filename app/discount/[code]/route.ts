import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  PENDING_DISCOUNT_COOKIE,
  sanitizeDiscountCode,
  sanitizeDiscountRedirectPath,
  pendingDiscountCookieOptions,
} from "@/lib/pending-discount";
import { cartDiscountCodesUpdate } from "@/lib/shopify";

type Params = Promise<{ code: string }>;

const CART_ID_COOKIE = "shopify_cart_id";

/**
 * Mirrors Shopify Online Store `/discount/{code}?redirect=…` for the headless site.
 * Sets a short-lived httpOnly cookie and, when a cart already exists, applies the code immediately.
 */
export async function GET(request: NextRequest, { params }: { params: Params }) {
  const { code: rawFromPath } = await params;
  const safeCode = sanitizeDiscountCode(rawFromPath);
  if (!safeCode) {
    return NextResponse.redirect(new URL("/", request.nextUrl));
  }

  const redirectPath = sanitizeDiscountRedirectPath(request.nextUrl.searchParams.get("redirect"));

  const cookieStore = await cookies();
  cookieStore.set(PENDING_DISCOUNT_COOKIE, safeCode, pendingDiscountCookieOptions());

  const cartId = cookieStore.get(CART_ID_COOKIE)?.value;
  if (cartId) {
    try {
      await cartDiscountCodesUpdate(cartId, [safeCode]);
      cookieStore.delete(PENDING_DISCOUNT_COOKIE);
    } catch (e) {
      console.warn("[discount-route] cartDiscountCodesUpdate:", e);
    }
  }

  return NextResponse.redirect(new URL(redirectPath, request.nextUrl));
}
