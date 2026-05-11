/**
 * Salesforce Campaign + Campaign Member upserts for Shopify event orders.
 *
 * Requires custom fields on Campaign and CampaignMember (see docs/EVENT_SHOPIFY_SALESFORCE_SETUP.md).
 */

import { getSalesforceRestClient } from "@/lib/salesforce";
import {
  classifyEventRegistration,
  priceLevelMetafieldIdentifier,
  type RegistrationKind,
} from "@/lib/event-registration-classify";
import { VIP_UPSELL_PRODUCT_HANDLE } from "@/lib/events-config";
import { getEventRegistrationProductIds } from "@/lib/shopify-event-products";
import {
  shopifyAdminGraphql,
  shopifyAdminRestJson,
} from "@/lib/shopify-admin-auth";

const SF_VERSION = process.env.SALESFORCE_API_VERSION || "v59.0";

const campaignProductField =
  process.env.SF_CAMPAIGN_SHOPIFY_PRODUCT_FIELD?.trim() || "Shopify_Product_Id__c";
const cmOrderLineKeyField =
  process.env.SF_CM_ORDER_LINE_KEY_FIELD?.trim() || "Shopify_Order_Line_Key__c";
const cmOrderIdField =
  process.env.SF_CM_ORDER_ID_FIELD?.trim() || "Shopify_Order_Id__c";
const cmLineItemIdField =
  process.env.SF_CM_LINE_ITEM_ID_FIELD?.trim() || "Shopify_Line_Item_Id__c";
const cmRegistrationTypeField =
  process.env.SF_CM_REGISTRATION_TYPE_FIELD?.trim() || "Registration_Type__c";
const cmCancelledField =
  process.env.SF_CM_CANCELLED_FIELD?.trim() || "Cancelled__c";
const cmSeatCountField =
  process.env.SF_CM_SEAT_COUNT_FIELD?.trim() || "Seat_Count__c";

export type ShopifyOrderPayload = {
  id?: number | string;
  financial_status?: string | null;
  email?: string | null;
  contact_email?: string | null;
  customer?: {
    email?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
  billing_address?: {
    first_name?: string | null;
    last_name?: string | null;
  } | null;
  line_items?: ShopifyLineItemPayload[];
};

export type ShopifyLineItemPayload = {
  id?: number | string;
  product_id?: number | string | null;
  variant_id?: number | string | null;
  variant_title?: string | null;
  title?: string | null;
  quantity?: number | null;
  name?: string | null;
};

function escapeSoql(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function sfQuery<T extends Record<string, unknown>>(
  instanceUrl: string,
  token: string,
  soql: string
): Promise<T[]> {
  const res = await fetch(
    `${instanceUrl}/services/data/${SF_VERSION}/query?q=${encodeURIComponent(soql)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    console.error("[sf-event-sync] query failed:", await res.text());
    return [];
  }
  const data = (await res.json()) as { records?: T[] };
  return data.records ?? [];
}

async function sfPatch(
  instanceUrl: string,
  token: string,
  path: string,
  body: Record<string, unknown>
): Promise<boolean> {
  const res = await fetch(`${instanceUrl}/services/data/${SF_VERSION}${path}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error("[sf-event-sync] PATCH failed:", path, await res.text());
    return false;
  }
  return true;
}

async function findContactIdByEmail(
  instanceUrl: string,
  token: string,
  email: string
): Promise<string | null> {
  const q = `SELECT Id FROM Contact WHERE Email = '${escapeSoql(email)}' ORDER BY CreatedDate ASC LIMIT 1`;
  const rows = await sfQuery<{ Id: string }>(instanceUrl, token, q);
  return rows[0]?.Id ?? null;
}

function contactNamesFromOrder(order: ShopifyOrderPayload, email: string): {
  firstName: string;
  lastName: string;
} {
  const c = order.customer;
  const b = order.billing_address;
  let first =
    (c?.first_name || b?.first_name || "").trim() ||
    (email.split("@")[0] || "Shopify").slice(0, 40);
  let last = (c?.last_name || b?.last_name || "").trim();
  if (!last) last = "Customer";
  if (first.length > 40) first = first.slice(0, 40);
  if (last.length > 80) last = last.slice(0, 80);
  return { firstName: first, lastName: last };
}

async function createContactForShopifyBuyer(
  instanceUrl: string,
  token: string,
  order: ShopifyOrderPayload,
  email: string
): Promise<string | null> {
  const { firstName, lastName } = contactNamesFromOrder(order, email);
  const body: Record<string, unknown> = {
    Email: email,
    FirstName: firstName,
    LastName: lastName,
  };
  const descOpt = process.env.SF_EVENT_SYNC_CONTACT_DESCRIPTION?.trim();
  if (descOpt) body.Description = descOpt.slice(0, 255);

  const res = await fetch(`${instanceUrl}/services/data/${SF_VERSION}/sobjects/Contact`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (res.ok) {
    const created = (await res.json()) as { id?: string };
    return created.id ?? null;
  }

  const errText = await res.text();
  console.error("[sf-event-sync] create Contact failed:", errText);

  if (res.status === 400 || res.status === 409) {
    const retry = await findContactIdByEmail(instanceUrl, token, email);
    if (retry) return retry;
  }

  return null;
}

async function findOrCreateContactForShopifyOrder(
  instanceUrl: string,
  token: string,
  order: ShopifyOrderPayload,
  email: string
): Promise<string | null> {
  const existing = await findContactIdByEmail(instanceUrl, token, email);
  if (existing) return existing;

  const allowCreate =
    process.env.SF_EVENT_SYNC_CREATE_CONTACTS !== "false" &&
    process.env.SF_EVENT_SYNC_CREATE_CONTACTS !== "0";
  if (!allowCreate) return null;

  return createContactForShopifyBuyer(instanceUrl, token, order, email);
}

async function findCampaignIdByProductId(
  instanceUrl: string,
  token: string,
  productId: string
): Promise<string | null> {
  const q = `SELECT Id FROM Campaign WHERE ${campaignProductField} = '${escapeSoql(productId)}' LIMIT 1`;
  const rows = await sfQuery<{ Id: string }>(instanceUrl, token, q);
  return rows[0]?.Id ?? null;
}

async function createCampaign(
  instanceUrl: string,
  token: string,
  productId: string,
  name: string
): Promise<string | null> {
  const body: Record<string, unknown> = {
    Name: name.slice(0, 80),
    Status: "Planned",
    IsActive: true,
    [campaignProductField]: productId,
  };
  const res = await fetch(`${instanceUrl}/services/data/${SF_VERSION}/sobjects/Campaign`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error("[sf-event-sync] create Campaign failed:", await res.text());
    return null;
  }
  const created = (await res.json()) as { id?: string };
  return created.id ?? null;
}

async function ensureCampaign(
  instanceUrl: string,
  token: string,
  productId: string,
  defaultName: string
): Promise<string | null> {
  const existing = await findCampaignIdByProductId(instanceUrl, token, productId);
  if (existing) return existing;
  return createCampaign(instanceUrl, token, productId, defaultName);
}

function variantGid(variantId: string): string {
  if (variantId.startsWith("gid://")) return variantId;
  return `gid://shopify/ProductVariant/${variantId}`;
}

async function fetchVariantPriceLevel(variantId: string): Promise<string | null> {
  const { namespace, key } = priceLevelMetafieldIdentifier();
  type Data = {
    productVariant: {
      metafield?: { value?: string | null } | null;
    } | null;
  };
  const res = await shopifyAdminGraphql<Data>(
    `#graphql
    query VariantPriceLevel($id: ID!, $ns: String!, $key: String!) {
      productVariant(id: $id) {
        metafield(namespace: $ns, key: $key) {
          value
        }
      }
    }`,
    { id: variantGid(variantId), ns: namespace, key }
  );
  const v = res?.data?.productVariant?.metafield?.value;
  return v?.trim() ? v : null;
}

type ProductCache = { handle?: string; title?: string; tags?: string };

async function fetchProductMeta(productId: string): Promise<ProductCache | null> {
  const json = await shopifyAdminRestJson<{ product?: ProductCache }>(
    `/products/${productId}.json?fields=id,handle,title,tags`
  );
  return json?.product ?? null;
}

function orderBuyerEmail(order: ShopifyOrderPayload): string | null {
  const e =
    order.email ||
    order.contact_email ||
    order.customer?.email ||
    null;
  return typeof e === "string" && e.includes("@") ? e.trim().toLowerCase() : null;
}

function isFullyRefunded(order: ShopifyOrderPayload): boolean {
  const fs = (order.financial_status || "").toLowerCase();
  return fs === "refunded";
}

function isPaidEnough(order: ShopifyOrderPayload): boolean {
  const fs = (order.financial_status || "").toLowerCase();
  return fs === "paid" || fs === "partially_paid";
}

/** Mark every Campaign Member for this order as cancelled (full refund path). */
export async function cancelCampaignMembersForShopifyOrder(
  orderId: string
): Promise<{ ok: boolean; error?: string }> {
  const client = await getSalesforceRestClient();
  if (!client) return { ok: false, error: "Salesforce not configured" };

  const q = `SELECT Id FROM CampaignMember WHERE ${cmOrderIdField} = '${escapeSoql(orderId)}'`;
  const rows = await sfQuery<{ Id: string }>(
    client.instanceUrl,
    client.accessToken,
    q
  );

  let ok = true;
  for (const row of rows) {
    const patchOk = await sfPatch(
      client.instanceUrl,
      client.accessToken,
      `/sobjects/CampaignMember/${row.Id}`,
      { [cmCancelledField]: true }
    );
    if (!patchOk) ok = false;
  }

  return { ok };
}

export type SyncOrderResult = {
  processedLineItems: number;
  skippedLineItems: number;
  errors: string[];
};

/**
 * Process a Shopify Admin order JSON payload (from webhook or REST fetch).
 */
export async function syncShopifyOrderToSalesforce(
  order: ShopifyOrderPayload
): Promise<SyncOrderResult> {
  const result: SyncOrderResult = {
    processedLineItems: 0,
    skippedLineItems: 0,
    errors: [],
  };

  const client = await getSalesforceRestClient();
  if (!client) {
    result.errors.push("Salesforce not configured");
    return result;
  }

  const orderId = order.id != null ? String(order.id) : null;
  if (!orderId) {
    result.errors.push("Order missing id");
    return result;
  }

  if (isFullyRefunded(order)) {
    const cr = await cancelCampaignMembersForShopifyOrder(orderId);
    if (!cr.ok) result.errors.push(cr.error || "Cancel members failed");
    return result;
  }

  if (!isPaidEnough(order)) {
    return result;
  }

  const buyerEmail = orderBuyerEmail(order);
  if (!buyerEmail) {
    result.errors.push("Order missing customer email");
    return result;
  }

  const contactId = await findOrCreateContactForShopifyOrder(
    client.instanceUrl,
    client.accessToken,
    order,
    buyerEmail
  );
  if (!contactId) {
    result.errors.push(
      `No Salesforce Contact for ${buyerEmail} and auto-create failed or is disabled (SF_EVENT_SYNC_CREATE_CONTACTS)`
    );
    return result;
  }

  const eventProductIds = await getEventRegistrationProductIds();
  const items = order.line_items ?? [];

  const productMetaCache = new Map<string, ProductCache | null>();

  for (const line of items) {
    const productId =
      line.product_id != null && line.product_id !== ""
        ? String(line.product_id)
        : null;
    if (!productId || !eventProductIds.has(productId)) {
      result.skippedLineItems += 1;
      continue;
    }

    let meta = productMetaCache.get(productId);
    if (meta === undefined) {
      meta = await fetchProductMeta(productId);
      productMetaCache.set(productId, meta);
    }

    if (meta?.handle === VIP_UPSELL_PRODUCT_HANDLE) {
      result.skippedLineItems += 1;
      continue;
    }

    const tags = (meta?.tags || "").toLowerCase();
    if (/\bvip\b/.test(tags) && /\bupgrade\b/.test(tags)) {
      result.skippedLineItems += 1;
      continue;
    }

    const variantTitle =
      (line.variant_title || line.title || line.name || "").trim() || "Registration";
    const variantId =
      line.variant_id != null && line.variant_id !== ""
        ? String(line.variant_id)
        : null;

    let priceLevel: string | null = null;
    if (variantId) {
      priceLevel = await fetchVariantPriceLevel(variantId);
    }

    const kind: RegistrationKind | null = classifyEventRegistration({
      variantTitle,
      priceLevelMetafield: priceLevel,
    });
    if (!kind) {
      result.skippedLineItems += 1;
      result.errors.push(
        `Could not classify registration type for line ${line.id} (${variantTitle})`
      );
      continue;
    }

    const campaignName =
      (meta?.title || line.name || line.title || `Event ${productId}`).slice(0, 120);

    const campaignId = await ensureCampaign(
      client.instanceUrl,
      client.accessToken,
      productId,
      campaignName
    );
    if (!campaignId) {
      result.errors.push(`Failed to ensure Campaign for product ${productId}`);
      continue;
    }

    const lineItemId = line.id != null ? String(line.id) : null;
    if (!lineItemId) {
      result.skippedLineItems += 1;
      continue;
    }

    const externalKey = `${orderId}_${lineItemId}`;
    const qty = Math.max(1, Math.floor(Number(line.quantity) || 1));

    const cmBody: Record<string, unknown> = {
      CampaignId: campaignId,
      ContactId: contactId,
      Status: "Responded",
      [cmOrderLineKeyField]: externalKey,
      [cmOrderIdField]: orderId,
      [cmLineItemIdField]: lineItemId,
      [cmRegistrationTypeField]: kind,
      [cmCancelledField]: false,
      [cmSeatCountField]: qty,
    };

    const upsertPath = `/sobjects/CampaignMember/${cmOrderLineKeyField}/${externalKey}`;
    const patchOk = await sfPatch(
      client.instanceUrl,
      client.accessToken,
      upsertPath,
      cmBody
    );

    if (!patchOk) {
      const postRes = await fetch(
        `${client.instanceUrl}/services/data/${SF_VERSION}/sobjects/CampaignMember`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${client.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(cmBody),
        }
      );
      if (!postRes.ok) {
        result.errors.push(
          `CampaignMember upsert failed for ${externalKey}: ${await postRes.text()}`
        );
        continue;
      }
    }

    result.processedLineItems += 1;
  }

  return result;
}
