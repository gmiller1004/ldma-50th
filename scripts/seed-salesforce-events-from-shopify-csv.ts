/**
 * Seed Salesforce event CampaignMembers from a Shopify **Orders** CSV export.
 *
 * The export does not include product_id or line_item_id; we use the CSV only to
 * decide which Shopify order ids are paid, then GET each order once from Admin
 * REST and run the same sync as webhooks/cron.
 *
 *   npm run sf:seed-events-csv
 *   npm run sf:seed-events-csv -- --file data/ldma-event-backfill/orders_export_1.csv --limit 10 --dry-run
 *   npm run sf:seed-events-csv -- --since-order-id 6670000000000
 *
 * Requires Admin API credentials for the **same** Shopify store the CSV was exported from
 * (order ids are store-specific). Optional: EVENT_COLLECTION_HANDLE if your collection is not `events`.
 * Use --ignore-probe-failure to run despite a failed first-order probe (not recommended).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { EVENT_COLLECTION_HANDLE } from "@/lib/events-config";
import {
  getShopifyAdminAccessToken,
  getShopifyShopDomain,
  shopifyAdminRestDiagnostics,
  shopifyAdminRestJson,
} from "@/lib/shopify-admin-auth";
import { getEventRegistrationProductIds } from "@/lib/shopify-event-products";
import {
  syncShopifyOrderToSalesforce,
  type ShopifyOrderPayload,
} from "@/lib/salesforce-event-sync";

const PAID_FINANCIAL = new Set(["paid", "partially_paid"]);

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function headerIndex(headerRow: string[]): Map<string, number> {
  const m = new Map<string, number>();
  headerRow.forEach((h, i) => m.set(h.trim(), i));
  return m;
}

function parseArgs(): {
  file: string;
  limit: number | null;
  dryRun: boolean;
  sinceOrderId: bigint | null;
  concurrency: number;
  ignoreProbeFailure: boolean;
} {
  const argv = process.argv.slice(2);
  let file = "data/ldma-event-backfill/orders_export_1.csv";
  let limit: number | null = null;
  let dryRun = false;
  let sinceOrderId: bigint | null = null;
  let concurrency = 1;
  let ignoreProbeFailure = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--dry-run") dryRun = true;
    else if (a === "--ignore-probe-failure") ignoreProbeFailure = true;
    else if (a.startsWith("--file=")) file = a.slice("--file=".length);
    else if (a === "--file" && argv[i + 1]) {
      file = argv[++i]!;
    } else if (a.startsWith("--limit=")) {
      const n = parseInt(a.slice("--limit=".length), 10);
      if (Number.isFinite(n) && n > 0) limit = n;
    } else if (a === "--limit" && argv[i + 1]) {
      const n = parseInt(argv[++i]!, 10);
      if (Number.isFinite(n) && n > 0) limit = n;
    } else if (a.startsWith("--since-order-id=")) {
      const s = a.slice("--since-order-id=".length).trim();
      if (/^\d+$/.test(s)) sinceOrderId = BigInt(s);
    } else if (a === "--since-order-id" && argv[i + 1]) {
      const s = argv[++i]!.trim();
      if (/^\d+$/.test(s)) sinceOrderId = BigInt(s);
    } else if (a.startsWith("--concurrency=")) {
      const n = parseInt(a.slice("--concurrency=".length), 10);
      if (Number.isFinite(n) && n >= 1 && n <= 8) concurrency = n;
    }
  }

  return { file, limit, dryRun, sinceOrderId, concurrency, ignoreProbeFailure };
}

function collectPaidOrderIds(
  lines: string[],
  idx: Map<string, number>
): string[] {
  const idCol = idx.get("Id");
  const fsCol = idx.get("Financial Status");
  if (idCol == null || fsCol == null) {
    throw new Error(
      'CSV must include "Id" and "Financial Status" columns (Shopify orders export).'
    );
  }

  let carryId = "";
  let carryFs = "";
  const seen = new Set<string>();

  for (let r = 1; r < lines.length; r++) {
    const line = lines[r]!.trimEnd();
    if (!line.trim()) continue;
    const cells = parseCsvLine(line);
    const id = (cells[idCol] ?? "").trim();
    if (id && /^\d+$/.test(id)) carryId = id;
    const fs = (cells[fsCol] ?? "").trim().toLowerCase();
    if (fs) carryFs = fs;
    if (!carryId || !/^\d+$/.test(carryId)) continue;
    if (PAID_FINANCIAL.has(carryFs)) seen.add(carryId);
  }

  const sorted = [...seen].sort((a, b) => {
    const na = BigInt(a);
    const nb = BigInt(b);
    if (na < nb) return -1;
    if (na > nb) return 1;
    return 0;
  });

  return sorted;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, i: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]!, i);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () =>
    worker()
  );
  await Promise.all(workers);
  return results;
}

async function main() {
  const { file, limit, dryRun, sinceOrderId, concurrency, ignoreProbeFailure } =
    parseArgs();
  const abs = resolve(process.cwd(), file);
  const raw = readFileSync(abs, "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) {
    console.error("CSV empty or missing data rows:", abs);
    process.exit(1);
  }

  const header = parseCsvLine(lines[0]!);
  const idx = headerIndex(header);
  let orderIds = collectPaidOrderIds(lines, idx);

  if (sinceOrderId != null) {
    orderIds = orderIds.filter((id) => BigInt(id) > sinceOrderId);
  }
  if (limit != null) orderIds = orderIds.slice(0, limit);

  console.log("[sf-seed-csv]", {
    file: abs,
    paid_order_count: orderIds.length,
    dryRun,
    sinceOrderId: sinceOrderId?.toString() ?? null,
    concurrency,
    event_collection_handle: EVENT_COLLECTION_HANDLE,
  });

  if (dryRun) {
    console.log("[sf-seed-csv] order ids (first 40):", orderIds.slice(0, 40));
    return;
  }

  const shopDomain = getShopifyShopDomain();
  const tokenPresent = Boolean(await getShopifyAdminAccessToken());
  console.log("[sf-seed-csv] shopify_env", {
    shop_domain: shopDomain ?? "(missing — set NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN or SHOPIFY_SHOP_DOMAIN)",
    admin_token_resolved: tokenPresent,
  });

  if (!shopDomain || !tokenPresent) {
    console.error(
      "[sf-seed-csv] Missing Shopify shop domain or Admin token. Fix .env.local before seeding."
    );
    process.exit(1);
  }

  const shopProbe = await shopifyAdminRestDiagnostics("/shop.json");
  if (shopProbe.ok && shopProbe.data && typeof shopProbe.data === "object") {
    const s = (shopProbe.data as { shop?: { name?: string; myshopify_domain?: string } })
      .shop;
    console.log("[sf-seed-csv] admin_api_connected_store", {
      name: s?.name ?? null,
      myshopify_domain: s?.myshopify_domain ?? null,
    });
  } else {
    console.warn("[sf-seed-csv] shop.json probe failed (check token scopes)", shopProbe);
  }

  if (orderIds.length > 0) {
    const path = `/orders/${orderIds[0]}.json`;
    const orderProbe = await shopifyAdminRestDiagnostics(path);
    if (!orderProbe.ok) {
      if ("reason" in orderProbe) {
        console.error("[sf-seed-csv] Probe: no token or shop.");
        process.exit(1);
      }
      const { status, detail, shop: failShop, path } = orderProbe;
      console.error("[sf-seed-csv] probe_first_order FAILED", {
        sample_order_id: orderIds[0],
        path,
        shop: failShop,
        http_status: status,
        detail: detail.slice(0, 600),
      });
      if (status === 404) {
        console.error(
          "[sf-seed-csv] HTTP 404 means this order id does not exist on the store your Admin token uses.\n" +
            "Your CSV is almost certainly from a different Shopify shop than " +
            shopDomain +
            ".\n" +
            "Fix: set NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN / SHOPIFY_SHOP_DOMAIN (and token) to the **Lost Dutchman's** myshopify.com host you exported from, then re-run."
        );
      } else if (status === 403) {
        console.error(
          "[sf-seed-csv] HTTP 403: token may lack read_orders / read_all_orders for this shop."
        );
      }
      if (!ignoreProbeFailure) process.exit(1);
    } else {
      const body = orderProbe.data as { order?: { id?: unknown } };
      if (!body?.order) {
        console.error(
          "[sf-seed-csv] probe_first_order: 200 response but no `order` key — unexpected shape"
        );
        if (!ignoreProbeFailure) process.exit(1);
      }
    }
  }

  const eventProductIds = await getEventRegistrationProductIds();
  console.log("[sf-seed-csv] event_registration_product_count", eventProductIds.size);
  if (eventProductIds.size === 0) {
    console.error(
      "[sf-seed-csv] No products in the `" +
        EVENT_COLLECTION_HANDLE +
        "` collection on this store — every line item will be skipped.\n" +
        "Create/rename a collection with handle `" +
        EVENT_COLLECTION_HANDLE +
        "` and add event products, or set EVENT_COLLECTION_HANDLE in .env.local to match your real handle."
    );
  }

  let ok = 0;
  let withErrors = 0;
  let fetchFailed = 0;

  async function runOne(orderId: string): Promise<"ok" | "warn" | "miss"> {
    const json = await shopifyAdminRestJson<{ order?: ShopifyOrderPayload }>(
      `/orders/${orderId}.json`
    );
    if (!json?.order) {
      console.warn("[sf-seed-csv] order fetch miss", orderId);
      return "miss";
    }
    const r = await syncShopifyOrderToSalesforce(json.order, { eventProductIds });
    if (r.errors.length) {
      console.warn("[sf-seed-csv] sync messages", {
        orderId,
        processedLineItems: r.processedLineItems,
        skippedLineItems: r.skippedLineItems,
        errors: r.errors,
      });
      return "warn";
    }
    return "ok";
  }

  if (concurrency <= 1) {
    for (let i = 0; i < orderIds.length; i++) {
      const orderId = orderIds[i]!;
      if (i > 0 && i % 25 === 0) {
        console.log("[sf-seed-csv] progress", { i, total: orderIds.length });
      }
      const out = await runOne(orderId);
      if (out === "ok") ok += 1;
      else if (out === "warn") withErrors += 1;
      else fetchFailed += 1;
    }
  } else {
    const outcomes = await mapPool(orderIds, concurrency, async (orderId, i) => {
      if (i > 0 && i % 25 === 0) {
        console.log("[sf-seed-csv] progress", { i, total: orderIds.length });
      }
      return runOne(orderId);
    });
    for (const o of outcomes) {
      if (o === "ok") ok += 1;
      else if (o === "warn") withErrors += 1;
      else fetchFailed += 1;
    }
  }

  console.log("[sf-seed-csv] done", {
    ok_no_sync_errors: ok,
    with_errors_or_warnings: withErrors,
    fetch_failed: fetchFailed,
    total: orderIds.length,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
