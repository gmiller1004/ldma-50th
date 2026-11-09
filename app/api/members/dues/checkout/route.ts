import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { hasDb } from "@/lib/db";
import { formatUsd, MEMBER_DUES_PAYMENT_TYPE, priceDuesSelection } from "@/lib/member-dues";
import {
  attachDuesCheckoutSession,
  createPendingDuesPayment,
  getMemberDuesContext,
} from "@/lib/member-dues-payments";

const PROFILE_PATH = "/members/profile";

/**
 * POST /api/members/dues/checkout
 * Body: { maintenance?: MaintenanceChoice, membership?: MembershipChoice }.
 * Prices the choices from the member's Salesforce balances and starts Stripe Checkout.
 */
export async function POST(request: NextRequest) {
  const secretKey = process.env.STRIPE_RESTRICTED_KEY || process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return NextResponse.json({ error: "Payments are not configured" }, { status: 503 });
  if (!hasDb()) return NextResponse.json({ error: "Database not available" }, { status: 503 });

  const ctx = await getMemberDuesContext();
  if (!ctx) return NextResponse.json({ error: "Please log in to your member account." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { maintenance?: unknown; membership?: unknown };
  const pricing = priceDuesSelection(ctx.snapshot, body);
  if (!pricing.ok) return NextResponse.json({ error: pricing.error }, { status: 400 });

  const { member, memberNumber, memberName } = ctx;
  const paymentId = await createPendingDuesPayment({
    contactId: member.contactId,
    memberNumber,
    memberName,
    memberEmail: member.email ?? null,
    maintenanceChoice: pricing.maintenanceChoice,
    membershipChoice: pricing.membershipChoice,
    maintenanceLabel: pricing.maintenanceLabel,
    membershipLabel: pricing.membershipLabel,
    maintenanceCents: pricing.maintenanceCents,
    membershipCents: pricing.membershipCents,
    amountCents: pricing.totalCents,
    balancesBefore: ctx.snapshot,
  });

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  if (pricing.membershipCents > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: pricing.membershipCents,
        product_data: { name: `LDMA membership dues: ${pricing.membershipLabel?.toLowerCase()}` },
      },
    });
  }
  if (pricing.maintenanceCents > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: pricing.maintenanceCents,
        product_data: { name: `LDMA maintenance: ${pricing.maintenanceLabel?.toLowerCase()}` },
      },
    });
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  const stripe = new Stripe(secretKey);
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      currency: "usd",
      line_items: lineItems,
      success_url: `${baseUrl}${PROFILE_PATH}?dues=paid`,
      cancel_url: `${baseUrl}${PROFILE_PATH}?dues=cancelled`,
      customer_email: member.email || undefined,
      payment_intent_data: {
        description: `LDMA dues ${formatUsd(pricing.totalCents)} — ${memberName} (#${memberNumber})`,
      },
      metadata: {
        payment_type: MEMBER_DUES_PAYMENT_TYPE,
        dues_payment_id: paymentId,
        member_contact_id: member.contactId,
        member_number: memberNumber,
        maintenance_cents: String(pricing.maintenanceCents),
        membership_cents: String(pricing.membershipCents),
      },
    });
    if (!session.url) return NextResponse.json({ error: "Checkout session has no URL" }, { status: 500 });
    await attachDuesCheckoutSession(paymentId, session.id);
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("[member-dues] Stripe error:", e);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 500 });
  }
}
