/**
 * Email / campaign links can send shoppers to `/discount/{code}?redirect=/path`.
 * The code is stored in an httpOnly cookie and applied on the next Storefront cart
 * create or merged onto an existing cart (see app/discount/[code]/route.ts and app/actions/cart.ts).
 */

export const PENDING_DISCOUNT_COOKIE = "shopify_pending_discount_code";

/** Long enough for “click email → browse → checkout later” without leaving stale codes forever */
export const PENDING_DISCOUNT_COOKIE_MAX_AGE = 60 * 60 * 24 * 14; // 14 days

/** Shopify discount codes are typically short; keep a sane upper bound */
const MAX_CODE_LEN = 80;

export function sanitizeDiscountCode(raw: string | undefined | null): string | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (t.length < 1 || t.length > MAX_CODE_LEN) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(t)) return null;
  return t;
}

/**
 * Only same-origin relative paths (prevents open redirects).
 * Query strings and fragments allowed for product deep-links.
 */
export function sanitizeDiscountRedirectPath(raw: string | null | undefined): string {
  const fallback = "/";
  if (raw == null || typeof raw !== "string") return fallback;
  let p = raw.trim();
  try {
    p = decodeURIComponent(p);
  } catch {
    return fallback;
  }
  if (!p.startsWith("/")) return fallback;
  if (p.startsWith("//")) return fallback;
  if (/[\r\n\0]/.test(p)) return fallback;
  if (p.length > 512) return fallback;
  const lower = p.toLowerCase();
  if (lower.startsWith("/http:") || lower.startsWith("/https:")) return fallback;
  return p;
}

export function pendingDiscountCookieOptions() {
  return {
    path: "/",
    maxAge: PENDING_DISCOUNT_COOKIE_MAX_AGE,
    sameSite: "lax" as const,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };
}
