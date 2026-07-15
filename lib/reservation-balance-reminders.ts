/**
 * Balance-due reminder emails at 14, 7, and 3 days before check-in (arrival-month balance)
 * and before each subsequent billing period on long member stays.
 */

import { sql, hasDb } from "@/lib/db";
import { listBillingPeriods } from "@/lib/reservation-billing";
import { lookupMember } from "@/lib/salesforce";
import { getCampBySlug } from "@/lib/directory-camps";
import { createReservationPayToken } from "@/lib/reservation-pay-token";
import { reservationPayPageUrl } from "@/lib/reservation-notify";
import { toDateOnlyStr } from "@/lib/reservation-dates";
import {
  sendReservationBalanceReminderEmail,
  type BalanceReminderDays,
} from "@/lib/sendgrid";
import { formatSiteAssignmentLabel, type CampSiteRow } from "@/lib/public-camp-booking";
import {
  balanceDueBeforeArrivalCents,
  daysBetweenIso,
  isLongTermMemberStay,
  summarizeReservationPaymentObligations,
} from "@/lib/reservation-balance-due";

type ReminderRow = {
  id: string;
  camp_slug: string;
  check_in_date: string;
  check_out_date: string;
  reservation_type: string;
  member_number: string | null;
  member_display_name: string | null;
  guest_email: string | null;
  guest_first_name: string | null;
  guest_last_name: string | null;
};

type BillingPeriodReminderRow = ReminderRow & {
  period_id: string;
  period_index: number;
  due_date: string;
  amount_due_cents: number;
  amount_paid_cents: number;
};

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function resolveRecipient(row: ReminderRow): Promise<{ email: string; name: string } | null> {
  if (row.reservation_type === "guest") {
    const email = row.guest_email?.trim();
    if (!email) return null;
    const name =
      [row.guest_first_name, row.guest_last_name].filter(Boolean).join(" ").trim() || "Guest";
    return { email, name };
  }
  const memberNumber = row.member_number?.trim();
  if (!memberNumber) return null;
  const member = await lookupMember(memberNumber);
  if (!member.valid || !member.email?.trim()) return null;
  const name =
    row.member_display_name?.trim() ||
    [member.firstName, member.lastName].filter(Boolean).join(" ").trim() ||
    `Member #${memberNumber}`;
  return { email: member.email.trim(), name };
}

async function fetchBeforeArrivalCandidates(daysBefore: BalanceReminderDays): Promise<ReminderRow[]> {
  if (!hasDb() || !sql) return [];
  const today = new Date().toISOString().slice(0, 10);
  const targetCheckIn = addDaysIso(today, daysBefore);

  let rows: unknown;
  if (daysBefore === 14) {
    rows = await sql`
      SELECT id, camp_slug, check_in_date, check_out_date, reservation_type,
             member_number, member_display_name, guest_email, guest_first_name, guest_last_name
      FROM camp_reservations
      WHERE status NOT IN ('cancelled', 'completed')
        AND check_in_date = ${targetCheckIn}::date
        AND balance_reminder_14d_sent_at IS NULL
      ORDER BY created_at ASC
      LIMIT 100
    `;
  } else if (daysBefore === 7) {
    rows = await sql`
      SELECT id, camp_slug, check_in_date, check_out_date, reservation_type,
             member_number, member_display_name, guest_email, guest_first_name, guest_last_name
      FROM camp_reservations
      WHERE status NOT IN ('cancelled', 'completed')
        AND check_in_date = ${targetCheckIn}::date
        AND balance_reminder_7d_sent_at IS NULL
      ORDER BY created_at ASC
      LIMIT 100
    `;
  } else {
    rows = await sql`
      SELECT id, camp_slug, check_in_date, check_out_date, reservation_type,
             member_number, member_display_name, guest_email, guest_first_name, guest_last_name
      FROM camp_reservations
      WHERE status NOT IN ('cancelled', 'completed')
        AND check_in_date = ${targetCheckIn}::date
        AND balance_reminder_3d_sent_at IS NULL
      ORDER BY created_at ASC
      LIMIT 100
    `;
  }

  return (Array.isArray(rows) ? rows : []) as ReminderRow[];
}

async function markBeforeArrivalReminderSent(
  reservationId: string,
  daysBefore: BalanceReminderDays
): Promise<void> {
  if (!sql) return;
  if (daysBefore === 14) {
    await sql`
      UPDATE camp_reservations
      SET balance_reminder_14d_sent_at = NOW(), updated_at = NOW()
      WHERE id = ${reservationId} AND balance_reminder_14d_sent_at IS NULL
    `;
  } else if (daysBefore === 7) {
    await sql`
      UPDATE camp_reservations
      SET balance_reminder_7d_sent_at = NOW(), updated_at = NOW()
      WHERE id = ${reservationId} AND balance_reminder_7d_sent_at IS NULL
    `;
  } else {
    await sql`
      UPDATE camp_reservations
      SET balance_reminder_3d_sent_at = NOW(), updated_at = NOW()
      WHERE id = ${reservationId} AND balance_reminder_3d_sent_at IS NULL
    `;
  }
}

async function fetchBillingPeriodCandidates(
  daysBefore: BalanceReminderDays
): Promise<BillingPeriodReminderRow[]> {
  if (!hasDb() || !sql) return [];
  const today = new Date().toISOString().slice(0, 10);
  const targetDueDate = addDaysIso(today, daysBefore);

  let rows: unknown;
  if (daysBefore === 14) {
    rows = await sql`
      SELECT r.id, r.camp_slug, r.check_in_date, r.check_out_date, r.reservation_type,
             r.member_number, r.member_display_name, r.guest_email, r.guest_first_name, r.guest_last_name,
             bp.id AS period_id, bp.period_index, bp.due_date,
             bp.amount_due_cents, bp.amount_paid_cents
      FROM camp_billing_periods bp
      JOIN camp_reservations r ON r.id = bp.reservation_id
      WHERE r.status NOT IN ('cancelled', 'completed')
        AND bp.period_index >= 1
        AND bp.status IN ('unpaid', 'partial')
        AND bp.due_date = ${targetDueDate}::date
        AND bp.amount_due_cents > bp.amount_paid_cents
        AND bp.balance_reminder_14d_sent_at IS NULL
      ORDER BY bp.due_date ASC
      LIMIT 100
    `;
  } else if (daysBefore === 7) {
    rows = await sql`
      SELECT r.id, r.camp_slug, r.check_in_date, r.check_out_date, r.reservation_type,
             r.member_number, r.member_display_name, r.guest_email, r.guest_first_name, r.guest_last_name,
             bp.id AS period_id, bp.period_index, bp.due_date,
             bp.amount_due_cents, bp.amount_paid_cents
      FROM camp_billing_periods bp
      JOIN camp_reservations r ON r.id = bp.reservation_id
      WHERE r.status NOT IN ('cancelled', 'completed')
        AND bp.period_index >= 1
        AND bp.status IN ('unpaid', 'partial')
        AND bp.due_date = ${targetDueDate}::date
        AND bp.amount_due_cents > bp.amount_paid_cents
        AND bp.balance_reminder_7d_sent_at IS NULL
      ORDER BY bp.due_date ASC
      LIMIT 100
    `;
  } else {
    rows = await sql`
      SELECT r.id, r.camp_slug, r.check_in_date, r.check_out_date, r.reservation_type,
             r.member_number, r.member_display_name, r.guest_email, r.guest_first_name, r.guest_last_name,
             bp.id AS period_id, bp.period_index, bp.due_date,
             bp.amount_due_cents, bp.amount_paid_cents
      FROM camp_billing_periods bp
      JOIN camp_reservations r ON r.id = bp.reservation_id
      WHERE r.status NOT IN ('cancelled', 'completed')
        AND bp.period_index >= 1
        AND bp.status IN ('unpaid', 'partial')
        AND bp.due_date = ${targetDueDate}::date
        AND bp.amount_due_cents > bp.amount_paid_cents
        AND bp.balance_reminder_3d_sent_at IS NULL
      ORDER BY bp.due_date ASC
      LIMIT 100
    `;
  }

  return (Array.isArray(rows) ? rows : []) as BillingPeriodReminderRow[];
}

async function markBillingPeriodReminderSent(
  periodId: string,
  daysBefore: BalanceReminderDays
): Promise<void> {
  if (!sql) return;
  if (daysBefore === 14) {
    await sql`
      UPDATE camp_billing_periods
      SET balance_reminder_14d_sent_at = NOW(), updated_at = NOW()
      WHERE id = ${periodId} AND balance_reminder_14d_sent_at IS NULL
    `;
  } else if (daysBefore === 7) {
    await sql`
      UPDATE camp_billing_periods
      SET balance_reminder_7d_sent_at = NOW(), updated_at = NOW()
      WHERE id = ${periodId} AND balance_reminder_7d_sent_at IS NULL
    `;
  } else {
    await sql`
      UPDATE camp_billing_periods
      SET balance_reminder_3d_sent_at = NOW(), updated_at = NOW()
      WHERE id = ${periodId} AND balance_reminder_3d_sent_at IS NULL
    `;
  }
}

export async function sendBalanceRemindersForDay(
  daysBefore: BalanceReminderDays
): Promise<{ sent: number; skipped: number }> {
  let sent = 0;
  let skipped = 0;

  const candidates = await fetchBeforeArrivalCandidates(daysBefore);
  for (const row of candidates) {
    const periods = await listBillingPeriods(row.id);
    const checkIn = toDateOnlyStr(row.check_in_date);
    const checkOut = toDateOnlyStr(row.check_out_date);
    const isLongTerm = isLongTermMemberStay({
      checkInDate: checkIn,
      checkOutDate: checkOut,
      reservationType: row.reservation_type,
    });
    const beforeArrivalCents = balanceDueBeforeArrivalCents(periods, isLongTerm);
    if (beforeArrivalCents < 1) {
      skipped++;
      continue;
    }

    const recipient = await resolveRecipient(row);
    if (!recipient) {
      skipped++;
      continue;
    }

    const campName = getCampBySlug(row.camp_slug)?.name ?? row.camp_slug;
    const token = await createReservationPayToken(row.id);
    const payBalanceUrl = reservationPayPageUrl(token);

    const ok = await sendReservationBalanceReminderEmail({
      to: recipient.email,
      campName,
      guestOrMemberName: recipient.name,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      balanceDueCents: beforeArrivalCents,
      daysBefore,
      payBalanceUrl,
      reminderKind: "before_arrival",
    });

    if (ok) {
      await markBeforeArrivalReminderSent(row.id, daysBefore);
      sent++;
    } else {
      skipped++;
    }
  }

  const periodCandidates = await fetchBillingPeriodCandidates(daysBefore);
  for (const row of periodCandidates) {
    const periodBalance = Math.max(0, row.amount_due_cents - row.amount_paid_cents);
    if (periodBalance < 1) {
      skipped++;
      continue;
    }

    const recipient = await resolveRecipient(row);
    if (!recipient) {
      skipped++;
      continue;
    }

    const campName = getCampBySlug(row.camp_slug)?.name ?? row.camp_slug;
    const token = await createReservationPayToken(row.id);
    const payBalanceUrl = reservationPayPageUrl(token);
    const dueDate = toDateOnlyStr(row.due_date);

    const ok = await sendReservationBalanceReminderEmail({
      to: recipient.email,
      campName,
      guestOrMemberName: recipient.name,
      checkInDate: toDateOnlyStr(row.check_in_date),
      checkOutDate: toDateOnlyStr(row.check_out_date),
      balanceDueCents: periodBalance,
      daysBefore,
      payBalanceUrl,
      reminderKind: "billing_period",
      paymentDueDate: dueDate,
    });

    if (ok) {
      await markBillingPeriodReminderSent(row.period_id, daysBefore);
      sent++;
    } else {
      skipped++;
    }
  }

  return { sent, skipped };
}

export async function sendAllBalanceReminders(): Promise<
  Record<BalanceReminderDays, { sent: number; skipped: number }>
> {
  const results = {} as Record<BalanceReminderDays, { sent: number; skipped: number }>;
  for (const days of [14, 7, 3] as const) {
    results[days] = await sendBalanceRemindersForDay(days);
  }
  return results;
}

/** Reservations with a collectible balance soon (for MRS digest). */
export async function fetchUpcomingBalanceDueReservations(withinDays = 7) {
  if (!hasDb() || !sql) return [];
  const today = new Date().toISOString().slice(0, 10);
  const horizon = addDaysIso(today, withinDays);

  const rows = await sql`
    SELECT r.id, r.camp_slug, r.check_in_date, r.check_out_date, r.reservation_type,
           r.member_number, r.member_display_name, r.guest_email, r.guest_first_name, r.guest_last_name,
           s.site_code, s.name AS site_name, s.site_type, s.special_type
    FROM camp_reservations r
    JOIN camp_sites s ON s.id = r.site_id
    WHERE r.status NOT IN ('cancelled', 'completed')
      AND r.check_out_date >= ${today}::date
    ORDER BY r.check_in_date ASC
    LIMIT 300
  `;

  const out: Array<{
    campSlug: string;
    campName: string;
    guestLabel: string;
    email: string;
    checkIn: string;
    checkOut: string;
    balanceDueCents: number;
    daysUntilCheckIn: number;
    siteLabel: string;
    dueLabel: string;
  }> = [];

  for (const row of Array.isArray(rows) ? rows : []) {
    const r = row as ReminderRow & {
      site_code: string | null;
      site_name: string;
      site_type: string;
      special_type: string | null;
    };
    const checkIn = toDateOnlyStr(r.check_in_date);
    const checkOut = toDateOnlyStr(r.check_out_date);
    const periods = await listBillingPeriods(r.id);
    const obligations = summarizeReservationPaymentObligations({
      periods,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      reservationType: r.reservation_type,
      today,
    });

    if (obligations.paidInFull) continue;

    let amountCents = 0;
    let dueLabel = "";
    let daysUntil = 999;

    if (obligations.payableNowCents > 0) {
      amountCents = obligations.payableNowCents;
      if (obligations.nextScheduledPayment && today >= checkIn) {
        dueLabel = `due ${obligations.nextScheduledPayment.dueDate}`;
        daysUntil = daysBetweenIso(today, obligations.nextScheduledPayment.dueDate);
      } else if (obligations.balanceDueBeforeArrivalCents > 0 && today < checkIn) {
        dueLabel = "before arrival";
        daysUntil = daysBetweenIso(today, checkIn);
      } else {
        dueLabel = "due now";
        daysUntil = 0;
      }
    } else if (
      obligations.balanceDueBeforeArrivalCents > 0 &&
      today < checkIn &&
      checkIn <= horizon
    ) {
      amountCents = obligations.balanceDueBeforeArrivalCents;
      dueLabel = "before arrival";
      daysUntil = daysBetweenIso(today, checkIn);
    } else {
      continue;
    }

    if (amountCents < 1) continue;

    const recipient = await resolveRecipient(r);
    if (!recipient) continue;

    out.push({
      campSlug: r.camp_slug,
      campName: getCampBySlug(r.camp_slug)?.name ?? r.camp_slug,
      guestLabel: recipient.name,
      email: recipient.email,
      checkIn,
      checkOut,
      balanceDueCents: amountCents,
      daysUntilCheckIn: daysUntil,
      siteLabel: formatSiteAssignmentLabel({
        site_code: r.site_code,
        name: r.site_name,
        site_type: r.site_type,
        special_type: r.special_type,
      } as CampSiteRow),
      dueLabel,
    });
  }

  return out.sort((a, b) => a.daysUntilCheckIn - b.daysUntilCheckIn).slice(0, 200);
}
