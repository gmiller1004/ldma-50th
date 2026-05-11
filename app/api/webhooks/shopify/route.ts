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

function lineItemsLookUsable(order: ShopifyOrderPayload): boolean {
  const items = order.line_items;
  if (!Array.isArray(items) || items.length === 0) return false;
  return items.some(
    (li) =>
      li &&
      typeof li === "object" &&
      li.product_id != null &&
      li.product_id !== ""
  );
}

/** Webhook JSON is often slimmer than Admin REST; re-fetch when line items or product ids are missing. */
async function orderPayloadForSync(
  parsed: unknown,
  topic: string
): Promise<ShopifyOrderPayload | null> {
  const root = parsed as Record<string, unknown>;
  const fromWebhook = (root.order ?? root) as ShopifyOrderPayload;
  if (!fromWebhook || typeof fromWebhook !== "object" || fromWebhook.id == null) {
    return null;
  }
  const id = String(fromWebhook.id);
  if (!lineItemsLookUsable(fromWebhook)) {
    const json = await shopifyAdminRestJson<{ order?: ShopifyOrderPayload }>(
      `/orders/${id}.json`
    );
    const full = json?.order;
    if (full && lineItemsLookUsable(full)) {
      console.log("[webhooks/shopify] enriched order from Admin REST", { topic, orderId: id });
      return full;
    }
    if (full) {
      console.warn("[webhooks/shopify] Admin REST order still missing line_items/product_id", {
        topic,
        orderId: id,
      });
      return full;
    }
    console.error("[webhooks/shopify] Admin REST fetch failed for order", { topic, orderId: id });
    return fromWebhook;
  }
  return fromWebhook;
}

export async function POST(request: Request) {
  const topic = request.headers.get("X-Shopify-Topic") || "";
  const shopDomain = request.headers.get("X-Shopify-Shop-Domain") || "";

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
    console.warn("[webhooks/shopify] invalid HMAC (wrong secret or body altered)", {
      topic,
      shopDomain,
    });
    return NextResponse.json({ error: "Invalid HMAC" }, { status: 401 });
  }

  console.log("[webhooks/shopify] received", { topic, shopDomain });

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody) as unknown;
  } catch {
    console.warn("[webhooks/shopify] invalid JSON body", { topic, shopDomain });
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
        } else {
          console.warn("[webhooks/shopify] refunds/create order not found", { orderId });
        }
      }
      return NextResponse.json({ ok: true });
    }

    if (!topic.startsWith("orders/")) {
      console.log("[webhooks/shopify] ignored (not an order topic)", { topic, shopDomain });
      return NextResponse.json({ ok: true });
    }

    const order = await orderPayloadForSync(parsed, topic);
    if (!order) {
      console.warn("[webhooks/shopify] no order id in payload", { topic, shopDomain });
      return NextResponse.json({ ok: true });
    }

    const r = await syncShopifyOrderToSalesforce(order);
    console.log("[webhooks/shopify] sync result", { topic, orderId: order.id, ...r });
  } catch (e) {
    console.error("[webhooks/shopify] handler error:", e);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
