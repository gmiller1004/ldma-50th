/**
 * Mailchimp Marketing API helpers for E-commerce: resolve mc_eid to contact,
 * upsert store customer, and sync cart so automations (e.g. add-to-cart tags) work.
 * Requires MAILCHIMP_API_KEY and MAILCHIMP_STORE_ID in env. Store must be synced with Shopify.
 */

const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY;
const MAILCHIMP_STORE_ID = process.env.MAILCHIMP_STORE_ID;

function getConfig(): { apiKey: string; storeId: string; baseUrl: string } | null {
  if (!MAILCHIMP_API_KEY || !MAILCHIMP_STORE_ID) return null;
  const dc = MAILCHIMP_API_KEY.split("-").pop();
  if (!dc) return null;
  return {
    apiKey: MAILCHIMP_API_KEY,
    storeId: MAILCHIMP_STORE_ID,
    baseUrl: `https://${dc}.api.mailchimp.com/3.0`,
  };
}

async function mailchimpFetch<T>(
  config: { apiKey: string; baseUrl: string },
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${config.baseUrl}${path}`;
  const auth = Buffer.from(`anystring:${config.apiKey}`).toString("base64");
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mailchimp ${path}: ${res.status} ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export type MailchimpStore = { id: string; list_id: string; [k: string]: unknown };

/** Get store details; includes list_id (audience) for member lookup. */
export async function getMailchimpStore(
  storeId: string
): Promise<MailchimpStore | null> {
  const config = getConfig();
  if (!config || config.storeId !== storeId) return null;
  try {
    const store = await mailchimpFetch<MailchimpStore>(
      config,
      `/ecommerce/stores/${storeId}`
    );
    return store ?? null;
  } catch (e) {
    console.warn("[Mailchimp] getMailchimpStore failed:", e);
    return null;
  }
}

export type MailchimpMember = { email_address: string; unique_email_id?: string; [k: string]: unknown };

/** Resolve mc_eid to a list member's email. Uses the list (audience) tied to the store. */
export async function getMemberByUniqueEmailId(
  listId: string,
  uniqueEmailId: string
): Promise<MailchimpMember | null> {
  const config = getConfig();
  if (!config) return null;
  try {
    const q = new URLSearchParams({
      unique_email_id: uniqueEmailId,
      fields: "members.email_address,members.unique_email_id",
    });
    const data = await mailchimpFetch<{ members: MailchimpMember[] }>(
      config,
      `/lists/${listId}/members?${q}`
    );
    const member = data?.members?.[0] ?? null;
    return member ?? null;
  } catch (e) {
    console.warn("[Mailchimp] getMemberByUniqueEmailId failed:", e);
    return null;
  }
}

/** Add or update a store customer (required before adding cart). */
export async function addOrUpdateCustomer(
  storeId: string,
  customerId: string,
  body: { email_address: string; opt_in_status?: boolean }
): Promise<void> {
  const config = getConfig();
  if (!config || config.storeId !== storeId) return;
  await mailchimpFetch(config, `/ecommerce/stores/${storeId}/customers/${encodeURIComponent(customerId)}`, {
    method: "PUT",
    body: JSON.stringify({
      id: customerId,
      email_address: body.email_address,
      opt_in_status: body.opt_in_status ?? false,
    }),
  });
}

export type MailchimpCartLine = {
  id: string;
  product_id: string;
  product_variant_id: string;
  quantity: number;
  price: number;
};

/**
 * Mailchimp ecommerce data synced from Shopify uses numeric product/variant IDs, not Storefront GIDs
 * (e.g. gid://shopify/ProductVariant/123 → "123"). Cart / line GIDs use an opaque final segment — use that as id.
 */
export function shopifyGidToMailchimpId(gid: string): string {
  if (!gid) return gid;
  const tail = gid.split("/").pop() ?? gid;
  return tail;
}

/** Create or update a cart in the Mailchimp store. Uses Shopify cart id and product/variant ids. */
export async function addOrUpdateCart(
  storeId: string,
  cartId: string,
  customerId: string,
  payload: {
    currency_code: string;
    order_total: number;
    checkout_url: string;
    lines: MailchimpCartLine[];
  }
): Promise<void> {
  const config = getConfig();
  if (!config || config.storeId !== storeId) return;
  const mcCartId = shopifyGidToMailchimpId(cartId);
  const body = {
    id: mcCartId,
    customer: { id: customerId },
    currency_code: payload.currency_code,
    order_total: payload.order_total,
    checkout_url: payload.checkout_url,
    lines: payload.lines,
  };
  try {
    await mailchimpFetch(
      config,
      `/ecommerce/stores/${storeId}/carts/${encodeURIComponent(mcCartId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(body),
      }
    );
  } catch (e) {
    const err = e as Error;
    if (err.message?.includes("404")) {
      await mailchimpFetch(config, `/ecommerce/stores/${storeId}/carts`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    } else {
      throw e;
    }
  }
}

export function isMailchimpConfigured(): boolean {
  return Boolean(getConfig());
}
