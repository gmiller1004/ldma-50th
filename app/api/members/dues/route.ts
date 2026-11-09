import { NextResponse } from "next/server";
import { getMemberDuesContext, recentPaidDuesPayments } from "@/lib/member-dues-payments";
import { autoPayNotice, maintenanceOptions, membershipOptions } from "@/lib/member-dues";

/**
 * GET /api/members/dues
 * The logged-in primary member's maintenance and membership balances, the payment options built
 * from them, and any recent online payments Member Services may not have applied yet.
 */
export async function GET() {
  let ctx;
  try {
    ctx = await getMemberDuesContext();
  } catch (e) {
    console.error("[member-dues] lookup failed:", e);
    return NextResponse.json({ error: "Could not load your balances" }, { status: 502 });
  }
  if (!ctx) return NextResponse.json({ eligible: false });

  const s = ctx.snapshot;
  return NextResponse.json({
    eligible: true,
    showMaintenance: s.showMaintenance,
    maintenanceDue: s.maintenanceDue,
    nextMaintenanceDueDate: s.nextMaintenanceDueDate,
    membershipDue: s.membershipDue,
    membershipBalance: s.membershipBalance,
    nextMembershipDueDate: s.nextMembershipDueDate,
    autoPayNotice: autoPayNotice(s),
    maintenanceOptions: maintenanceOptions(s),
    membershipOptions: membershipOptions(s),
    recentPayments: await recentPaidDuesPayments(ctx.member.contactId).catch(() => []),
  });
}
