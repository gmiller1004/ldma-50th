/**
 * Read-only aggregates for Caretaker_Admin__c dashboard: DB activity + Salesforce roster.
 */

import { sql, hasDb } from "@/lib/db";
import { directoryCamps } from "@/lib/directory-camps";
import { caretakerCampToSlug } from "@/lib/caretaker-camps";
import { getSalesforceRestClient } from "@/lib/salesforce";
import { fetchSiteArByCamp } from "@/lib/caretaker-site-ar";

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
  /** Reserved or checked-in stays including today */
  reservationsOnProperty: number;
  memberReservationsOnProperty: number;
  guestReservationsOnProperty: number;
  /** Active checked-in (not just reserved) */
  checkedInReservations: number;
  /** Not cancelled, checkout today or later */
  activeReservations: number;
  /** Created in last 30 days */
  reservationsCreatedLast30Days: number;
  /** Unpaid site-fee billing periods */
  balanceDueCents: number;
  overdueCents: number;
  reservationsWithBalance: number;
  overdueReservations: number;
  assignedCaretakers: CaretakerRosterRow[];
  reservationsCreatedLast30DaysByCaretaker: { caretakerContactId: string; count: number }[];
  stripeReservationCents: number;
  stripePastDueCents: number;
  stripeOtherCents: number;
  stripeTotalCents: number;
  stripePaymentCount: number;
};

export type CaretakerAdminGlobalMetrics = {
  totalOnSiteReservations: number;
  totalMemberOnSite: number;
  totalGuestOnSite: number;
  totalCheckedIn: number;
  totalOpenReservations: number;
  totalReservationsCreated30d: number;
  totalBalanceDueCents: number;
  totalOverdueCents: number;
  totalReservationsWithBalance: number;
  stripeReservationCents: number;
  stripePastDueCents: number;
  stripeOtherCents: number;
  stripeTotalCents: number;
  stripePaymentCount: number;
  totalRosterAssignments: number;
};

export type CaretakerAdminSummaryParams = {
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

/** Emails for caretakers assigned to a camp (deduped, optional exclude e.g. guest recipient). */
export function uniqueCaretakerEmailsForCamp(
  roster: Array<Pick<CaretakerRosterRow, "campSlug" | "email">>,
  campSlug: string,
  excludeEmail?: string | null
): string[] {
  const exclude = excludeEmail?.trim().toLowerCase() || null;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of roster) {
    if (row.campSlug !== campSlug) continue;
    const email = row.email?.trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (exclude && key === exclude) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(email);
  }
  return out;
}

export async function fetchCaretakerEmailsForCamp(
  campSlug: string,
  excludeEmail?: string | null
): Promise<string[]> {
  const roster = await fetchCaretakerRosterFromSalesforce();
  return uniqueCaretakerEmailsForCamp(roster, campSlug, excludeEmail);
}

async function campDbMetrics(
  dbSql: NonNullable<typeof sql>,
  slug: string,
  today: string,
  since30: string
): Promise<{
  reservationsOnProperty: number;
  memberReservationsOnProperty: number;
  guestReservationsOnProperty: number;
  checkedInReservations: number;
  activeReservations: number;
  reservationsCreatedLast30Days: number;
  reservationsCreatedLast30DaysByCaretaker: { caretakerContactId: string; count: number }[];
}> {
  const onSite = await dbSql`
    SELECT COUNT(*)::int AS c FROM camp_reservations
    WHERE camp_slug = ${slug} AND status IN ('reserved', 'checked_in')
      AND check_in_date <= ${today} AND check_out_date >= ${today}
  `;
  const membersOnSite = await dbSql`
    SELECT COUNT(*)::int AS c FROM camp_reservations
    WHERE camp_slug = ${slug} AND status IN ('reserved', 'checked_in')
      AND reservation_type = 'member'
      AND check_in_date <= ${today} AND check_out_date >= ${today}
  `;
  const guestsOnSite = await dbSql`
    SELECT COUNT(*)::int AS c FROM camp_reservations
    WHERE camp_slug = ${slug} AND status IN ('reserved', 'checked_in')
      AND reservation_type = 'guest'
      AND check_in_date <= ${today} AND check_out_date >= ${today}
  `;
  const checkedIn = await dbSql`
    SELECT COUNT(*)::int AS c FROM camp_reservations
    WHERE camp_slug = ${slug} AND status = 'checked_in' AND check_out_date >= ${today}
  `;
  const resActive = await dbSql`
    SELECT COUNT(*)::int AS c FROM camp_reservations
    WHERE camp_slug = ${slug} AND status != 'cancelled' AND check_out_date >= ${today}
  `;
  const res30 = await dbSql`
    SELECT COUNT(*)::int AS c FROM camp_reservations
    WHERE camp_slug = ${slug} AND created_at >= ${since30}
  `;
  const byCt = await dbSql`
    SELECT created_by_contact_id AS caretaker_contact_id, COUNT(*)::int AS count
    FROM camp_reservations
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
    reservationsOnProperty: num(onSite)?.c ?? 0,
    memberReservationsOnProperty: num(membersOnSite)?.c ?? 0,
    guestReservationsOnProperty: num(guestsOnSite)?.c ?? 0,
    checkedInReservations: num(checkedIn)?.c ?? 0,
    activeReservations: num(resActive)?.c ?? 0,
    reservationsCreatedLast30Days: num(res30)?.c ?? 0,
    reservationsCreatedLast30DaysByCaretaker: byCaretaker.map((r) => ({
      caretakerContactId: r.caretaker_contact_id,
      count: Number(r.count) || 0,
    })),
  };
}

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

  const arByCamp = await fetchSiteArByCamp();
  const arMap = new Map(arByCamp.map((a) => [a.campSlug, a]));

  const camps: CampAdminMetrics[] = [];

  for (const camp of directoryCamps) {
    const slug = camp.slug;
    const assigned = bySlug.get(slug) ?? [];
    const ar = arMap.get(slug);
    let metrics: Awaited<ReturnType<typeof campDbMetrics>>;
    if (hasDb() && sql) {
      metrics = await campDbMetrics(sql, slug, today, since30);
    } else {
      metrics = {
        reservationsOnProperty: 0,
        memberReservationsOnProperty: 0,
        guestReservationsOnProperty: 0,
        checkedInReservations: 0,
        activeReservations: 0,
        reservationsCreatedLast30Days: 0,
        reservationsCreatedLast30DaysByCaretaker: [],
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
      balanceDueCents: ar?.balanceDueCents ?? 0,
      overdueCents: ar?.overdueCents ?? 0,
      reservationsWithBalance: ar?.reservationsWithBalance ?? 0,
      overdueReservations: ar?.overdueReservations ?? 0,
      stripeReservationCents: st.reservationCents,
      stripePastDueCents: st.pastDueCents,
      stripeOtherCents: st.otherCents,
      stripeTotalCents: st.reservationCents + st.pastDueCents + st.otherCents,
      stripePaymentCount: st.count,
    });
  }

  const global: CaretakerAdminGlobalMetrics = camps.reduce(
    (acc, c) => ({
      totalOnSiteReservations: acc.totalOnSiteReservations + c.reservationsOnProperty,
      totalMemberOnSite: acc.totalMemberOnSite + c.memberReservationsOnProperty,
      totalGuestOnSite: acc.totalGuestOnSite + c.guestReservationsOnProperty,
      totalCheckedIn: acc.totalCheckedIn + c.checkedInReservations,
      totalOpenReservations: acc.totalOpenReservations + c.activeReservations,
      totalReservationsCreated30d: acc.totalReservationsCreated30d + c.reservationsCreatedLast30Days,
      totalBalanceDueCents: acc.totalBalanceDueCents + c.balanceDueCents,
      totalOverdueCents: acc.totalOverdueCents + c.overdueCents,
      totalReservationsWithBalance: acc.totalReservationsWithBalance + c.reservationsWithBalance,
      stripeReservationCents: acc.stripeReservationCents + c.stripeReservationCents,
      stripePastDueCents: acc.stripePastDueCents + c.stripePastDueCents,
      stripeOtherCents: acc.stripeOtherCents + c.stripeOtherCents,
      stripeTotalCents: acc.stripeTotalCents + c.stripeTotalCents,
      stripePaymentCount: acc.stripePaymentCount + c.stripePaymentCount,
      totalRosterAssignments: acc.totalRosterAssignments + c.assignedCaretakers.length,
    }),
    {
      totalOnSiteReservations: 0,
      totalMemberOnSite: 0,
      totalGuestOnSite: 0,
      totalCheckedIn: 0,
      totalOpenReservations: 0,
      totalReservationsCreated30d: 0,
      totalBalanceDueCents: 0,
      totalOverdueCents: 0,
      totalReservationsWithBalance: 0,
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
