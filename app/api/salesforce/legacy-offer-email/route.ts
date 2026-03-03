import { NextRequest, NextResponse } from "next/server";
import { sendLegacyOfferEmail, type LegacyOfferType } from "@/lib/sendgrid";
import { deriveLegacyOfferType } from "@/lib/legacy-offer";

/**
 * Webhook called by Salesforce when a rep sets Legacy_Offer_Status__c to "Reviewed - Email Sent".
 * Secured by SALESFORCE_WEBHOOK_SECRET in the Authorization header.
 *
 * Body: {
 *   email: string,
 *   firstName?: string,
 *   isTransferable: boolean,
 *   isCompanion: boolean,
 *   isPrePay: boolean
 * }
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const expectedSecret = process.env.SALESFORCE_WEBHOOK_SECRET;
    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const firstName = typeof body.firstName === "string" ? body.firstName.trim() : undefined;
    const isTransferable = body.isTransferable === true;
    const isCompanion = body.isCompanion === true;
    const isPrePay = body.isPrePay === true;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    const offerType = deriveLegacyOfferType(isTransferable, isCompanion, isPrePay);
    if (!offerType) {
      return NextResponse.json(
        {
          error:
            "No offer for this membership. Checkboxes indicate what the member has: if all three are checked, they have everything. PrePay cannot be checked without Transferable.",
        },
        { status: 400 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "https://ldma-50th.vercel.app";
    const sent = await sendLegacyOfferEmail(email, firstName, offerType, baseUrl);

    if (!sent) {
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Legacy offer email webhook error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
