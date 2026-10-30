import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { hasDb } from "@/lib/db";
import {
  describeLegacyCheckboxes,
  FAMILY_LEGACY_OFFER_PATH,
  FAMILY_LEGACY_PAYMENT_TYPE,
  FAMILY_LEGACY_PRICE_CENTS,
  parseFamilyLegacyIntake,
} from "@/lib/family-legacy-offer";
import {
  attachCheckoutSession,
  createPendingFamilyLegacyOrder,
  getFamilyLegacyMemberContext,
} from "@/lib/family-legacy-orders";

/**
 * POST /api/members/family-legacy-offer/checkout
 * Body: optional companion/heir details. Starts a $600 Stripe Checkout for an eligible logged-in member.
 */
export async function POST(request: NextRequest) {
  const secretKey = process.env.STRIPE_RESTRICTED_KEY || process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: "Payments are not configured" }, { status: 503 });
  }
  if (!hasDb()) {
    return NextResponse.json({ error: "Database not available" }, { status: 503 });
  }

  const ctx = await getFamilyLegacyMemberContext();
  if (!ctx) {
    return NextResponse.json({ error: "Please log in to your member account." }, { status: 401 });
  }
  if (!ctx.eligibility.eligible) {
    const messages: Record<string, string> = {
      already_purchased: "You've already purchased the Family Legacy add-on.",
      companion_login: "This offer is available on the primary membership only.",
      completed_offer: "Please call Member Services at (888) 465-3717 for details.",
      not_active: "This offer is available to active LDMA members.",
    };
    return NextResponse.json({ error: messages[ctx.eligibility.reason] }, { status: 403 });
  }

  const intake = parseFamilyLegacyIntake(await request.json().catch(() => ({})));
  const { member, memberNumber } = ctx;
  const memberName = [member.firstName, member.lastName].filter(Boolean).join(" ").trim() || `Member #${memberNumber}`;

  const orderId = await createPendingFamilyLegacyOrder({
    contactId: member.contactId,
    memberNumber,
    memberName,
    memberEmail: member.email ?? null,
    checkboxesBefore: describeLegacyCheckboxes(member),
    amountCents: FAMILY_LEGACY_PRICE_CENTS,
    intake,
  });

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  const stripe = new Stripe(secretKey);
  try {
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
              description: `Adds Transferability, Companion, and Pre-Paid Transfer Fee to LDMA membership #${memberNumber}. Applied after the addendum is signed.`,
            },
          },
        },
      ],
      success_url: `${baseUrl}${FAMILY_LEGACY_OFFER_PATH}?paid=1`,
      cancel_url: `${baseUrl}${FAMILY_LEGACY_OFFER_PATH}?cancelled=1`,
      customer_email: member.email || undefined,
      payment_intent_data: {
        description: `Family Legacy add-on — ${memberName} (#${memberNumber})`,
      },
      metadata: {
        payment_type: FAMILY_LEGACY_PAYMENT_TYPE,
        order_id: orderId,
        member_contact_id: member.contactId,
        member_number: memberNumber,
      },
    });
    if (!session.url) {
      return NextResponse.json({ error: "Checkout session has no URL" }, { status: 500 });
    }
    await attachCheckoutSession(orderId, session.id);
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("[family-legacy] Stripe error:", e);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 500 });
  }
}
