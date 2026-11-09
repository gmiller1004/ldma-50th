/**
 * Member self-service dues payments: storage, member context, and post-payment fulfillment
 * (Member Services notice to Gen and Nannette, member receipt).
 */

import { cookies } from "next/headers";
import type Stripe from "stripe";
import { sql, hasDb } from "@/lib/db";
import { verifySessionToken } from "@/lib/session";
import { lookupMember, type MemberLookupResult } from "@/lib/salesforce";
import { salesforceContactUrl } from "@/lib/salesforce-family-legacy";
import {
  buildDuesStaffNotice,
  duesSnapshotFromMember,
  formatUsd,
  MEMBER_DUES_PENDING_DAYS,
  MEMBER_DUES_STAFF_EMAILS,
  type MemberDuesSnapshot,
} from "@/lib/member-dues";
import { sendMemberDuesReceiptEmail, sendMemberDuesStaffNotificationEmail } from "@/lib/sendgrid";

type DuesPaymentRow = {
  id: string;
  contact_id: string;
  member_number: string | null;
  member_name: string | null;
  member_email: string | null;
  maintenance_label: string | null;
  membership_label: string | null;
  maintenance_cents: number;
  membership_cents: number;
  amount_cents: number;
  balances_before: MemberDuesSnapshot | null;
  on_autopay: boolean;
  stripe_payment_intent_id: string | null;
  paid_at: string | Date | null;
  staff_notified_at: string | Date | null;
  member_receipt_sent_at: string | Date | null;
};

export type MemberDuesContext = {
  member: MemberLookupResult & { contactId: string };
  memberNumber: string;
  memberName: string;
  snapshot: MemberDuesSnapshot;
};

/** Logged-in primary member with their Salesforce balances; null when not logged in or a companion login. */
export async function getMemberDuesContext(): Promise<MemberDuesContext | null> {
  const token = (await cookies()).get("member_session")?.value;
  if (!token) return null;
  const session = await verifySessionToken(token);
  if (!session) return null;
  const member = await lookupMember(session.memberNumber);
  if (!member.valid || !member.contactId || member.accessRole === "companion") return null;
  return {
    member: member as MemberLookupResult & { contactId: string },
    memberNumber: session.memberNumber,
    memberName: [member.firstName, member.lastName].filter(Boolean).join(" ").trim() || `Member #${session.memberNumber}`,
    snapshot: duesSnapshotFromMember(member),
  };
}

export async function recentPaidDuesPayments(
  contactId: string
): Promise<{ amountCents: number; paidAt: string }[]> {
  if (!hasDb() || !sql) return [];
  const rows = (await sql`
    SELECT amount_cents, paid_at FROM member_dues_payments
    WHERE contact_id = ${contactId} AND status = 'paid'
      AND paid_at > NOW() - (${MEMBER_DUES_PENDING_DAYS} * INTERVAL '1 day')
    ORDER BY paid_at DESC
  `) as { amount_cents: number; paid_at: string | Date }[];
  return rows.map((r) => ({
    amountCents: r.amount_cents,
    paidAt: r.paid_at instanceof Date ? r.paid_at.toISOString() : new Date(r.paid_at).toISOString(),
  }));
}

export async function createPendingDuesPayment(input: {
  contactId: string;
  memberNumber: string;
  memberName: string;
  memberEmail: string | null;
  maintenanceChoice: string | null;
  membershipChoice: string | null;
  maintenanceLabel: string | null;
  membershipLabel: string | null;
  maintenanceCents: number;
  membershipCents: number;
  amountCents: number;
  balancesBefore: MemberDuesSnapshot;
}): Promise<string> {
  if (!sql) throw new Error("Database not available");
  const rows = (await sql`
    INSERT INTO member_dues_payments (
      contact_id, member_number, member_name, member_email,
      maintenance_choice, membership_choice, maintenance_label, membership_label,
      maintenance_cents, membership_cents, amount_cents, balances_before, on_autopay
    ) VALUES (
      ${input.contactId}, ${input.memberNumber}, ${input.memberName}, ${input.memberEmail},
      ${input.maintenanceChoice}, ${input.membershipChoice}, ${input.maintenanceLabel}, ${input.membershipLabel},
      ${input.maintenanceCents}, ${input.membershipCents}, ${input.amountCents},
      ${JSON.stringify(input.balancesBefore)}::jsonb, ${input.balancesBefore.onAutoPay}
    )
    RETURNING id
  `) as { id: string }[];
  return rows[0].id;
}

export async function attachDuesCheckoutSession(paymentId: string, sessionId: string): Promise<void> {
  if (!sql) return;
  await sql`
    UPDATE member_dues_payments SET stripe_checkout_session_id = ${sessionId}, updated_at = NOW()
    WHERE id = ${paymentId}
  `;
}

function toIso(value: string | Date | null): string {
  if (!value) return new Date().toISOString();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/**
 * Mark paid and notify Member Services and the member. Each step is recorded so Stripe retries only
 * redo what failed. `staffNotified` is false when the Member Services email didn't go out.
 */
export async function fulfillMemberDuesCheckout(
  session: Stripe.Checkout.Session
): Promise<{ found: boolean; staffNotified: boolean; errors: string[] }> {
  if (!hasDb() || !sql) return { found: false, staffNotified: false, errors: ["Database not available"] };
  const paymentId = session.metadata?.dues_payment_id || null;
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;

  const updated = (await sql`
    UPDATE member_dues_payments
    SET status = 'paid', paid_at = COALESCE(paid_at, NOW()),
        stripe_checkout_session_id = COALESCE(stripe_checkout_session_id, ${session.id}),
        stripe_payment_intent_id = COALESCE(stripe_payment_intent_id, ${paymentIntentId}),
        updated_at = NOW()
    WHERE stripe_checkout_session_id = ${session.id} OR (${paymentId}::uuid IS NOT NULL AND id = ${paymentId}::uuid)
    RETURNING *
  `) as DuesPaymentRow[];
  const payment = updated[0];
  if (!payment) return { found: false, staffNotified: false, errors: [`No dues payment for session ${session.id}`] };

  const errors: string[] = [];
  const memberName = payment.member_name || (payment.member_number ? `Member #${payment.member_number}` : "LDMA member");
  const totalLabel = formatUsd(payment.amount_cents);
  const pricing = {
    maintenanceCents: payment.maintenance_cents,
    membershipCents: payment.membership_cents,
    totalCents: payment.amount_cents,
    maintenanceLabel: payment.maintenance_label,
    membershipLabel: payment.membership_label,
  };

  let staffNotified = Boolean(payment.staff_notified_at);
  if (!staffNotified && payment.balances_before) {
    const notice = buildDuesStaffNotice({
      memberName,
      memberNumber: payment.member_number,
      memberEmail: payment.member_email,
      pricing,
      balancesBefore: payment.balances_before,
      paidAtIso: toIso(payment.paid_at),
      stripePaymentIntentId: payment.stripe_payment_intent_id,
    });
    const sent = await sendMemberDuesStaffNotificationEmail({
      to: MEMBER_DUES_STAFF_EMAILS,
      memberName,
      memberNumber: payment.member_number,
      totalLabel,
      notice,
      onAutoPay: payment.on_autopay,
      salesforceUrl: await salesforceContactUrl(payment.contact_id),
      stripeUrl: payment.stripe_payment_intent_id
        ? `https://dashboard.stripe.com/payments/${payment.stripe_payment_intent_id}`
        : null,
    });
    if (sent) {
      staffNotified = true;
      await sql`UPDATE member_dues_payments SET staff_notified_at = NOW() WHERE id = ${payment.id}`;
    } else {
      errors.push("Member Services notification email failed");
    }
  }

  if (!payment.member_receipt_sent_at && payment.member_email) {
    const lines = [
      payment.membership_cents > 0
        ? { label: `Membership dues (${(payment.membership_label ?? "").toLowerCase()})`, amount: formatUsd(payment.membership_cents) }
        : null,
      payment.maintenance_cents > 0
        ? { label: `Maintenance (${(payment.maintenance_label ?? "").toLowerCase()})`, amount: formatUsd(payment.maintenance_cents) }
        : null,
    ].filter((l): l is { label: string; amount: string } => l !== null);
    const sent = await sendMemberDuesReceiptEmail({
      to: payment.member_email,
      memberName,
      memberNumber: payment.member_number,
      totalLabel,
      lines,
      onAutoPay: payment.on_autopay,
    });
    if (sent) {
      await sql`UPDATE member_dues_payments SET member_receipt_sent_at = NOW() WHERE id = ${payment.id}`;
    } else {
      errors.push("Member receipt email failed");
    }
  }

  await sql`
    UPDATE member_dues_payments SET last_error = ${errors.length ? errors.join(" | ") : null}, updated_at = NOW()
    WHERE id = ${payment.id}
  `;
  if (errors.length) console.error(`[member-dues] payment ${payment.id}:`, errors.join(" | "));
  return { found: true, staffNotified, errors };
}
