/**
 * Send balance-due reminder emails at 14, 7, and 3 days before check-in.
 */

import { sql, hasDb } from "@/lib/db";
import { getReservationBalance } from "@/lib/reservation-billing";
import { lookupMember } from "@/lib/salesforce";
import { getCampBySlug } from "@/lib/directory-camps";
import { createReservationPayToken } from "@/lib/reservation-pay-token";
import { reservationPayPageUrl } from "@/lib/reservation-notify";
import {
  sendReservationBalanceReminderEmail,
  type BalanceReminderDays,
} from "@/lib/sendgrid";
import { formatSiteAssignmentLabel, type CampSiteRow } from "@/lib/public-camp-booking";

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

async function fetchReminderCandidates(daysBefore: BalanceReminderDays): Promise<ReminderRow[]> {
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

async function markReminderSent(reservationId: string, daysBefore: BalanceReminderDays): Promise<void> {
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

export async function sendBalanceRemindersForDay(
  daysBefore: BalanceReminderDays
): Promise<{ sent: number; skipped: number }> {
  let sent = 0;
  let skipped = 0;

  const candidates = await fetchReminderCandidates(daysBefore);
  for (const row of candidates) {
    const balance = await getReservationBalance(row.id);
    if (balance.balanceDueCents < 1) {
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
      checkInDate: String(row.check_in_date).slice(0, 10),
      checkOutDate: String(row.check_out_date).slice(0, 10),
      balanceDueCents: balance.balanceDueCents,
      daysBeforeCheckIn: daysBefore,
      payBalanceUrl,
    });

    if (ok) {
      await markReminderSent(row.id, daysBefore);
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

/** Reservations with balance due, check-in within N days (for MRS digest). */
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
      AND r.check_in_date >= ${today}::date
      AND r.check_in_date <= ${horizon}::date
    ORDER BY r.check_in_date ASC
    LIMIT 200
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
  }> = [];

  for (const row of Array.isArray(rows) ? rows : []) {
    const r = row as ReminderRow & {
      site_code: string | null;
      site_name: string;
      site_type: string;
      special_type: string | null;
    };
    const balance = await getReservationBalance(r.id);
    if (balance.balanceDueCents < 1) continue;
    const recipient = await resolveRecipient(r);
    if (!recipient) continue;
    const checkIn = String(r.check_in_date).slice(0, 10);
    const todayMs = new Date(`${today}T12:00:00`).getTime();
    const checkInMs = new Date(`${checkIn}T12:00:00`).getTime();
    const daysUntilCheckIn = Math.round((checkInMs - todayMs) / (24 * 60 * 60 * 1000));

    out.push({
      campSlug: r.camp_slug,
      campName: getCampBySlug(r.camp_slug)?.name ?? r.camp_slug,
      guestLabel: recipient.name,
      email: recipient.email,
      checkIn,
      checkOut: String(r.check_out_date).slice(0, 10),
      balanceDueCents: balance.balanceDueCents,
      daysUntilCheckIn,
      siteLabel: formatSiteAssignmentLabel({
        site_code: r.site_code,
        name: r.site_name,
        site_type: r.site_type,
        special_type: r.special_type,
      } as CampSiteRow),
    });
  }

  return out;
}
