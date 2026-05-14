/**
 * Read-only aggregates for Caretaker_Admin__c dashboard: DB activity + Salesforce roster.
 */

import { sql, hasDb } from "@/lib/db";
import { directoryCamps } from "@/lib/directory-camps";
import { caretakerCampToSlug } from "@/lib/caretaker-camps";
import { getSalesforceRestClient } from "@/lib/salesforce";

const SF_VERSION = process.env.SALESFORCE_API_VERSION || "v59.0";

export type CaretakerRosterRow = {
  contactId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  customerNumber: string | null;
  caretakerAtCampLabel: string;
  campSlug: string | null;
};

export type CampAdminMetrics = {
  slug: string;
  name: string;
  activeMemberCheckIns: number;
  activeGuestCheckIns: number;
  memberCheckInsLast30Days: number;
  guestCheckInsLast30Days: number;
  activeReservations: number;
  /** reserved or checked_in with stay overlapping today */
  reservationsOnProperty: number;
  assignedCaretakers: CaretakerRosterRow[];
  /** Member check-ins in last 30d grouped by caretaker contact who created the row */
  checkInsLast30DaysByCaretaker: { caretakerContactId: string; count: number }[];
  /** Stripe card revenue in the requested period (from camp_payments), cents */
  stripeReservationCents: number;
  stripePastDueCents: number;
  stripeOtherCents: number;
  stripeTotalCents: number;
  stripePaymentCount: number;
};

/** Rolled-up numbers across all directory camps (same period as Stripe fields on each camp). */
export type CaretakerAdminGlobalMetrics = {
  totalMembersOnStay: number;
  totalGuestsOnStay: number;
  totalMemberCheckIns30d: number;
  totalGuestCheckIns30d: number;
  totalOpenReservations: number;
  totalOnSiteReservations: number;
  stripeReservationCents: number;
  stripePastDueCents: number;
  stripeOtherCents: number;
  stripeTotalCents: number;
  stripePaymentCount: number;
  /** Sum of roster rows (same person at two camps counts twice). */
  totalRosterAssignments: number;
};

export type CaretakerAdminSummaryParams = {
  /** Filter Stripe aggregates on `camp_payments.created_at` (inclusive, date in DB). */
  revenueFrom?: string | null;
  revenueTo?: string | null;
};

function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function parseCents(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  if (typeof v === "bigint") return Number(v);
  const n = parseInt(String(v ?? "0"), 10);
  return Number.isFinite(n) ? n : 0;
}

type StripeAggRow = {
  camp_slug: string;
  payment_type: string;
  sum_cents: unknown;
  cnt: number;
};

/** Per-camp Stripe totals for directory slugs only; all keys present even when zero. */
async function fetchStripeAggregatesByCamp(
  dbSql: NonNullable<typeof sql>,
  from: string | null,
  to: string | null
): Promise<Map<string, { reservationCents: number; pastDueCents: number; otherCents: number; count: number }>> {
  const init = () => {
    const m = new Map<
      string,
      { reservationCents: number; pastDueCents: number; otherCents: number; count: number }
    >();
    for (const c of directoryCamps) {
      m.set(c.slug, { reservationCents: 0, pastDueCents: 0, otherCents: 0, count: 0 });
    }
    return m;
  };

  let rows: StripeAggRow[];
  try {
    if (from && to) {
      if (from > to) {
        rows = [];
      } else {
        const r = await dbSql`
          SELECT camp_slug, payment_type,
                 COALESCE(SUM(amount_cents), 0)::text AS sum_cents,
                 COUNT(*)::int AS cnt
          FROM camp_payments
          WHERE stripe_checkout_session_id IS NOT NULL AND method = 'card'
            AND created_at::date >= ${from}::date AND created_at::date <= ${to}::date
          GROUP BY camp_slug, payment_type
        `;
        rows = (Array.isArray(r) ? r : []) as StripeAggRow[];
      }
    } else if (from) {
      const r = await dbSql`
        SELECT camp_slug, payment_type,
               COALESCE(SUM(amount_cents), 0)::text AS sum_cents,
               COUNT(*)::int AS cnt
        FROM camp_payments
        WHERE stripe_checkout_session_id IS NOT NULL AND method = 'card'
          AND created_at::date >= ${from}::date
        GROUP BY camp_slug, payment_type
      `;
      rows = (Array.isArray(r) ? r : []) as StripeAggRow[];
    } else if (to) {
      const r = await dbSql`
        SELECT camp_slug, payment_type,
               COALESCE(SUM(amount_cents), 0)::text AS sum_cents,
               COUNT(*)::int AS cnt
        FROM camp_payments
        WHERE stripe_checkout_session_id IS NOT NULL AND method = 'card'
          AND created_at::date <= ${to}::date
        GROUP BY camp_slug, payment_type
      `;
      rows = (Array.isArray(r) ? r : []) as StripeAggRow[];
    } else {
      const r = await dbSql`
        SELECT camp_slug, payment_type,
               COALESCE(SUM(amount_cents), 0)::text AS sum_cents,
               COUNT(*)::int AS cnt
        FROM camp_payments
        WHERE stripe_checkout_session_id IS NOT NULL AND method = 'card'
        GROUP BY camp_slug, payment_type
      `;
      rows = (Array.isArray(r) ? r : []) as StripeAggRow[];
    }
  } catch (e) {
    console.error("[caretaker-admin] stripe aggregate query failed:", e);
    return init();
  }

  const map = init();
  for (const row of rows) {
    if (!row.camp_slug || !map.has(row.camp_slug)) continue;
    const bucket = map.get(row.camp_slug)!;
    const cents = parseCents(row.sum_cents);
    const cnt = Number(row.cnt) || 0;
    bucket.count += cnt;
    if (row.payment_type === "reservation") bucket.reservationCents += cents;
    else if (row.payment_type === "past_due") bucket.pastDueCents += cents;
    else bucket.otherCents += cents;
    map.set(row.camp_slug, bucket);
  }
  return map;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function thirtyDaysAgoIso(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 30);
  return d.toISOString();
}

export async function fetchCaretakerRosterFromSalesforce(): Promise<CaretakerRosterRow[]> {
  const client = await getSalesforceRestClient();
  if (!client) return [];

  const soql = `SELECT Id, FirstName, LastName, Email, Customer_Number__c, Caretaker_At_Camp__c FROM Contact WHERE Is_LDMA_Caretaker__c = true AND Caretaker_At_Camp__c != null ORDER BY Caretaker_At_Camp__c, LastName`;
  const url = `${client.instanceUrl}/services/data/${SF_VERSION}/query?q=${encodeURIComponent(soql)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${client.accessToken}` },
  });
  if (!res.ok) {
    console.error("[caretaker-admin] roster SOQL failed:", await res.text());
    return [];
  }
  const data = (await res.json()) as { records?: Record<string, unknown>[] };
  const records = data.records ?? [];
  const out: CaretakerRosterRow[] = [];
  for (const r of records) {
    const label =
      typeof r.Caretaker_At_Camp__c === "string" ? r.Caretaker_At_Camp__c.trim() : "";
    if (!label) continue;
    const campSlug = caretakerCampToSlug(label);
    out.push({
      contactId: String(r.Id ?? ""),
      firstName: typeof r.FirstName === "string" ? r.FirstName : null,
      lastName: typeof r.LastName === "string" ? r.LastName : null,
      email: typeof r.Email === "string" ? r.Email : null,
      customerNumber:
        typeof r.Customer_Number__c === "string" ? r.Customer_Number__c : null,
      caretakerAtCampLabel: label,
      campSlug,
    });
  }
  return out.filter((r) => r.contactId.length > 0);
}

async function campDbMetrics(
  dbSql: NonNullable<typeof sql>,
  slug: string,
  today: string,
  since30: string
): Promise<{
  activeMemberCheckIns: number;
  activeGuestCheckIns: number;
  memberCheckInsLast30Days: number;
  guestCheckInsLast30Days: number;
  activeReservations: number;
  reservationsOnProperty: number;
  checkInsLast30DaysByCaretaker: { caretakerContactId: string; count: number }[];
}> {
  const mRows = await dbSql`
    SELECT COUNT(*)::int AS c FROM caretaker_check_ins
    WHERE camp_slug = ${slug} AND check_out_date >= ${today}
  `;
  const gRows = await dbSql`
    SELECT COUNT(*)::int AS c FROM caretaker_guest_check_ins
    WHERE camp_slug = ${slug} AND check_out_date >= ${today}
  `;
  const m30 = await dbSql`
    SELECT COUNT(*)::int AS c FROM caretaker_check_ins
    WHERE camp_slug = ${slug} AND created_at >= ${since30}
  `;
  const g30 = await dbSql`
    SELECT COUNT(*)::int AS c FROM caretaker_guest_check_ins
    WHERE camp_slug = ${slug} AND created_at >= ${since30}
  `;
  const resActive = await dbSql`
    SELECT COUNT(*)::int AS c FROM camp_reservations
    WHERE camp_slug = ${slug} AND status != 'cancelled' AND check_out_date >= ${today}
  `;
  const resOnSite = await dbSql`
    SELECT COUNT(*)::int AS c FROM camp_reservations
    WHERE camp_slug = ${slug} AND status IN ('reserved', 'checked_in')
      AND check_in_date <= ${today} AND check_out_date >= ${today}
  `;
  const byCt = await dbSql`
    SELECT created_by_contact_id AS caretaker_contact_id, COUNT(*)::int AS count
    FROM caretaker_check_ins
    WHERE camp_slug = ${slug} AND created_at >= ${since30}
    GROUP BY created_by_contact_id
    ORDER BY count DESC
  `;

  const num = (rows: unknown) =>
    (Array.isArray(rows) ? rows[0] : null) as { c?: number } | null;
  const byCaretaker = (Array.isArray(byCt) ? byCt : []) as {
    caretaker_contact_id: string;
    count: number;
  }[];

  return {
    activeMemberCheckIns: num(mRows)?.c ?? 0,
    activeGuestCheckIns: num(gRows)?.c ?? 0,
    memberCheckInsLast30Days: num(m30)?.c ?? 0,
    guestCheckInsLast30Days: num(g30)?.c ?? 0,
    activeReservations: num(resActive)?.c ?? 0,
    reservationsOnProperty: num(resOnSite)?.c ?? 0,
    checkInsLast30DaysByCaretaker: byCaretaker.map((r) => ({
      caretakerContactId: r.caretaker_contact_id,
      count: Number(r.count) || 0,
    })),
  };
}

/** Full payload for GET /api/members/caretaker/admin/summary */
export async function buildCaretakerAdminSummary(
  params: CaretakerAdminSummaryParams = {}
): Promise<{
  camps: CampAdminMetrics[];
  rosterUnmapped: CaretakerRosterRow[];
  global: CaretakerAdminGlobalMetrics;
  revenuePeriod: { from: string | null; to: string | null };
}> {
  let revenueFrom = params.revenueFrom?.trim() || null;
  let revenueTo = params.revenueTo?.trim() || null;
  if (revenueFrom && !isIsoDate(revenueFrom)) revenueFrom = null;
  if (revenueTo && !isIsoDate(revenueTo)) revenueTo = null;
  if (revenueFrom && revenueTo && revenueFrom > revenueTo) {
    const t = revenueFrom;
    revenueFrom = revenueTo;
    revenueTo = t;
  }

  const roster = await fetchCaretakerRosterFromSalesforce();
  const bySlug = new Map<string, CaretakerRosterRow[]>();
  const unmapped: CaretakerRosterRow[] = [];
  for (const row of roster) {
    if (row.campSlug) {
      const list = bySlug.get(row.campSlug) ?? [];
      list.push(row);
      bySlug.set(row.campSlug, list);
    } else {
      unmapped.push(row);
    }
  }

  const today = isoDate(new Date());
  const since30 = thirtyDaysAgoIso();

  const stripeByCamp =
    hasDb() && sql
      ? await fetchStripeAggregatesByCamp(sql, revenueFrom, revenueTo)
      : null;

  const camps: CampAdminMetrics[] = [];

  for (const camp of directoryCamps) {
    const slug = camp.slug;
    const assigned = bySlug.get(slug) ?? [];
    let metrics: Awaited<ReturnType<typeof campDbMetrics>>;
    if (hasDb() && sql) {
      metrics = await campDbMetrics(sql, slug, today, since30);
    } else {
      metrics = {
        activeMemberCheckIns: 0,
        activeGuestCheckIns: 0,
        memberCheckInsLast30Days: 0,
        guestCheckInsLast30Days: 0,
        activeReservations: 0,
        reservationsOnProperty: 0,
        checkInsLast30DaysByCaretaker: [],
      };
    }
    const st = stripeByCamp?.get(slug) ?? {
      reservationCents: 0,
      pastDueCents: 0,
      otherCents: 0,
      count: 0,
    };
    camps.push({
      slug,
      name: camp.name,
      assignedCaretakers: assigned,
      ...metrics,
      stripeReservationCents: st.reservationCents,
      stripePastDueCents: st.pastDueCents,
      stripeOtherCents: st.otherCents,
      stripeTotalCents: st.reservationCents + st.pastDueCents + st.otherCents,
      stripePaymentCount: st.count,
    });
  }

  const global: CaretakerAdminGlobalMetrics = camps.reduce(
    (acc, c) => ({
      totalMembersOnStay: acc.totalMembersOnStay + c.activeMemberCheckIns,
      totalGuestsOnStay: acc.totalGuestsOnStay + c.activeGuestCheckIns,
      totalMemberCheckIns30d: acc.totalMemberCheckIns30d + c.memberCheckInsLast30Days,
      totalGuestCheckIns30d: acc.totalGuestCheckIns30d + c.guestCheckInsLast30Days,
      totalOpenReservations: acc.totalOpenReservations + c.activeReservations,
      totalOnSiteReservations: acc.totalOnSiteReservations + c.reservationsOnProperty,
      stripeReservationCents: acc.stripeReservationCents + c.stripeReservationCents,
      stripePastDueCents: acc.stripePastDueCents + c.stripePastDueCents,
      stripeOtherCents: acc.stripeOtherCents + c.stripeOtherCents,
      stripeTotalCents: acc.stripeTotalCents + c.stripeTotalCents,
      stripePaymentCount: acc.stripePaymentCount + c.stripePaymentCount,
      totalRosterAssignments: acc.totalRosterAssignments + c.assignedCaretakers.length,
    }),
    {
      totalMembersOnStay: 0,
      totalGuestsOnStay: 0,
      totalMemberCheckIns30d: 0,
      totalGuestCheckIns30d: 0,
      totalOpenReservations: 0,
      totalOnSiteReservations: 0,
      stripeReservationCents: 0,
      stripePastDueCents: 0,
      stripeOtherCents: 0,
      stripeTotalCents: 0,
      stripePaymentCount: 0,
      totalRosterAssignments: 0,
    }
  );

  return {
    camps,
    rosterUnmapped: unmapped,
    global,
    revenuePeriod: { from: revenueFrom, to: revenueTo },
  };
}
