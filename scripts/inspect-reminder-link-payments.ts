/**
 * Read-only: online "Pay online" link payments that came in on the day of a balance reminder or the day after.
 * Same matching rule as the Oct 22 check; includes the 14d/7d/3d and 5d/due-date reminder columns.
 *
 *   npx tsx --env-file=.env.local scripts/inspect-reminder-link-payments.ts
 */
import { sql } from "@/lib/db";

const ACTOR = process.env.PUBLIC_BOOKING_ACTOR_CONTACT_ID?.trim() || "public-web-self-service";
const STAGES = ["14d", "7d", "3d", "5d", "due"] as const;

type Payment = {
  id: string;
  paid_at: string;
  paid_day: string;
  amount_cents: number;
  camp_slug: string;
  who: string;
  reservation_id: string;
};

type Reminder = { reservation_id: string; kind: string; stage: string; sent_day: string };

const money = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function main() {
  if (!sql) throw new Error("no db");

  const payments = (await sql`
    SELECT p.id, p.created_at::text AS paid_at,
           (p.created_at AT TIME ZONE 'America/Los_Angeles')::date::text AS paid_day,
           p.amount_cents, p.camp_slug, r.id AS reservation_id,
           COALESCE(NULLIF(r.member_display_name, ''), TRIM(CONCAT(r.guest_first_name, ' ', r.guest_last_name))) AS who
    FROM camp_payments p JOIN camp_reservations r ON r.id = p.reservation_id
    WHERE p.created_by_contact_id = ${ACTOR}
      AND p.payment_type = 'reservation' AND p.amount_cents > 0
      AND p.created_at > r.created_at + INTERVAL '30 minutes'
    ORDER BY p.created_at
  `) as Payment[];

  const reminders: Reminder[] = [];
  for (const stage of STAGES) {
    const col = `balance_reminder_${stage}_sent_at`;
    const arrival = (await sql.query(
      `SELECT id AS reservation_id, 'before arrival' AS kind, $1 AS stage,
              (${col} AT TIME ZONE 'America/Los_Angeles')::date::text AS sent_day
       FROM camp_reservations WHERE ${col} IS NOT NULL`,
      [stage]
    )) as Reminder[];
    const monthly = (await sql.query(
      `SELECT reservation_id, 'monthly payment' AS kind, $1 AS stage,
              (${col} AT TIME ZONE 'America/Los_Angeles')::date::text AS sent_day
       FROM camp_billing_periods WHERE ${col} IS NOT NULL`,
      [stage]
    )) as Reminder[];
    reminders.push(...arrival, ...monthly);
  }

  const byReservation = new Map<string, Reminder[]>();
  for (const r of reminders) {
    const list = byReservation.get(r.reservation_id) ?? [];
    list.push(r);
    byReservation.set(r.reservation_id, list);
  }

  const matched: { p: Payment; reminder: Reminder }[] = [];
  const unmatched: Payment[] = [];
  for (const p of payments) {
    const candidates = (byReservation.get(p.reservation_id) ?? [])
      .filter((r) => r.sent_day === p.paid_day || addDays(r.sent_day, 1) === p.paid_day)
      .sort((a, b) => (a.sent_day < b.sent_day ? 1 : -1));
    if (candidates[0]) matched.push({ p, reminder: candidates[0] });
    else unmatched.push(p);
  }

  const total = matched.reduce((s, m) => s + m.p.amount_cents, 0);
  console.log(`Payments tied to a reminder: ${matched.length} · total ${money(total)}`);
  for (const { p, reminder } of matched) {
    console.log(
      `  ${p.paid_day} · ${p.who} · ${p.camp_slug} · ${money(p.amount_cents)} · after ${reminder.stage} ${reminder.kind} reminder (${reminder.sent_day})`
    );
  }

  const since = "2026-10-22";
  const newOnes = matched.filter((m) => m.p.paid_day > since || (m.p.paid_day === since && m.p.paid_at > "2026-10-23 00:15"));
  console.log(`\nAfter the Oct 22 check: ${newOnes.length} · ${money(newOnes.reduce((s, m) => s + m.p.amount_cents, 0))}`);

  const remindedReservations = new Set(reminders.map((r) => r.reservation_id));
  const remindedPaid = new Set(matched.map((m) => m.p.reservation_id));
  console.log(`Reservations that have received at least one reminder: ${remindedReservations.size}`);
  console.log(`Reminder emails sent in total: ${reminders.length}`);
  console.log(`Reservations that paid online right after a reminder: ${remindedPaid.size}`);

  console.log(`\nOther online link payments not tied to a reminder: ${unmatched.length}`);
  for (const p of unmatched.filter((x) => x.paid_day >= "2026-09-17")) {
    console.log(`  ${p.paid_day} · ${p.who} · ${p.camp_slug} · ${money(p.amount_cents)}`);
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
