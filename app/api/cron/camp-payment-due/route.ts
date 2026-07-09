import { NextRequest, NextResponse } from "next/server";
import { directoryCamps } from "@/lib/directory-camps";
import { fetchPaymentsDueForCamp } from "@/lib/caretaker-site-ar";
import { sendAllBalanceReminders } from "@/lib/reservation-balance-reminders";

/**
 * GET /api/cron/camp-payment-due
 * Daily: log AR summary and send 14/7/3-day balance reminder emails.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary: Array<{ campSlug: string; dueCount: number; overdueCount: number }> = [];

  for (const camp of directoryCamps) {
    const items = await fetchPaymentsDueForCamp(camp.slug, 7);
    summary.push({
      campSlug: camp.slug,
      dueCount: items.length,
      overdueCount: items.filter((i) => i.isOverdue).length,
    });
  }

  const totalDue = summary.reduce((s, c) => s + c.dueCount, 0);
  const totalOverdue = summary.reduce((s, c) => s + c.overdueCount, 0);
  console.log(`[cron camp-payment-due] ${totalDue} reservations with site fees due (${totalOverdue} overdue)`);

  const reminders = await sendAllBalanceReminders();

  return NextResponse.json({ ok: true, summary, totalDue, totalOverdue, reminders });
}
