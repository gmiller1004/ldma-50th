/**
 * GA4 event tracking. Uses gtag when NEXT_PUBLIC_GA_MEASUREMENT_ID is set.
 * Call from client components only.
 */

declare global {
  interface Window {
    gtag?: (
      command: "event" | "config" | "js",
      targetId: string,
      config?: Record<string, unknown>
    ) => void;
  }
}

export function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean>
): void {
  if (typeof window === "undefined" || !window.gtag) return;
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!id) return;
  window.gtag("event", eventName, params as Record<string, unknown>);
}

/** Member login success */
export function trackLogin(): void {
  trackEvent("login", { method: "member_code" });
}

/** User opened the membership customization quiz modal */
export function trackMembershipQuizOpen(): void {
  trackEvent("membership_quiz_open");
}

/** User completed the membership quiz and added to cart */
export function trackMembershipQuizComplete(): void {
  trackEvent("membership_quiz_complete");
}

/** Add to cart (use category to distinguish event vs shop vs membership) */
export function trackAddToCart(category: "event" | "membership" | "shop", value?: number): void {
  trackEvent("add_to_cart", {
    item_category: category,
    ...(value != null && { value }),
  });
}

/** User clicked checkout (redirect to Shopify) */
export function trackBeginCheckout(): void {
  trackEvent("begin_checkout");
}

/** VIP upsell: user added VIP package to cart */
export function trackVipUpsellAddToCart(): void {
  trackEvent("vip_upsell_add_to_cart");
}

/** VIP upsell: user dismissed with "Maybe later" */
export function trackVipUpsellMaybeLater(): void {
  trackEvent("vip_upsell_maybe_later");
}

/** Newsletter signup */
export function trackNewsletterSignup(): void {
  trackEvent("newsletter_signup");
}

/** Contact form submit */
export function trackContactSubmit(): void {
  trackEvent("generate_lead", { form_name: "contact" });
}
