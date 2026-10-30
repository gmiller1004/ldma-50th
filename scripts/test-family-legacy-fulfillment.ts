/**
 * End-to-end check of the post-payment steps (Salesforce status + Task, owner email, member email)
 * using a test order on a contact owned by the given user. Cleans up the order and Task afterwards.
 * No Stripe charge is made.
 *
 *   npx tsx --env-file=.env.local scripts/test-family-legacy-fulfillment.ts <ownerEmail> <memberEmailForTest>
 */
import type Stripe from "stripe";
import { sql } from "@/lib/db";
import { getSalesforceRestClient } from "@/lib/salesforce";
import { fulfillFamilyLegacyCheckout } from "@/lib/family-legacy-orders";
import { FAMILY_LEGACY_PRICE_CENTS } from "@/lib/family-legacy-offer";

async function main() {
  const [ownerEmail, memberEmail] = process.argv.slice(2);
  if (!sql || !ownerEmail || !memberEmail) throw new Error("usage: <ownerEmail> <memberEmailForTest>");
  const client = await getSalesforceRestClient();
  if (!client) throw new Error("Salesforce not configured");
  const base = `${client.instanceUrl}/services/data/v59.0`;
  const headers = { Authorization: `Bearer ${client.accessToken}`, "Content-Type": "application/json" };

  const q = `SELECT Id, FirstName, LastName, Customer_Number__c, Legacy_Offer_Status__c FROM Contact WHERE Owner.Email = '${ownerEmail}' LIMIT 1`;
  const contact = ((await (await fetch(`${base}/query?q=${encodeURIComponent(q)}`, { headers })).json()) as {
    records: Record<string, string | null>[];
  }).records[0];
  if (!contact) throw new Error(`No contact owned by ${ownerEmail}`);
  console.log(`Test contact: ${contact.FirstName} ${contact.LastName} (${contact.Id}), status now "${contact.Legacy_Offer_Status__c}"`);

  const sessionId = `cs_test_family_legacy_${Date.now()}`;
  const [order] = (await sql`
    INSERT INTO family_legacy_orders (contact_id, member_number, member_name, member_email, sf_checkboxes_before, amount_cents,
                                      companion_name, companion_relationship, stripe_checkout_session_id)
    VALUES (${contact.Id}, ${contact.Customer_Number__c}, ${"TEST — " + [contact.FirstName, contact.LastName].join(" ")},
            ${memberEmail}, ${"Is Transferable checked, Is Companion not checked, Is PrePay Transfer not checked"}, ${FAMILY_LEGACY_PRICE_CENTS},
            ${"Test Companion"}, ${"spouse"}, ${sessionId})
    RETURNING id
  `) as { id: string }[];

  const fakeSession = {
    id: sessionId,
    amount_total: FAMILY_LEGACY_PRICE_CENTS,
    payment_intent: "pi_test_not_real",
    metadata: { order_id: order.id },
  } as unknown as Stripe.Checkout.Session;

  const first = await fulfillFamilyLegacyCheckout(fakeSession);
  console.log("\nFirst run:", JSON.stringify(first, null, 1));
  const second = await fulfillFamilyLegacyCheckout(fakeSession);
  console.log("Retry run (should redo only failed steps):", JSON.stringify(second, null, 1));

  const [row] = (await sql`SELECT * FROM family_legacy_orders WHERE id = ${order.id}`) as Record<string, unknown>[];
  for (const k of ["status", "paid_at", "sf_status_updated_at", "sf_task_id", "owner_name", "owner_email", "owner_notified_at", "member_confirmation_sent_at", "last_error"]) {
    console.log(`  ${k}: ${row[k] instanceof Date ? (row[k] as Date).toISOString() : row[k]}`);
  }

  const taskId = row.sf_task_id as string | null;
  if (taskId) {
    const t = (await (await fetch(`${base}/sobjects/Task/${taskId}?fields=Subject,OwnerId,WhoId,ActivityDate,Description`, { headers })).json()) as Record<string, string>;
    console.log(`\nTask ${taskId}: "${t.Subject}" due ${t.ActivityDate}\n--- description ---\n${t.Description}\n---`);
    const me = (await (await fetch(`${base}/chatter/users/me`, { headers })).json()) as { id: string };
    await fetch(`${base}/sobjects/Task/${taskId}`, { method: "PATCH", headers, body: JSON.stringify({ OwnerId: me.id }) });
    const del = await fetch(`${base}/sobjects/Task/${taskId}`, { method: "DELETE", headers });
    console.log(`Task deleted: ${del.ok}`);
  }
  if (row.sf_status_updated_at) {
    await fetch(`${base}/sobjects/Contact/${contact.Id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ Legacy_Offer_Status__c: contact.Legacy_Offer_Status__c }),
    });
    console.log(`Contact status restored to "${contact.Legacy_Offer_Status__c}"`);
  }
  await sql`DELETE FROM family_legacy_orders WHERE id = ${order.id}`;
  console.log("Test order deleted.");
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
