"use server";

import { cookies } from "next/headers";
import { getMembershipCollectionProducts } from "@/lib/shopify";
import type { ShopifyProduct } from "@/lib/shopify";
import type { MembershipProductKey } from "@/lib/membership-config";
import {
  MEMBERSHIP_QUOTE_EMAIL_COOKIE,
  trackMembershipConfigurationFinalized,
  trackMembershipConfigurationViewed,
  isKlaviyoMembershipEventsConfigured,
} from "@/lib/klaviyo-membership-events";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type MembershipProductInfo = {
  key: MembershipProductKey;
  product: ShopifyProduct;
  variantId: string;
  price: string;
  compareAtPrice: string | null;
  title: string;
};

/** Funnel order for the customization flow */
const FLOW_ORDER: MembershipProductKey[] = [
  "lifetime",
  "companion",
  "paydirt",
  "minelab",
  "gpaa",
];

export async function getMembershipProductsForFlow(): Promise<
  MembershipProductInfo[]
> {
  const map = await getMembershipCollectionProducts();
  const result: MembershipProductInfo[] = [];

  for (const key of FLOW_ORDER) {
    const product = map[key];
    if (!product) continue;
    const variant = product.variants?.edges?.[0]?.node;
    if (!variant) continue;
    const compareAtPrice =
      variant.compareAtPrice?.amount && parseFloat(variant.compareAtPrice.amount) > 0
        ? variant.compareAtPrice.amount
        : null;

    result.push({
      key,
      product,
      variantId: variant.id,
      price: variant.price.amount,
      compareAtPrice,
      title: product.title,
    });
  }

  return result;
}

/** Get Companion add-on product for profile upsell (members without it). */
export async function getCompanionAddOnProduct(): Promise<MembershipProductInfo | null> {
  const map = await getMembershipCollectionProducts();
  const product = map.companion;
  if (!product) return null;
  const variant = product.variants?.edges?.[0]?.node;
  if (!variant) return null;
  const compareAtPrice =
    variant.compareAtPrice?.amount && parseFloat(variant.compareAtPrice.amount) > 0
      ? variant.compareAtPrice.amount
      : null;

  return {
    key: "companion",
    product,
    variantId: variant.id,
    price: variant.price.amount,
    compareAtPrice,
    title: product.title,
  };
}

/**
 * One Klaviyo event when the user completes the membership modal (“Go to Cart”).
 * Uses `email` if provided (e.g. after “Email me this quote”); otherwise the httpOnly quote cookie.
 * Skips if no email (Klaviyo requires a profile identifier).
 */
export async function emitMembershipConfigurationFinalized(params: {
  email?: string | null;
  choices: Record<string, string>;
  line_items: Array<{
    key: string;
    title: string;
    price: string;
    variant_id?: string;
  }>;
  subtotal: number;
  currency: string;
  checkout_url: string;
}): Promise<void> {
  if (!isKlaviyoMembershipEventsConfigured()) return;

  const trimmed = params.email?.trim().toLowerCase() ?? "";
  const fromClient = trimmed && EMAIL_RE.test(trimmed) ? trimmed : null;

  const cookieStore = await cookies();
  const fromCookie = cookieStore
    .get(MEMBERSHIP_QUOTE_EMAIL_COOKIE)
    ?.value?.trim()
    .toLowerCase();
  const fromCookieOk = fromCookie && EMAIL_RE.test(fromCookie) ? fromCookie : null;

  const email = fromClient ?? fromCookieOk;
  if (!email) return;

  trackMembershipConfigurationFinalized(email, {
    choices: params.choices,
    line_items: params.line_items,
    subtotal: params.subtotal,
    currency: params.currency,
    checkout_url: params.checkout_url,
  }).catch((e) => console.error("[Klaviyo] Membership Configuration Finalized:", e));
}

/**
 * Fire when the summary step is reached, but only if the quote email cookie already exists.
 * (We intentionally do not accept `email` from the client here so this cannot “identify” anyone;
 * it’s only for already-known profiles.)
 */
export async function emitMembershipConfigurationViewedIfKnown(params: {
  choices: Record<string, string>;
  line_items: Array<{
    key: string;
    title: string;
    price: string;
    variant_id?: string;
  }>;
  subtotal: number;
  currency: string;
  checkout_url: string;
}): Promise<void> {
  if (!isKlaviyoMembershipEventsConfigured()) return;

  const cookieStore = await cookies();
  const fromCookie = cookieStore
    .get(MEMBERSHIP_QUOTE_EMAIL_COOKIE)
    ?.value?.trim()
    .toLowerCase();
  const email = fromCookie && EMAIL_RE.test(fromCookie) ? fromCookie : null;
  if (!email) return;

  trackMembershipConfigurationViewed(email, {
    choices: params.choices,
    line_items: params.line_items,
    subtotal: params.subtotal,
    currency: params.currency,
    checkout_url: params.checkout_url,
  }).catch((e) => console.error("[Klaviyo] Membership Configuration Viewed:", e));
}
