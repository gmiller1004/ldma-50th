import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { shopifyFetch } from "@/lib/shopify";

const CART_ID_COOKIE = "shopify_cart_id";

export async function GET() {
  const cookieStore = await cookies();
  const cartId = cookieStore.get(CART_ID_COOKIE)?.value;

  if (!cartId) {
    return NextResponse.json({ count: 0 });
  }

  try {
    const result = await shopifyFetch<{
      cart: { totalQuantity: number } | null;
    }>({
      query: `
        query GetCart($cartId: ID!) {
          cart(id: $cartId) {
            totalQuantity
          }
        }
      `,
      variables: { cartId },
    });

    return NextResponse.json({
      count: result?.cart?.totalQuantity ?? 0,
    });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
