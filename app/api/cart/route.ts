import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCart } from "@/lib/shopify";

const CART_ID_COOKIE = "shopify_cart_id";

export async function GET() {
  const cookieStore = await cookies();
  const cartId = cookieStore.get(CART_ID_COOKIE)?.value;

  if (!cartId) {
    return NextResponse.json({ count: 0, cart: null });
  }

  try {
    const cart = await getCart(cartId);
    if (!cart) {
      return NextResponse.json({ count: 0, cart: null });
    }
    return NextResponse.json({
      count: cart.totalQuantity,
      cart: {
        id: cart.id,
        checkoutUrl: cart.checkoutUrl,
        totalQuantity: cart.totalQuantity,
        cost: cart.cost,
        lines: cart.lines.edges.map((e) => e.node),
      },
    });
  } catch {
    return NextResponse.json({ count: 0, cart: null });
  }
}
