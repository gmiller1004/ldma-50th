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
};

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
): Promise<Omit<CampAdminMetrics, "slug" | "name" | "assignedCaretakers">> {
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
export async function buildCaretakerAdminSummary(): Promise<{
  camps: CampAdminMetrics[];
  rosterUnmapped: CaretakerRosterRow[];
}> {
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

  const camps: CampAdminMetrics[] = [];

  for (const camp of directoryCamps) {
    const slug = camp.slug;
    const assigned = bySlug.get(slug) ?? [];
    let metrics: Omit<CampAdminMetrics, "slug" | "name" | "assignedCaretakers">;
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
    camps.push({
      slug,
      name: camp.name,
      assignedCaretakers: assigned,
      ...metrics,
    });
  }

  return { camps, rosterUnmapped: unmapped };
}
