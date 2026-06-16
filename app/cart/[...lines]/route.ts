import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createCartAndAddLines } from "@/lib/shopify";
import { parseCartPermalinkLines } from "@/lib/parse-cart-permalink";
import { resolveMerchandiseIdForCart } from "@/lib/resolve-cart-merchandise";
import {
  PENDING_DISCOUNT_COOKIE,
  pendingDiscountCookieOptions,
  sanitizeDiscountCode,
} from "@/lib/pending-discount";

type Params = Promise<{ lines: string[] }>;

const CART_ID_COOKIE = "shopify_cart_id";

/**
 * Headless replacement for legacy Shopify Online Store cart permalinks
 * (`myldmastore.myshopify.com/cart/{id}:{qty}` — now 410 Gone).
 *
 * Creates a Storefront cart and redirects to Shopify checkout by default.
 * Accepts numeric variant ids or product ids (first variant is used).
 *
 * Query params:
 *   discount — optional discount code (also sets pending-discount cookie)
 *   checkout — set to `0` to land on /shop instead of checkout (default: checkout)
 */
export async function GET(request: NextRequest, { params }: { params: Params }) {
  const { lines: segments } = await params;
  const parsed = parseCartPermalinkLines(segments.join(","));
  if (!parsed.length) {
    return NextResponse.redirect(new URL("/shop", request.nextUrl));
  }

  const cookieStore = await cookies();
  const discountFromQuery = sanitizeDiscountCode(request.nextUrl.searchParams.get("discount"));
  if (discountFromQuery) {
    cookieStore.set(PENDING_DISCOUNT_COOKIE, discountFromQuery, pendingDiscountCookieOptions());
  }

  const pendingCode = sanitizeDiscountCode(cookieStore.get(PENDING_DISCOUNT_COOKIE)?.value);
  const discountCodes = discountFromQuery
    ? [discountFromQuery]
    : pendingCode
      ? [pendingCode]
      : undefined;

  try {
    const resolvedLines = await Promise.all(
      parsed.map(async (line) => ({
        merchandiseId: await resolveMerchandiseIdForCart(line.id),
        quantity: line.quantity,
      }))
    );

    const { checkoutUrl, cartId } = await createCartAndAddLines(
      resolvedLines,
      discountCodes ? { discountCodes } : undefined
    );

    if (cartId) {
      cookieStore.set(CART_ID_COOKIE, cartId, {
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
        sameSite: "lax",
      });
    }
    if (discountCodes?.length) {
      cookieStore.delete(PENDING_DISCOUNT_COOKIE);
    }

    const skipCheckout = request.nextUrl.searchParams.get("checkout") === "0";
    if (skipCheckout) {
      return NextResponse.redirect(new URL("/shop", request.nextUrl));
    }

    return NextResponse.redirect(checkoutUrl);
  } catch (e) {
    console.error("[cart-permalink]", e);
    return NextResponse.redirect(new URL("/shop", request.nextUrl));
  }
}
