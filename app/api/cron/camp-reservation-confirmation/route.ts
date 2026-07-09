import { NextRequest, NextResponse } from "next/server";
import { sendPendingPublicReservationConfirmations } from "@/lib/public-booking-confirmation";

/**
 * Cron: send delayed confirmation emails for public web reservations (with site assignment).
 * Primary send happens in the Stripe webhook; this cron backfills any that were missed.
 * Schedule: every 15 minutes. Authorization: CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sent, skipped } = await sendPendingPublicReservationConfirmations();
  return NextResponse.json({ ok: true, sent, skipped });
}
