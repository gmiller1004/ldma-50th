import { NextRequest, NextResponse } from "next/server";
import { getMembersWithCommentDigestEnabled } from "@/lib/notification-preferences";
import { lookupMember } from "@/lib/salesforce";
import { getCommentActivityForContact } from "@/lib/digest";
import { sendCommentDigestEmail } from "@/lib/sendgrid";

/**
 * Daily comment digest cron.
 * Runs at 8pm Pacific. Finds members who opted in and had comment activity on their posts today,
 * then sends a digest email.
 *
 * Vercel Cron: configure in vercel.json with "0 4 * * *" (4am UTC ≈ 8pm Pacific)
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

  // Start of "today" in Pacific (8am UTC = midnight PST; 7am UTC = midnight PDT — we use 8 for simplicity)
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value ?? "2025";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  const since = new Date(Date.UTC(parseInt(y), parseInt(m) - 1, parseInt(d), 8, 0, 0));

  const memberNumbers = await getMembersWithCommentDigestEnabled();
  let sent = 0;
  let skipped = 0;

  for (const memberNumber of memberNumbers) {
    const member = await lookupMember(memberNumber);
    if (!member.valid || !member.contactId || !member.email) {
      skipped++;
      continue;
    }

    const activities = await getCommentActivityForContact(member.contactId, since);
    if (activities.length === 0) {
      skipped++;
      continue;
    }

    const ok = await sendCommentDigestEmail(
      member.email,
      member.firstName,
      activities,
      baseUrl
    );
    if (ok) sent++;
  }

  return NextResponse.json({
    ok: true,
    sent,
    skipped: memberNumbers.length - sent,
    total: memberNumbers.length,
  });
}
