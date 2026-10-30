/**
 * Family Legacy offer orders: storage, member eligibility, and post-payment fulfillment
 * (Salesforce status + Task for the contact owner, owner email, member confirmation).
 */

import { cookies } from "next/headers";
import type Stripe from "stripe";
import { sql, hasDb } from "@/lib/db";
import { verifySessionToken } from "@/lib/session";
import { lookupMember, type MemberLookupResult } from "@/lib/salesforce";
import {
  buildFamilyLegacyTaskDescription,
  familyLegacyEligibility,
  LEGACY_STATUS_PAID_PENDING_ADDENDUM,
  type FamilyLegacyEligibility,
  type FamilyLegacyIntake,
} from "@/lib/family-legacy-offer";
import {
  createFamilyLegacyTask,
  resolveFamilyLegacyAssignee,
  salesforceContactUrl,
  setLegacyOfferStatus,
} from "@/lib/salesforce-family-legacy";
import {
  sendFamilyLegacyMemberConfirmationEmail,
  sendFamilyLegacyOwnerNotificationEmail,
} from "@/lib/sendgrid";

export type FamilyLegacyOrderRow = {
  id: string;
  contact_id: string;
  member_number: string | null;
  member_name: string | null;
  member_email: string | null;
  sf_checkboxes_before: string | null;
  amount_cents: number;
  status: string;
  companion_name: string | null;
  companion_relationship: string | null;
  heir_name: string | null;
  heir_relationship: string | null;
  notes: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  paid_at: string | Date | null;
  sf_status_updated_at: string | Date | null;
  sf_task_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
  owner_notified_at: string | Date | null;
  member_confirmation_sent_at: string | Date | null;
};

export type FamilyLegacyMemberContext = {
  member: MemberLookupResult & { contactId: string };
  memberNumber: string;
  eligibility: FamilyLegacyEligibility;
};

export async function hasPaidFamilyLegacyOrder(contactId: string): Promise<boolean> {
  if (!hasDb() || !sql) return false;
  const rows = await sql`
    SELECT 1 FROM family_legacy_orders WHERE contact_id = ${contactId} AND status = 'paid' LIMIT 1
  `;
  return Array.isArray(rows) && rows.length > 0;
}

/** Logged-in member plus offer eligibility; null when not logged in or not found. */
export async function getFamilyLegacyMemberContext(): Promise<FamilyLegacyMemberContext | null> {
  const token = (await cookies()).get("member_session")?.value;
  if (!token) return null;
  const session = await verifySessionToken(token);
  if (!session) return null;
  const member = await lookupMember(session.memberNumber);
  if (!member.valid || !member.contactId) return null;
  const paid = await hasPaidFamilyLegacyOrder(member.contactId);
  return {
    member: member as MemberLookupResult & { contactId: string },
    memberNumber: session.memberNumber,
    eligibility: familyLegacyEligibility(member, paid),
  };
}

export async function createPendingFamilyLegacyOrder(input: {
  contactId: string;
  memberNumber: string;
  memberName: string;
  memberEmail: string | null;
  checkboxesBefore: string;
  amountCents: number;
  intake: FamilyLegacyIntake;
}): Promise<string> {
  if (!sql) throw new Error("Database not available");
  const rows = (await sql`
    INSERT INTO family_legacy_orders (
      contact_id, member_number, member_name, member_email, sf_checkboxes_before, amount_cents,
      companion_name, companion_relationship, heir_name, heir_relationship, notes
    ) VALUES (
      ${input.contactId}, ${input.memberNumber}, ${input.memberName}, ${input.memberEmail},
      ${input.checkboxesBefore}, ${input.amountCents},
      ${input.intake.companionName || null}, ${input.intake.companionRelationship || null},
      ${input.intake.heirName || null}, ${input.intake.heirRelationship || null}, ${input.intake.notes || null}
    )
    RETURNING id
  `) as { id: string }[];
  return rows[0].id;
}

export async function attachCheckoutSession(orderId: string, sessionId: string): Promise<void> {
  if (!sql) return;
  await sql`
    UPDATE family_legacy_orders SET stripe_checkout_session_id = ${sessionId}, updated_at = NOW()
    WHERE id = ${orderId}
  `;
}

async function loadOrder(orderId: string | null, sessionId: string): Promise<FamilyLegacyOrderRow | null> {
  if (!sql) return null;
  const rows = (await sql`
    SELECT * FROM family_legacy_orders
    WHERE stripe_checkout_session_id = ${sessionId} OR (${orderId}::uuid IS NOT NULL AND id = ${orderId}::uuid)
    ORDER BY (stripe_checkout_session_id = ${sessionId}) DESC
    LIMIT 1
  `) as FamilyLegacyOrderRow[];
  return rows[0] ?? null;
}

function toIso(value: string | Date | null): string {
  if (!value) return new Date().toISOString();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Record payment and notify the contact owner. Each step is recorded on the order so Stripe retries
 * only redo what failed. `notified` is false when neither the Task nor the owner email went out.
 */
export async function fulfillFamilyLegacyCheckout(
  session: Stripe.Checkout.Session
): Promise<{ found: boolean; notified: boolean; errors: string[] }> {
  if (!hasDb() || !sql) return { found: false, notified: false, errors: ["Database not available"] };
  const orderId = session.metadata?.order_id || null;
  let order = await loadOrder(orderId, session.id);
  if (!order) return { found: false, notified: false, errors: [`No order for session ${session.id}`] };

  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
  const updated = (await sql`
    UPDATE family_legacy_orders
    SET status = 'paid', paid_at = COALESCE(paid_at, NOW()),
        amount_cents = ${session.amount_total ?? order.amount_cents},
        stripe_checkout_session_id = COALESCE(stripe_checkout_session_id, ${session.id}),
        stripe_payment_intent_id = COALESCE(stripe_payment_intent_id, ${paymentIntentId}),
        updated_at = NOW()
    WHERE id = ${order.id}
    RETURNING *
  `) as FamilyLegacyOrderRow[];
  order = updated[0];

  const errors: string[] = [];
  const intake: FamilyLegacyIntake = {
    companionName: order.companion_name ?? "",
    companionRelationship: order.companion_relationship ?? "",
    heirName: order.heir_name ?? "",
    heirRelationship: order.heir_relationship ?? "",
    notes: order.notes ?? "",
  };
  const memberName = order.member_name || (order.member_number ? `Member #${order.member_number}` : "LDMA member");

  let statusUpdated = Boolean(order.sf_status_updated_at);
  if (!statusUpdated) {
    const res = await setLegacyOfferStatus(order.contact_id, LEGACY_STATUS_PAID_PENDING_ADDENDUM);
    if (res.ok) {
      statusUpdated = true;
      await sql`UPDATE family_legacy_orders SET sf_status_updated_at = NOW() WHERE id = ${order.id}`;
    } else {
      errors.push(res.error);
    }
  }

  const description = buildFamilyLegacyTaskDescription({
    memberName,
    memberNumber: order.member_number,
    checkboxesBefore: order.sf_checkboxes_before,
    amountCents: order.amount_cents,
    paidAtIso: toIso(order.paid_at),
    stripePaymentIntentId: order.stripe_payment_intent_id,
    intake,
    statusUpdated,
  });

  let ownerName = order.owner_name;
  let ownerEmail = order.owner_email;
  let taskId = order.sf_task_id;
  if (!taskId || !ownerEmail) {
    const assignee = await resolveFamilyLegacyAssignee(order.contact_id);
    if (!assignee.ok) {
      errors.push(assignee.error);
    } else {
      ownerName = assignee.value.name;
      ownerEmail = assignee.value.email;
      if (!taskId) {
        const task = await createFamilyLegacyTask({
          contactId: order.contact_id,
          ownerId: assignee.value.userId,
          subject: `${memberName} Family Legacy add-on paid — send addendum`,
          description,
          dueDate: addDaysIso(2),
        });
        if (task.ok) taskId = task.value;
        else errors.push(task.error);
      }
      await sql`
        UPDATE family_legacy_orders
        SET sf_task_id = ${taskId}, sf_task_owner_id = ${assignee.value.userId},
            owner_name = ${ownerName}, owner_email = ${ownerEmail}, updated_at = NOW()
        WHERE id = ${order.id}
      `;
    }
  }

  let ownerNotified = Boolean(order.owner_notified_at);
  if (!ownerNotified && ownerEmail) {
    const sent = await sendFamilyLegacyOwnerNotificationEmail({
      to: ownerEmail,
      ownerName: ownerName ?? "",
      memberName,
      memberNumber: order.member_number,
      memberEmail: order.member_email,
      description,
      salesforceUrl: await salesforceContactUrl(order.contact_id),
      taskCreated: Boolean(taskId),
    });
    if (sent) {
      ownerNotified = true;
      await sql`UPDATE family_legacy_orders SET owner_notified_at = NOW() WHERE id = ${order.id}`;
    } else {
      errors.push("Owner notification email failed");
    }
  }

  if (!order.member_confirmation_sent_at && order.member_email) {
    const sent = await sendFamilyLegacyMemberConfirmationEmail({
      to: order.member_email,
      memberName,
      amountCents: order.amount_cents,
    });
    if (sent) {
      await sql`UPDATE family_legacy_orders SET member_confirmation_sent_at = NOW() WHERE id = ${order.id}`;
    } else {
      errors.push("Member confirmation email failed");
    }
  }

  await sql`
    UPDATE family_legacy_orders SET last_error = ${errors.length ? errors.join(" | ") : null}, updated_at = NOW()
    WHERE id = ${order.id}
  `;
  if (errors.length) console.error(`[family-legacy] order ${order.id}:`, errors.join(" | "));
  return { found: true, notified: Boolean(taskId) || ownerNotified, errors };
}
