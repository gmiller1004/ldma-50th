"use server";

import {
  createCartAndAddLines,
  addLinesToExistingCart,
  cartLinesUpdate,
  cartLinesRemove,
  cartNoteUpdate,
  getCart,
} from "@/lib/shopify";
import { cookies } from "next/headers";
import { isLdmaLifetimeProduct, isMembershipProduct } from "@/lib/membership-config";
import {
  getMailchimpStore,
  getMemberByUniqueEmailId,
  addOrUpdateCustomer,
  addOrUpdateCart,
  isMailchimpConfigured,
} from "@/lib/mailchimp";

const CART_ID_COOKIE = "shopify_cart_id";
const MAILCHIMP_EID_COOKIE = "mailchimp_eid";

/** Sync current Shopify cart to Mailchimp E-commerce when we have mc_eid (known contact from email). Non-blocking; logs errors. */
async function syncCartToMailchimp(cartId: string, mailchimpEid: string) {
  if (!isMailchimpConfigured()) return;
  const storeId = process.env.MAILCHIMP_STORE_ID!;
  try {
    const store = await getMailchimpStore(storeId);
    if (!store?.list_id) return;
    const member = await getMemberByUniqueEmailId(store.list_id, mailchimpEid);
    if (!member?.email_address) return;
    const email = member.email_address;
    const customerId = email;
    await addOrUpdateCustomer(storeId, customerId, {
      email_address: email,
      opt_in_status: false,
    });
    const cart = await getCart(cartId);
    if (!cart) return;
    const orderTotal = parseFloat(cart.cost.subtotalAmount.amount);
    const currencyCode = cart.cost.subtotalAmount.currencyCode ?? "USD";
    const lines = cart.lines.edges.map(({ node }) => ({
      id: node.id,
      product_id: node.merchandise.product.id,
      product_variant_id: node.merchandise.id,
      quantity: node.quantity,
      price: parseFloat(node.cost.totalAmount.amount),
    }));
    await addOrUpdateCart(storeId, cartId, customerId, {
      currency_code: currencyCode,
      order_total: orderTotal,
      checkout_url: cart.checkoutUrl,
      lines,
    });
  } catch (err) {
    console.error("[Mailchimp] cart sync failed:", err);
  }
}

/** True if the error means the cart ID is invalid (expired, completed, or deleted). */
function isCartNotFoundError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /cart does not exist|cart not found|invalid cart/i.test(msg);
}

export async function addToCart(
  variantId: string,
  sellingPlanId?: string,
  quantity: number = 1
) {
  const cookieStore = await cookies();
  let existingCartId = cookieStore.get(CART_ID_COOKIE)?.value;
  const mailchimpEid = cookieStore.get(MAILCHIMP_EID_COOKIE)?.value;
  const line = {
    merchandiseId: variantId,
    quantity: Math.max(1, Math.min(100, quantity)),
    ...(sellingPlanId && { sellingPlanId }),
  };

  let checkoutUrl: string;
  let cartId: string | undefined;

  if (existingCartId) {
    try {
      const result = await addLinesToExistingCart(existingCartId, [line]);
      checkoutUrl = result.checkoutUrl;
      cartId = existingCartId;
    } catch (e) {
      if (isCartNotFoundError(e)) {
        const result = await createCartAndAddLines([line]);
        checkoutUrl = result.checkoutUrl;
        cartId = result.cartId;
        if (result.cartId) {
          cookieStore.set(CART_ID_COOKIE, result.cartId, {
            path: "/",
            maxAge: 60 * 60 * 24 * 30, // 30 days
            sameSite: "lax",
          });
        }
      } else {
        throw e;
      }
    }
  } else {
    const result = await createCartAndAddLines([line]);
    checkoutUrl = result.checkoutUrl;
    cartId = result.cartId;
    if (result.cartId) {
      cookieStore.set(CART_ID_COOKIE, result.cartId, {
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 days
        sameSite: "lax",
      });
    }
  }

  if (cartId && mailchimpEid) {
    syncCartToMailchimp(cartId, mailchimpEid).catch(() => {});
  }
  return { checkoutUrl };
}

/** Add multiple membership products to cart (e.g. from customization flow). Retries with a fresh cart if the existing cart is invalid (expired or already used). */
export async function addMembershipToCart(variantIds: string[]) {
  if (variantIds.length === 0) throw new Error("No variants to add");
  const cookieStore = await cookies();
  let existingCartId = cookieStore.get(CART_ID_COOKIE)?.value;
  const mailchimpEid = cookieStore.get(MAILCHIMP_EID_COOKIE)?.value;
  const lines = variantIds.map((id) => ({ merchandiseId: id, quantity: 1 }));

  let cartId: string | undefined;
  let checkoutUrl: string;

  try {
    if (existingCartId) {
      const result = await addLinesToExistingCart(existingCartId, lines);
      checkoutUrl = result.checkoutUrl;
      cartId = existingCartId;
      if (cartId && mailchimpEid) {
        syncCartToMailchimp(cartId, mailchimpEid).catch(() => {});
      }
      return { checkoutUrl };
    }
  } catch {
    existingCartId = undefined;
  }

  const result = await createCartAndAddLines(lines);
  checkoutUrl = result.checkoutUrl;
  cartId = result.cartId;
  if (result.cartId) {
    cookieStore.set(CART_ID_COOKIE, result.cartId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
    });
  }
  if (cartId && mailchimpEid) {
    syncCartToMailchimp(cartId, mailchimpEid).catch(() => {});
  }
  return { checkoutUrl };
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

/** Remove the cart line that has the given variant (by variant GID). No-op if not found or no cart. */
export async function removeCartLineByVariantId(variantId: string) {
  const cookieStore = await cookies();
  const cartId = cookieStore.get(CART_ID_COOKIE)?.value;
  if (!cartId) return;
  const cart = await getCart(cartId);
  if (!cart) return;
  const line = cart.lines.edges.find((e) => e.node.merchandise.id === variantId)?.node;
  if (!line) return;
  await cartLinesRemove(cartId, [line.id]);
}

/** Remove all lines from the current cart. No-op if no cart. Used when user exits membership quiz without finishing. */
export async function clearCart() {
  const cookieStore = await cookies();
  const cartId = cookieStore.get(CART_ID_COOKIE)?.value;
  if (!cartId) return;
  const cart = await getCart(cartId);
  if (!cart || !cart.lines.edges.length) return;
  const lineIds = cart.lines.edges.map((e) => e.node.id);
  await cartLinesRemove(cartId, lineIds);
}
