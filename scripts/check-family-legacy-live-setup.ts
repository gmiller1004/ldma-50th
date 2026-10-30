/**
 * No-charge live checks for the Family Legacy offer:
 * 1. Legacy_Offer_Status__c picklist includes the paid status exactly.
 * 2. The production Stripe key can create the offer's Checkout session (expired immediately, never paid).
 * 3. The Stripe webhook endpoint listens for checkout.session.completed.
 *
 *   npx tsx --env-file=.env.local scripts/check-family-legacy-live-setup.ts
 */
import Stripe from "stripe";
import { getSalesforceRestClient } from "@/lib/salesforce";
import {
  FAMILY_LEGACY_OFFER_PATH,
  FAMILY_LEGACY_PAYMENT_TYPE,
  FAMILY_LEGACY_PRICE_CENTS,
  LEGACY_STATUS_PAID_PENDING_ADDENDUM,
} from "@/lib/family-legacy-offer";

async function main() {
  const sf = await getSalesforceRestClient();
  if (!sf) throw new Error("Salesforce not configured");
  const describe = (await (
    await fetch(`${sf.instanceUrl}/services/data/v59.0/sobjects/Contact/describe`, {
      headers: { Authorization: `Bearer ${sf.accessToken}` },
    })
  ).json()) as { fields: { name: string; picklistValues: { value: string; active: boolean }[] }[] };
  const values = describe.fields.find((f) => f.name === "Legacy_Offer_Status__c")?.picklistValues ?? [];
  console.log(`Picklist values: ${values.map((v) => JSON.stringify(v.value) + (v.active ? "" : " (inactive)")).join(", ")}`);
  const match = values.find((v) => v.value === LEGACY_STATUS_PAID_PENDING_ADDENDUM && v.active);
  console.log(`"${LEGACY_STATUS_PAID_PENDING_ADDENDUM}" present and active: ${Boolean(match)}`);

  const key = process.env.STRIPE_RESTRICTED_KEY || process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("No Stripe key");
  console.log(`\nStripe key: ${key.startsWith("rk_live") ? "restricted live" : key.startsWith("sk_live") ? "secret live" : key.slice(0, 8)}`);
  const stripe = new Stripe(key);
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://myldma.com";
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    currency: "usd",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: FAMILY_LEGACY_PRICE_CENTS,
          product_data: {
            name: "Complete Family Legacy Add-On — Member Offer",
            description: "Adds Transferability, Companion, and Pre-Paid Transfer Fee to LDMA membership #TEST. Applied after the addendum is signed.",
          },
        },
      },
    ],
    success_url: `${base}${FAMILY_LEGACY_OFFER_PATH}?paid=1`,
    cancel_url: `${base}${FAMILY_LEGACY_OFFER_PATH}?cancelled=1`,
    customer_email: "gmiller@goldprospectors.org",
    payment_intent_data: { description: "Family Legacy add-on — setup check (never paid)" },
    metadata: { payment_type: FAMILY_LEGACY_PAYMENT_TYPE, order_id: "00000000-0000-0000-0000-000000000000", setup_check: "true" },
  });
  console.log(`Checkout session created: ${session.id} (${session.livemode ? "live" : "test"} mode), amount $${(session.amount_total ?? 0) / 100}, url ${session.url ? "ok" : "MISSING"}`);
  const expired = await stripe.checkout.sessions.expire(session.id);
  console.log(`Session expired so it can never be paid: ${expired.status}`);

  try {
    const endpoints = await stripe.webhookEndpoints.list({ limit: 20 });
    for (const e of endpoints.data) {
      const listens = e.enabled_events.includes("*") || e.enabled_events.includes("checkout.session.completed");
      console.log(`Webhook ${e.url} · ${e.status} · checkout.session.completed: ${listens}`);
    }
  } catch (e) {
    console.log(`Webhook endpoints not readable with this key (${e instanceof Error ? e.message.slice(0, 80) : e})`);
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
