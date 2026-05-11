import { NextRequest, NextResponse } from "next/server";
import {
  nextShopifyAdminPathFromLinkHeader,
  shopifyAdminRestJson,
  shopifyAdminRestJsonWithLink,
} from "@/lib/shopify-admin-auth";
import {
  syncShopifyOrderToSalesforce,
  type ShopifyOrderPayload,
} from "@/lib/salesforce-event-sync";
import { clearEventProductIdCache, getEventRegistrationProductIds } from "@/lib/shopify-event-products";

export const dynamic = "force-dynamic";

/** Vercel / Next cap; one HTTP request cannot safely process thousands of orders end-to-end. */
export const maxDuration = 300;

type OrdersJson = { orders?: ShopifyOrderPayload[] };

/**
 * Backfill event registrations: paginates Shopify orders since created_at_min and syncs each,
 * or sync a single order by Shopify order id.
 *
 * GET /api/cron/shopify-event-backfill?order_id=5678901234
 * GET /api/cron/shopify-event-backfill?created_at_min=2026-01-01T00:00:00Z&max_orders=500
 * GET /api/cron/shopify-event-backfill?created_at_min=...&max_orders=80&since_id=LAST_ORDER_ID
 *   (since_id optional: continue after that order id; use last_order_id from the previous JSON response.)
 *
 * Authorization: Bearer CRON_SECRET (when CRON_SECRET is set).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const orderIdSingle = searchParams.get("order_id")?.trim();

  if (orderIdSingle) {
    if (!/^\d+$/.test(orderIdSingle)) {
      return NextResponse.json(
        { error: "order_id must be numeric Shopify order id" },
        { status: 400 }
      );
    }
    clearEventProductIdCache();
    const json = await shopifyAdminRestJson<{ order?: ShopifyOrderPayload }>(
      `/orders/${orderIdSingle}.json`
    );
    const order = json?.order;
    if (!order) {
      return NextResponse.json(
        { error: "Order not found or Admin API failed" },
        { status: 404 }
      );
    }
    try {
      const r = await syncShopifyOrderToSalesforce(order);
      return NextResponse.json({
        ok: true,
        mode: "single_order",
        order_id: orderIdSingle,
        ...r,
      });
    } catch (e) {
      return NextResponse.json(
        { ok: false, mode: "single_order", order_id: orderIdSingle, thrown: String(e) },
        { status: 500 }
      );
    }
  }

  const createdAtMin = searchParams.get("created_at_min")?.trim();
  if (!createdAtMin) {
    return NextResponse.json(
      {
        error:
          "Pass order_id=NUMERIC_SHOPIFY_ORDER_ID or created_at_min=ISO8601 (e.g. 2026-01-01T00:00:00Z)",
      },
      { status: 400 }
    );
  }

  const maxOrders = Math.min(
    5000,
    Math.max(1, parseInt(searchParams.get("max_orders") || "500", 10) || 500)
  );

  const sinceIdRaw = searchParams.get("since_id")?.trim();
  const sinceId =
    sinceIdRaw && /^\d{1,20}$/.test(sinceIdRaw) ? sinceIdRaw : null;

  clearEventProductIdCache();
  const startedAt = Date.now();
  const eventProductIds = await getEventRegistrationProductIds();
  console.log("[shopify-event-backfill] start", {
    created_at_min: createdAtMin,
    maxOrders,
    since_id: sinceId,
    event_registration_product_count: eventProductIds.size,
    fetchTimeoutMs: process.env.SHOPIFY_ADMIN_FETCH_TIMEOUT_MS || "60000(default)",
  });

  let path: string | null =
    `/orders.json?status=any&limit=250&created_at_min=${encodeURIComponent(createdAtMin)}` +
    (sinceId ? `&since_id=${encodeURIComponent(sinceId)}` : "");

  let processedOrders = 0;
  let ordersWithSyncMessages = 0;
  const samples: unknown[] = [];
  let maxOrderIdSeen: bigint | null = null;

  while (path && processedOrders < maxOrders) {
    const { json, linkHeader } = await shopifyAdminRestJsonWithLink<OrdersJson>(path);
    const orders = json?.orders ?? [];
    console.log("[shopify-event-backfill] orders page", {
      pathSuffix: path.slice(0, 120),
      count: orders.length,
      elapsedMs: Date.now() - startedAt,
    });
    if (orders.length === 0) break;

    for (const order of orders) {
      if (processedOrders >= maxOrders) break;
      processedOrders += 1;
      if (order.id != null) {
        try {
          const bid = BigInt(String(order.id));
          if (maxOrderIdSeen == null || bid > maxOrderIdSeen) maxOrderIdSeen = bid;
        } catch {
          /* ignore */
        }
      }
      if (processedOrders === 1 || processedOrders % 50 === 0) {
        console.log("[shopify-event-backfill] progress", {
          processedOrders,
          maxOrders,
          elapsedMs: Date.now() - startedAt,
        });
      }
      try {
        const r = await syncShopifyOrderToSalesforce(order, { eventProductIds });
        if (r.errors.length) {
          ordersWithSyncMessages += 1;
          if (samples.length < 8) {
            samples.push({
              orderId: order.id,
              processedLineItems: r.processedLineItems,
              skippedLineItems: r.skippedLineItems,
              errors: r.errors,
            });
          }
        }
      } catch (e) {
        ordersWithSyncMessages += 1;
        if (samples.length < 8) samples.push({ orderId: order.id, thrown: String(e) });
      }
    }

    path = nextShopifyAdminPathFromLinkHeader(linkHeader);
    if (!path) break;
  }

  const durationMs = Date.now() - startedAt;
  const lastOrderId = maxOrderIdSeen != null ? maxOrderIdSeen.toString() : null;
  const likelyTimeout = durationMs >= 285_000;

  return NextResponse.json({
    ok: true,
    created_at_min: createdAtMin,
    since_id: sinceId,
    orders_seen: processedOrders,
    orders_with_errors_or_warnings: ordersWithSyncMessages,
    sample_issues: samples,
    duration_ms: durationMs,
    last_order_id: lastOrderId,
    next_chunk_hint:
      lastOrderId && processedOrders >= maxOrders
        ? `Re-run with the same created_at_min, same max_orders, and since_id=${lastOrderId} to continue without re-processing this batch.`
        : lastOrderId && processedOrders > 0 && likelyTimeout
          ? `Run likely hit the ~300s cap; re-run with since_id=${lastOrderId} to continue after the last order seen.`
          : undefined,
    likely_timeout: likelyTimeout,
    note:
      maxOrders > 250 || likelyTimeout
        ? "Serverless runs are capped (~300s on Vercel Pro with maxDuration). If each order does full Salesforce work, use max_orders 40-80 and chain since_id=last_order_id from each JSON response. Without since_id, each run starts from the newest orders again."
        : undefined,
  });
}
