/**
 * Member self-service dues payments (maintenance + membership) from the profile page.
 * Amounts always come from the member's Salesforce record; Member Services applies the
 * payment in Salesforce by hand after the Stripe charge. Client-safe: no server imports.
 */

import type { MemberLookupResult } from "@/lib/salesforce";

export const MEMBER_DUES_PAYMENT_TYPE = "member_dues";
export const MEMBER_DUES_STAFF_EMAILS = ["gricci@goldprospectors.org", "nmathis@lostdutchmans.com"];
/** Stripe's minimum charge in USD. */
export const MEMBER_DUES_MIN_CENTS = 50;
/** Show "payment received, being applied" for this long after a payment. */
export const MEMBER_DUES_PENDING_DAYS = 10;

export type MaintenanceChoice = "maintenance_due" | "maintenance_through_next_year";
export type MembershipChoice = "membership_due" | "membership_payoff";

export type MemberDuesSnapshot = {
  showMaintenance: boolean;
  maintenanceDue: number;
  maintenanceThruNextYear: number | null;
  maintenanceMonthlyFee: number | null;
  nextMaintenanceDueDate: string | null;
  membershipDue: number;
  membershipBalance: number;
  nextMembershipDueDate: string | null;
  onAutoPay: boolean;
  autoPayNextTotal: number | null;
  autoPayNextDate: string | null;
};

export type DuesOption<T extends string> = { id: T; label: string; amountCents: number };

export type DuesPricing =
  | {
      ok: true;
      maintenanceChoice: MaintenanceChoice | null;
      membershipChoice: MembershipChoice | null;
      maintenanceCents: number;
      membershipCents: number;
      totalCents: number;
      maintenanceLabel: string | null;
      membershipLabel: string | null;
    }
  | { ok: false; error: string };

function toCents(dollars: number | null | undefined): number {
  return typeof dollars === "number" && Number.isFinite(dollars) ? Math.max(0, Math.round(dollars * 100)) : 0;
}

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Calendar year in Pacific time. */
export function pacificYear(now: Date = new Date()): number {
  return Number(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles", year: "numeric" }));
}

export function duesSnapshotFromMember(member: MemberLookupResult): MemberDuesSnapshot {
  return {
    showMaintenance: member.showMaintenance === true,
    maintenanceDue: member.duesOwed ?? 0,
    maintenanceThruNextYear: member.maintenanceThruNextYear ?? null,
    maintenanceMonthlyFee: member.maintenanceMonthlyFee ?? null,
    nextMaintenanceDueDate: member.nextMaintenanceDueDate ?? null,
    membershipDue: member.membershipDuesOwed ?? 0,
    membershipBalance: member.membershipBalance ?? 0,
    nextMembershipDueDate: member.nextMembershipDueDate ?? null,
    onAutoPay: member.isOnAutoPay === true,
    autoPayNextTotal: member.autoPayNextTotal ?? null,
    autoPayNextDate: member.autoPayNextDate ?? null,
  };
}

export function maintenanceOptions(s: MemberDuesSnapshot, now: Date = new Date()): DuesOption<MaintenanceChoice>[] {
  if (!s.showMaintenance) return [];
  const due = toCents(s.maintenanceDue);
  const ahead = toCents(s.maintenanceThruNextYear);
  const options: DuesOption<MaintenanceChoice>[] = [];
  if (due > 0) options.push({ id: "maintenance_due", label: "Amount due now", amountCents: due });
  if (ahead > due) {
    options.push({
      id: "maintenance_through_next_year",
      label: `Pay ahead through ${pacificYear(now) + 1}`,
      amountCents: ahead,
    });
  }
  return options;
}

export function membershipOptions(s: MemberDuesSnapshot): DuesOption<MembershipChoice>[] {
  const due = toCents(s.membershipDue);
  const balance = toCents(s.membershipBalance);
  const options: DuesOption<MembershipChoice>[] = [];
  if (due > 0) options.push({ id: "membership_due", label: "Amount due now", amountCents: due });
  if (balance > due) options.push({ id: "membership_payoff", label: "Pay off remaining balance", amountCents: balance });
  return options;
}

export function hasDuesOptions(s: MemberDuesSnapshot, now: Date = new Date()): boolean {
  return maintenanceOptions(s, now).length > 0 || membershipOptions(s).length > 0;
}

/** Price the member's choices from their Salesforce balances; never trust client amounts. */
export function priceDuesSelection(
  s: MemberDuesSnapshot,
  selection: { maintenance?: unknown; membership?: unknown },
  now: Date = new Date()
): DuesPricing {
  const maint = selection.maintenance ? maintenanceOptions(s, now).find((o) => o.id === selection.maintenance) : null;
  const memb = selection.membership ? membershipOptions(s).find((o) => o.id === selection.membership) : null;
  if (selection.maintenance && !maint) return { ok: false, error: "That maintenance option isn't available." };
  if (selection.membership && !memb) return { ok: false, error: "That membership option isn't available." };
  const maintenanceCents = maint?.amountCents ?? 0;
  const membershipCents = memb?.amountCents ?? 0;
  const totalCents = maintenanceCents + membershipCents;
  if (totalCents <= 0) return { ok: false, error: "Choose what you'd like to pay." };
  if (totalCents < MEMBER_DUES_MIN_CENTS) {
    return { ok: false, error: "Online payments must be at least $0.50. Please call (888) 465-3717." };
  }
  return {
    ok: true,
    maintenanceChoice: maint?.id ?? null,
    membershipChoice: memb?.id ?? null,
    maintenanceCents,
    membershipCents,
    totalCents,
    maintenanceLabel: maint?.label ?? null,
    membershipLabel: memb?.label ?? null,
  };
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function autoPayNotice(s: MemberDuesSnapshot): string | null {
  if (!s.onAutoPay) return null;
  const amount = s.autoPayNextTotal && s.autoPayNextTotal > 0 ? formatUsd(toCents(s.autoPayNextTotal)) : null;
  const date = formatDate(s.autoPayNextDate);
  const next = amount && date ? ` Your next automatic payment of ${amount} is scheduled for ${date}.` : "";
  return `You're on AutoPay.${next} Paying here doesn't change or cancel AutoPay, so that charge will still run unless Member Services adjusts it.`;
}

/** Plain-text body for the Member Services email that asks Gen and Nannette to apply the payment. */
export function buildDuesStaffNotice(input: {
  memberName: string;
  memberNumber: string | null;
  memberEmail: string | null;
  pricing: {
    maintenanceCents: number;
    membershipCents: number;
    totalCents: number;
    maintenanceLabel: string | null;
    membershipLabel: string | null;
  };
  balancesBefore: MemberDuesSnapshot;
  paidAtIso: string;
  stripePaymentIntentId: string | null;
}): string {
  const p = input.pricing;
  const b = input.balancesBefore;
  const paidAt = new Date(input.paidAtIso).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "medium",
    timeStyle: "short",
  });
  const lines = [
    `Member: ${input.memberName}${input.memberNumber ? ` (#${input.memberNumber})` : ""}${input.memberEmail ? ` · ${input.memberEmail}` : ""}`,
    `Paid online: ${paidAt} PT`,
    "",
    "WHAT THEY PAID",
    `Total: ${formatUsd(p.totalCents)}`,
  ];
  if (p.membershipCents > 0) lines.push(`Membership: ${formatUsd(p.membershipCents)} (${p.membershipLabel})`);
  if (p.maintenanceCents > 0) lines.push(`Maintenance: ${formatUsd(p.maintenanceCents)} (${p.maintenanceLabel})`);
  lines.push(
    "",
    "ENTER AS A SALESFORCE PAYMENT",
    `Amount: ${formatUsd(p.totalCents)}`,
    `Membership Payment Amount: ${formatUsd(p.membershipCents)}`,
    `Maintenance Fee Amount: ${formatUsd(p.maintenanceCents)}`,
    "Payment Type: Credit Card",
    "Payment Origin: Web",
    "Payment Batch: Web",
    `Transaction Id: ${input.stripePaymentIntentId ?? "(see Stripe)"}`,
    "",
    "SALESFORCE BALANCES WHEN THEY PAID",
    `Maintenance due: ${b.showMaintenance ? formatUsd(toCents(b.maintenanceDue)) : "exempt / not shown"}`
  );
  if (b.showMaintenance && b.maintenanceThruNextYear != null) {
    lines.push(`Maintenance through next year: ${formatUsd(toCents(b.maintenanceThruNextYear))}`);
  }
  lines.push(
    `Membership dues owed: ${formatUsd(toCents(b.membershipDue))}`,
    `Membership balance: ${formatUsd(toCents(b.membershipBalance))}`
  );
  if (b.onAutoPay) {
    const next =
      b.autoPayNextTotal && b.autoPayNextDate
        ? ` Next AutoPay charge: ${formatUsd(toCents(b.autoPayNextTotal))} on ${formatDate(b.autoPayNextDate)}.`
        : "";
    lines.push(
      "",
      `AUTOPAY: This member is on AutoPay.${next} Check whether that charge should be adjusted so they aren't billed twice.`
    );
  }
  return lines.join("\n");
}
