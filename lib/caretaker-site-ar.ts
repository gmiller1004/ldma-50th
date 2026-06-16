/**
 * Site-fee AR and payment-due queries for caretaker portal + admin dashboard.
 */

import { sql, hasDb } from "@/lib/db";
import { directoryCamps } from "@/lib/directory-camps";

export type PaymentDueItem = {
  reservationId: string;
  siteName: string | null;
  guestLabel: string;
  balanceDueCents: number;
  nextDueDate: string | null;
  isOverdue: boolean;
};

export type CampSiteArSummary = {
  campSlug: string;
  campName: string;
  balanceDueCents: number;
  overdueCents: number;
  reservationsWithBalance: number;
  overdueReservations: number;
};

export type PriceOverrideRow = {
  id: string;
  campSlug: string;
  invoiceNumber: string | null;
  siteName: string | null;
  guestLabel: string;
  calculatedTotalCents: number | null;
  amountOverrideCents: number | null;
  overrideReason: string | null;
  createdAt: string;
};

function guestLabel(row: {
  reservation_type: string;
  member_display_name: string | null;
  member_number: string | null;
  guest_first_name: string | null;
  guest_last_name: string | null;
}): string {
  if (row.reservation_type === "member") {
    return row.member_display_name?.trim() || (row.member_number ? `#${row.member_number}` : "Member");
  }
  return [row.guest_first_name, row.guest_last_name].filter(Boolean).join(" ").trim() || "Guest";
}

export async function fetchPaymentsDueForCamp(
  campSlug: string,
  daysAhead = 7
): Promise<PaymentDueItem[]> {
  if (!hasDb() || !sql) return [];
  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + daysAhead);
  const horizonStr = horizon.toISOString().slice(0, 10);

  const rows = await sql`
    SELECT r.id AS reservation_id, s.name AS site_name, r.reservation_type,
           r.member_display_name, r.member_number, r.guest_first_name, r.guest_last_name,
           COALESCE(SUM(bp.amount_due_cents - bp.amount_paid_cents), 0)::int AS balance_due,
           MIN(bp.due_date) FILTER (WHERE bp.status IN ('unpaid', 'partial'))::text AS next_due,
           BOOL_OR(bp.status IN ('unpaid', 'partial') AND bp.due_date < ${today}::date) AS is_overdue
    FROM camp_reservations r
    JOIN camp_sites s ON s.id = r.site_id
    JOIN camp_billing_periods bp ON bp.reservation_id = r.id AND bp.status IN ('unpaid', 'partial')
    WHERE r.camp_slug = ${campSlug}
      AND r.status != 'cancelled'
      AND r.check_out_date >= ${today}::date
      AND bp.due_date <= ${horizonStr}::date
    GROUP BY r.id, s.name, r.reservation_type, r.member_display_name, r.member_number,
             r.guest_first_name, r.guest_last_name
    HAVING COALESCE(SUM(bp.amount_due_cents - bp.amount_paid_cents), 0) > 0
    ORDER BY MIN(bp.due_date) ASC, r.check_in_date ASC
  `;

  return (Array.isArray(rows) ? rows : []).map((row) => {
    const r = row as {
      reservation_id: string;
      site_name: string | null;
      reservation_type: string;
      member_display_name: string | null;
      member_number: string | null;
      guest_first_name: string | null;
      guest_last_name: string | null;
      balance_due: number;
      next_due: string | null;
      is_overdue: boolean;
    };
    return {
      reservationId: r.reservation_id,
      siteName: r.site_name,
      guestLabel: guestLabel(r),
      balanceDueCents: r.balance_due,
      nextDueDate: r.next_due ? String(r.next_due).slice(0, 10) : null,
      isOverdue: Boolean(r.is_overdue),
    };
  });
}

export async function fetchSiteArByCamp(): Promise<CampSiteArSummary[]> {
  if (!hasDb() || !sql) {
    return directoryCamps.map((c) => ({
      campSlug: c.slug,
      campName: c.name,
      balanceDueCents: 0,
      overdueCents: 0,
      reservationsWithBalance: 0,
      overdueReservations: 0,
    }));
  }

  const today = new Date().toISOString().slice(0, 10);
  const rows = await sql`
    SELECT r.camp_slug,
           COALESCE(SUM(bp.amount_due_cents - bp.amount_paid_cents), 0)::int AS balance_due,
           COALESCE(SUM(
             CASE WHEN bp.due_date < ${today}::date THEN bp.amount_due_cents - bp.amount_paid_cents ELSE 0 END
           ), 0)::int AS overdue_cents,
           COUNT(DISTINCT r.id)::int AS res_count,
           COUNT(DISTINCT r.id) FILTER (
             WHERE EXISTS (
               SELECT 1 FROM camp_billing_periods bp2
               WHERE bp2.reservation_id = r.id
                 AND bp2.status IN ('unpaid', 'partial')
                 AND bp2.due_date < ${today}::date
             )
           )::int AS overdue_res_count
    FROM camp_reservations r
    JOIN camp_billing_periods bp ON bp.reservation_id = r.id AND bp.status IN ('unpaid', 'partial')
    WHERE r.status != 'cancelled'
    GROUP BY r.camp_slug
  `;

  const bySlug = new Map<string, CampSiteArSummary>();
  for (const c of directoryCamps) {
    bySlug.set(c.slug, {
      campSlug: c.slug,
      campName: c.name,
      balanceDueCents: 0,
      overdueCents: 0,
      reservationsWithBalance: 0,
      overdueReservations: 0,
    });
  }

  for (const row of Array.isArray(rows) ? rows : []) {
    const r = row as {
      camp_slug: string;
      balance_due: number;
      overdue_cents: number;
      res_count: number;
      overdue_res_count: number;
    };
    const camp = directoryCamps.find((c) => c.slug === r.camp_slug);
    if (!camp) continue;
    bySlug.set(r.camp_slug, {
      campSlug: r.camp_slug,
      campName: camp.name,
      balanceDueCents: r.balance_due,
      overdueCents: r.overdue_cents,
      reservationsWithBalance: r.res_count,
      overdueReservations: r.overdue_res_count,
    });
  }

  return directoryCamps.map((c) => bySlug.get(c.slug)!);
}

export async function fetchFlaggedPriceOverrides(limit = 100): Promise<PriceOverrideRow[]> {
  if (!hasDb() || !sql) return [];
  const rows = await sql`
    SELECT r.id, r.camp_slug, r.invoice_number, s.name AS site_name,
           r.reservation_type, r.member_display_name, r.member_number,
           r.guest_first_name, r.guest_last_name,
           r.calculated_total_cents, r.amount_override_cents, r.override_reason, r.created_at
    FROM camp_reservations r
    LEFT JOIN camp_sites s ON s.id = r.site_id
    WHERE r.price_override_flag = TRUE
    ORDER BY r.created_at DESC
    LIMIT ${limit}
  `;
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const r = row as {
      id: string;
      camp_slug: string;
      invoice_number: string | null;
      site_name: string | null;
      reservation_type: string;
      member_display_name: string | null;
      member_number: string | null;
      guest_first_name: string | null;
      guest_last_name: string | null;
      calculated_total_cents: number | null;
      amount_override_cents: number | null;
      override_reason: string | null;
      created_at: string;
    };
    return {
      id: r.id,
      campSlug: r.camp_slug,
      invoiceNumber: r.invoice_number,
      siteName: r.site_name,
      guestLabel: guestLabel(r),
      calculatedTotalCents: r.calculated_total_cents,
      amountOverrideCents: r.amount_override_cents,
      overrideReason: r.override_reason,
      createdAt: String(r.created_at),
    };
  });
}
