"use server";

import {
  createCartAndAddLine,
  createCartAndAddLines,
  addLineToExistingCart,
  addLinesToExistingCart,
  cartLinesUpdate,
  cartLinesRemove,
  cartNoteUpdate,
  getCart,
} from "@/lib/shopify";
import { cookies } from "next/headers";
import { isLdmaLifetimeProduct, isMembershipProduct } from "@/lib/membership-config";

const CART_ID_COOKIE = "shopify_cart_id";

export async function addToCart(
  variantId: string,
  sellingPlanId?: string,
  quantity: number = 1
) {
  const cookieStore = await cookies();
  const existingCartId = cookieStore.get(CART_ID_COOKIE)?.value;
  const line = {
    merchandiseId: variantId,
    quantity: Math.max(1, Math.min(100, quantity)),
    ...(sellingPlanId && { sellingPlanId }),
  };

  let checkoutUrl: string;

  if (existingCartId) {
    const result = await addLinesToExistingCart(existingCartId, [line]);
    checkoutUrl = result.checkoutUrl;
  } else {
    const result = await createCartAndAddLines([line]);
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

/** Add multiple membership products to cart (e.g. from customization flow). Retries with a fresh cart if the existing cart is invalid (expired or already used). */
export async function addMembershipToCart(variantIds: string[]) {
  if (variantIds.length === 0) throw new Error("No variants to add");
  const cookieStore = await cookies();
  let existingCartId = cookieStore.get(CART_ID_COOKIE)?.value;

  const lines = variantIds.map((id) => ({ merchandiseId: id, quantity: 1 }));

  try {
    if (existingCartId) {
      const result = await addLinesToExistingCart(existingCartId, lines);
      return { checkoutUrl: result.checkoutUrl };
    }
  } catch {
    existingCartId = undefined;
  }

  const result = await createCartAndAddLines(lines);
  if (result.cartId) {
    cookieStore.set(CART_ID_COOKIE, result.cartId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
    });
  }
  return { checkoutUrl: result.checkoutUrl };
}

/** Update the optional note on the cart (e.g. order instructions). Passes through to the order at checkout. */
export async function updateCartNote(note: string) {
  const cookieStore = await cookies();
  const cartId = cookieStore.get(CART_ID_COOKIE)?.value;
  if (!cartId) return;
  await cartNoteUpdate(cartId, note);
}

export async function updateCartLineQuantity(lineId: string, quantity: number) {
  const cookieStore = await cookies();
  const cartId = cookieStore.get(CART_ID_COOKIE)?.value;
  if (!cartId) throw new Error("No cart");
  if (quantity < 1) throw new Error("Quantity must be at least 1");
  await cartLinesUpdate(cartId, [{ id: lineId, quantity }]);
}

export async function removeCartLine(lineId: string) {
  const cookieStore = await cookies();
  const cartId = cookieStore.get(CART_ID_COOKIE)?.value;
  if (!cartId) throw new Error("No cart");

  const cart = await getCart(cartId);
  if (!cart) throw new Error("Cart not found");

  const line = cart.lines.edges.find((e) => e.node.id === lineId)?.node;
  const productTitle = line?.merchandise?.product?.title ?? "";

  // If removing LDMA Lifetime, remove all membership collection items
  if (isLdmaLifetimeProduct(productTitle)) {
    const membershipLineIds = cart.lines.edges
      .filter((e) => isMembershipProduct(e.node.merchandise.product.title))
      .map((e) => e.node.id);
    if (membershipLineIds.length > 0) {
      await cartLinesRemove(cartId, membershipLineIds);
      return;
    }
  }

  await cartLinesRemove(cartId, [lineId]);
}
