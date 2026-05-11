import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify X-Shopify-Hmac-Sha256 for HTTP webhooks (raw body + app client secret).
 */
export function verifyShopifyWebhookBody(
  rawBody: string | Buffer,
  hmacHeader: string | null | undefined,
  secret: string
): boolean {
  if (!hmacHeader || !secret) return false;
  const bodyBuf = typeof rawBody === "string" ? Buffer.from(rawBody, "utf8") : rawBody;
  const digest = createHmac("sha256", secret).update(bodyBuf).digest("base64");
  const incoming = Buffer.from(hmacHeader.trim(), "utf8");
  const expected = Buffer.from(digest, "utf8");
  if (incoming.length !== expected.length) return false;
  try {
    return timingSafeEqual(incoming, expected);
  } catch {
    return false;
  }
}
