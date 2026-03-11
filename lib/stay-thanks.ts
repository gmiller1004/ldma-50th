/**
 * Stay thank-you: find ended stays that haven't been thanked and record when we send.
 * Used by cron to send one thank-you email per stay the day after check-out.
 */

import { sql, hasDb } from "@/lib/db";

export type StayType = "reservation" | "member_check_in" | "guest_check_in";

export type StayAs = "member" | "guest";

export type EndedStay = {
  stayType: StayType;
  stayId: string;
  campSlug: string;
  checkInDate: string;
  checkOutDate: string;
  /** Whether they were member or guest for this stay (for Klaviyo sync). */
  stayAs: StayAs;
  /** Set for guests; for members we look up from Salesforce in the cron. */
  email: string | null;
  /** Display name for the email; for members we may override from lookup. */
  recipientName: string;
  /** Set for members so cron can look up email. */
  memberNumber: string | null;
};

/**
 * Returns stays that ended on the given date (check_out_date = date) and do not yet have a thank-you sent.
 * date: YYYY-MM-DD (typically yesterday).
 */
export async function getEndedStaysNotThanked(date: string): Promise<EndedStay[]> {
  if (!hasDb() || !sql) return [];

  const rows: EndedStay[] = [];

  // Reservations (not cancelled)
  const reservations = await sql`
    SELECT r.id, r.camp_slug, r.check_in_date, r.check_out_date, r.reservation_type,
           r.member_number, r.member_display_name, r.guest_email, r.guest_first_name, r.guest_last_name
    FROM camp_reservations r
    WHERE r.check_out_date = ${date}::date
      AND r.status != 'cancelled'
      AND NOT EXISTS (
        SELECT 1 FROM camp_stay_thanks t
        WHERE t.stay_type = 'reservation' AND t.stay_id = r.id
      )
  `;
  for (const r of Array.isArray(reservations) ? reservations : []) {
    const row = r as {
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
    if (row.reservation_type === "guest") {
      const email = row.guest_email?.trim() || null;
      const name = [row.guest_first_name, row.guest_last_name].filter(Boolean).join(" ").trim() || "Guest";
      if (email) rows.push({ stayType: "reservation", stayId: row.id, campSlug: row.camp_slug, checkInDate: row.check_in_date, checkOutDate: row.check_out_date, stayAs: "guest", email, recipientName: name, memberNumber: null });
    } else {
      const name = row.member_display_name?.trim() || (row.member_number ? `#${row.member_number}` : "Member");
      rows.push({ stayType: "reservation", stayId: row.id, campSlug: row.camp_slug, checkInDate: row.check_in_date, checkOutDate: row.check_out_date, stayAs: "member", email: null, recipientName: name, memberNumber: row.member_number?.trim() || null });
    }
  }

  // Member check-ins (caretaker_check_ins table may not exist in all envs)
  try {
    const memberCheckIns = await sql`
      SELECT c.id, c.camp_slug, c.check_in_date, c.check_out_date, c.member_number, c.member_display_name
      FROM caretaker_check_ins c
      WHERE c.check_out_date = ${date}::date
        AND NOT EXISTS (
          SELECT 1 FROM camp_stay_thanks t
          WHERE t.stay_type = 'member_check_in' AND t.stay_id = c.id
        )
    `;
    for (const c of Array.isArray(memberCheckIns) ? memberCheckIns : []) {
      const row = c as { id: string; camp_slug: string; check_in_date: string; check_out_date: string; member_number: string; member_display_name: string | null };
      const name = row.member_display_name?.trim() || (row.member_number ? `#${row.member_number}` : "Member");
      rows.push({ stayType: "member_check_in", stayId: row.id, campSlug: row.camp_slug, checkInDate: row.check_in_date, checkOutDate: row.check_out_date, stayAs: "member", email: null, recipientName: name, memberNumber: row.member_number?.trim() || null });
    }
  } catch {
    // Table may not exist
  }

  // Guest check-ins
  try {
    const guestCheckIns = await sql`
      SELECT g.id, g.camp_slug, g.check_in_date, g.check_out_date, g.email, g.first_name, g.last_name
      FROM caretaker_guest_check_ins g
      WHERE g.check_out_date = ${date}::date
        AND NOT EXISTS (
          SELECT 1 FROM camp_stay_thanks t
          WHERE t.stay_type = 'guest_check_in' AND t.stay_id = g.id
        )
    `;
    for (const g of Array.isArray(guestCheckIns) ? guestCheckIns : []) {
      const row = g as { id: string; camp_slug: string; check_in_date: string; check_out_date: string; email: string; first_name: string; last_name: string | null };
      const email = row.email?.trim() || null;
      const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || "Guest";
      if (email) rows.push({ stayType: "guest_check_in", stayId: row.id, campSlug: row.camp_slug, checkInDate: row.check_in_date, checkOutDate: row.check_out_date, stayAs: "guest", email, recipientName: name, memberNumber: null });
    }
  } catch {
    // Table may not exist
  }

  return rows;
}

/**
 * Record that we sent a thank-you for this stay (idempotent).
 */
export async function recordStayThankYou(stayType: StayType, stayId: string): Promise<void> {
  if (!hasDb() || !sql) return;
  await sql`
    INSERT INTO camp_stay_thanks (stay_type, stay_id)
    VALUES (${stayType}, ${stayId})
    ON CONFLICT (stay_type, stay_id) DO NOTHING
  `;
}
