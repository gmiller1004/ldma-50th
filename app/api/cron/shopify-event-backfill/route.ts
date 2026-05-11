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
import { clearEventProductIdCache } from "@/lib/shopify-event-products";

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

  clearEventProductIdCache();

  const startedAt = Date.now();

  let path: string | null =
    `/orders.json?status=any&limit=250&created_at_min=${encodeURIComponent(createdAtMin)}`;

  let processedOrders = 0;
  let ordersWithSyncMessages = 0;
  const samples: unknown[] = [];

  while (path && processedOrders < maxOrders) {
    const { json, linkHeader } = await shopifyAdminRestJsonWithLink<OrdersJson>(path);
    const orders = json?.orders ?? [];
    if (orders.length === 0) break;

    for (const order of orders) {
      if (processedOrders >= maxOrders) break;
      processedOrders += 1;
      if (processedOrders === 1 || processedOrders % 50 === 0) {
        console.log("[shopify-event-backfill] progress", {
          processedOrders,
          maxOrders,
          elapsedMs: Date.now() - startedAt,
        });
      }
      try {
        const r = await syncShopifyOrderToSalesforce(order);
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

  return NextResponse.json({
    ok: true,
    created_at_min: createdAtMin,
    orders_seen: processedOrders,
    orders_with_errors_or_warnings: ordersWithSyncMessages,
    sample_issues: samples,
    duration_ms: durationMs,
    note:
      maxOrders > 250
        ? "Serverless runs are capped (~300s on Vercel Pro with maxDuration). Use multiple passes with the same created_at_min and a lower max_orders (e.g. 150-300) if you hit timeouts or see orders_seen below max_orders without finishing the store."
        : undefined,
  });
}
