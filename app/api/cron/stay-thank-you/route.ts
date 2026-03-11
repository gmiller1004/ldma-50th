import { NextRequest, NextResponse } from "next/server";
import { getEndedStaysNotThanked, recordStayThankYou, type StayType } from "@/lib/stay-thanks";
import { getCampBySlug } from "@/lib/directory-camps";
import { lookupMember } from "@/lib/salesforce";
import { sendStayThankYouEmail } from "@/lib/sendgrid";
import { upsertCampStayProfile } from "@/lib/klaviyo-camp-stay";
import { sql, hasDb } from "@/lib/db";

/**
 * Cron: send thank-you emails for stays that ended yesterday.
 * One email per stay (reservation, member check-in, or guest check-in); idempotent via camp_stay_thanks.
 *
 * Vercel Cron: run daily (e.g. 10:00 AM). Authorization: CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const stays = await getEndedStaysNotThanked(yesterdayStr);
  let sent = 0;
  let skipped = 0;

  for (const stay of stays) {
    let email: string | null = stay.email;
    let recipientName = stay.recipientName;

    if (!email && stay.memberNumber) {
      const member = await lookupMember(stay.memberNumber);
      if (member.valid && member.email?.trim()) {
        email = member.email.trim();
        if (member.firstName?.trim() || member.displayName?.trim()) {
          recipientName = member.displayName?.trim() || member.firstName?.trim() || recipientName;
        }
      }
    }

    if (!email) {
      skipped++;
      continue;
    }

    const camp = getCampBySlug(stay.campSlug);
    const campName = camp?.name ?? stay.campSlug;

    const ok = await sendStayThankYouEmail(
      email,
      campName,
      recipientName,
      stay.checkInDate,
      stay.checkOutDate
    );

    if (ok) {
      await recordStayThankYou(stay.stayType as StayType, stay.stayId);
      sent++;
      // Mark reservation completed and sync to Klaviyo for remarketing
      if (stay.stayType === "reservation" && email) {
        if (hasDb() && sql) {
          await sql`
            UPDATE camp_reservations SET status = 'completed', updated_at = NOW()
            WHERE id = ${stay.stayId}
          `;
        }
        upsertCampStayProfile({
          email,
          firstName: undefined,
          lastName: recipientName || undefined,
          campSlug: stay.campSlug,
          checkOutDate: stay.checkOutDate,
          status: "completed",
          lastStayAs: stay.stayAs,
        }).catch((e) => console.error("[Klaviyo] sync after thank-you:", e));
      }
    }
  }

  return NextResponse.json({
    ok: true,
    date: yesterdayStr,
    total: stays.length,
    sent,
    skipped,
  });
}
