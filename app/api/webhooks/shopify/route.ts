import { NextResponse } from "next/server";
import { verifyShopifyWebhookBody } from "@/lib/shopify-webhook-verify";
import { getShopifyWebhookSecret } from "@/lib/shopify-admin-auth";
import {
  syncShopifyOrderToSalesforce,
  type ShopifyOrderPayload,
} from "@/lib/salesforce-event-sync";
import { shopifyAdminRestJson } from "@/lib/shopify-admin-auth";

export const dynamic = "force-dynamic";

type RefundPayload = {
  order_id?: number | string;
};

export async function POST(request: Request) {
  const secret = getShopifyWebhookSecret();
  if (!secret) {
    console.error(
      "[webhooks/shopify] Missing webhook HMAC secret: set SHOPIFY_ADMIN_API_CLIENT_SECRET or SHOPIFY_ADMIN_WEBHOOK_SECRET (SHOPIFY_WEBHOOK_SECRET only if it matches this Shopify app)"
    );
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const hmac = request.headers.get("X-Shopify-Hmac-Sha256");
  if (!verifyShopifyWebhookBody(rawBody, hmac, secret)) {
    return NextResponse.json({ error: "Invalid HMAC" }, { status: 401 });
  }

  const topic = request.headers.get("X-Shopify-Topic") || "";

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    if (topic === "refunds/create") {
      const refund = parsed as RefundPayload;
      const orderId = refund.order_id;
      if (orderId != null) {
        const json = await shopifyAdminRestJson<{ order?: ShopifyOrderPayload }>(
          `/orders/${orderId}.json`
        );
        const order = json?.order;
        if (order) {
          const r = await syncShopifyOrderToSalesforce(order);
          console.log("[webhooks/shopify] refunds/create", topic, r);
        }
      }
      return NextResponse.json({ ok: true });
    }

    const root = parsed as Record<string, unknown>;
    const order = (root.order ?? root) as ShopifyOrderPayload;
    if (order && typeof order === "object" && order.id != null) {
      const r = await syncShopifyOrderToSalesforce(order);
      console.log("[webhooks/shopify]", topic, r);
    }
  } catch (e) {
    console.error("[webhooks/shopify] handler error:", e);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
