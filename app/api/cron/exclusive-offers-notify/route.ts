import { NextRequest, NextResponse } from "next/server";
import { getCollectionByHandle } from "@/lib/shopify";
import {
  getMembersWithExclusiveOffersNotify,
  getExclusiveOffersNotifiedProductIds,
  recordExclusiveOffersNotified,
} from "@/lib/notification-preferences";
import { lookupMember } from "@/lib/salesforce";
import { sendExclusiveOffersNotificationEmail, type ExclusiveOfferProduct } from "@/lib/sendgrid";

const EXCLUSIVE_OFFERS_HANDLE = "exclusive-offers-for-ldma-members";

/**
 * Cron: check for new products in Exclusive Offers for LDMA Members;
 * if any, email opted-in members and record those products as notified.
 *
 * Vercel Cron: configure in vercel.json (e.g. daily).
 * Authorization: use CRON_SECRET to prevent public access.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "https://ldma50.com";

  const collection = await getCollectionByHandle(EXCLUSIVE_OFFERS_HANDLE);
  if (!collection || !collection.products.length) {
    return NextResponse.json({
      ok: true,
      sent: 0,
      newProducts: 0,
      reason: "no_collection_or_products",
    });
  }

  const notifiedIds = new Set(await getExclusiveOffersNotifiedProductIds());
  const newProducts: ExclusiveOfferProduct[] = collection.products
    .filter((p) => !notifiedIds.has(p.id))
    .map((p) => ({ id: p.id, title: p.title, handle: p.handle }));

  if (newProducts.length === 0) {
    return NextResponse.json({
      ok: true,
      sent: 0,
      newProducts: 0,
      reason: "no_new_products",
    });
  }

  const memberNumbers = await getMembersWithExclusiveOffersNotify();
  let sent = 0;

  for (const memberNumber of memberNumbers) {
    const member = await lookupMember(memberNumber);
    if (!member.valid || !member.email) continue;

    const ok = await sendExclusiveOffersNotificationEmail(
      member.email,
      member.firstName,
      newProducts,
      baseUrl
    );
    if (ok) sent++;
  }

  await recordExclusiveOffersNotified(newProducts.map((p) => p.id));

  return NextResponse.json({
    ok: true,
    sent,
    newProducts: newProducts.length,
    totalOptedIn: memberNumbers.length,
  });
}
