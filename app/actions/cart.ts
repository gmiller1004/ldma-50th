"use server";

import { createCartAndAddLine, addLineToExistingCart } from "@/lib/shopify";
import { cookies } from "next/headers";

const CART_ID_COOKIE = "shopify_cart_id";

export async function addToCart(variantId: string) {
  const cookieStore = await cookies();
  const existingCartId = cookieStore.get(CART_ID_COOKIE)?.value;

  let checkoutUrl: string;

  if (existingCartId) {
    const result = await addLineToExistingCart(existingCartId, variantId);
    checkoutUrl = result.checkoutUrl;
  } else {
    const result = await createCartAndAddLine(variantId);
    checkoutUrl = result.checkoutUrl;
    if (result.cartId) {
      cookieStore.set(CART_ID_COOKIE, result.cartId, {
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 days
        sameSite: "lax",
      });
    }
  }

  return { checkoutUrl };
}
