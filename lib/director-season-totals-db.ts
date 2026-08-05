/**
 * Server-side Season Totals computation + snapshot persistence.
 */

import { sql, hasDb } from "@/lib/db";
import { getCampBySlug } from "@/lib/directory-camps";
import {
  campUsesReservations,
  isNonBookableSite,
} from "@/lib/reservation-camps";
import { addDays, toDateOnlyStr } from "@/lib/reservation-dates";
import {
  buildSeasonMonthRanges,
  computeSeasonTotalsMetrics,
  countDistinctBookedSiteNights,
  enumerateMonthRange,
  isIsoDate,
  isIsoMonth,
  toDateOnly,
  type MonthlyBookingTotal,
  type SeasonReservationMetricInput,
  type SeasonMonthTotal,
  type SeasonTotalsMetrics,
  type SeasonTotalsSnapshotRow,
} from "@/lib/director-season-totals";
import { nightsInInclusiveRange } from "@/lib/camp-capacity";

type SiteRow = {
  id: string;
  name: string;
  site_code: string | null;
};

type ReservationAggRow = {
  id: string;
  site_id: string;
  check_in_date: string | Date;
  check_out_date: string | Date;
  created_at: string | Date;
  cancelled_at: string | Date | null;
  billed_due_cents: number;
  period_paid_cents: number;
  payment_net_through_as_of: number;
  payment_net_all_time: number;
};

type SnapshotDbRow = {
  id: string;
  camp_slug: string;
  season_from: string | Date;
  season_to: string | Date;
  snapshot_date: string | Date;
  site_nights_booked: number;
  site_nights_available: number;
  total_site_nights: number;
  booked_percent: string | number;
  available_percent: string | number;
  revenue_collected_cents: number;
  revenue_owed_cents: number;
  total_reservations: number;
  generated_at: string | Date;
  generated_by_contact_id: string | null;
};

export type SeasonTotalsSnapshotRecord = SeasonTotalsSnapshotRow & {
  id: string;
  generatedByContactId: string | null;
};

type MonthlyBookingDbRow = {
  booking_month: string;
  reservation_count: number;
  site_nights_booked: number;
};

type SeasonStayDbRow = {
  id: string;
  site_id: string;
  check_in_date: string | Date;
  check_out_date: string | Date;
};

function mapSnapshotRow(row: SnapshotDbRow): SeasonTotalsSnapshotRecord {
  const camp = getCampBySlug(row.camp_slug);
  return {
    id: row.id,
    campSlug: row.camp_slug,
    campName: camp?.name ?? row.camp_slug,
    seasonFrom: toDateOnlyStr(row.season_from),
    seasonTo: toDateOnlyStr(row.season_to),
    snapshotDate: toDateOnlyStr(row.snapshot_date),
    siteNightsBooked: Number(row.site_nights_booked),
    siteNightsAvailable: Number(row.site_nights_available),
    totalSiteNights: Number(row.total_site_nights),
    bookedPercent: Number(row.booked_percent),
    availablePercent: Number(row.available_percent),
    revenueCollectedCents: Number(row.revenue_collected_cents),
    revenueOwedCents: Number(row.revenue_owed_cents),
    totalReservations: Number(row.total_reservations),
    generatedAt:
      row.generated_at instanceof Date
        ? row.generated_at.toISOString()
        : String(row.generated_at),
    generatedByContactId: row.generated_by_contact_id,
  };
}

export async function computeSeasonTotalsFromDb(input: {
  campSlug: string;
  seasonFrom: string;
  seasonTo: string;
  snapshotDate: string;
}): Promise<SeasonTotalsMetrics & { campName: string; bookableSiteCount: number }> {
  if (!hasDb() || !sql) {
    throw new Error("Database not available");
  }

  const { campSlug, seasonFrom, seasonTo, snapshotDate } = input;
  if (!campUsesReservations(campSlug)) {
    throw new Error("Reservation system not available for this camp");
  }
  if (!isIsoDate(seasonFrom) || !isIsoDate(seasonTo) || !isIsoDate(snapshotDate)) {
    throw new Error("Valid seasonFrom, seasonTo, and snapshotDate required (YYYY-MM-DD)");
  }
  if (seasonFrom > seasonTo) {
    throw new Error("seasonFrom must be on or before seasonTo");
  }

  const camp = getCampBySlug(campSlug);
  const siteRows = await sql`
    SELECT id, name, site_code
    FROM camp_sites
    WHERE camp_slug = ${campSlug}
    ORDER BY sort_order ASC, name ASC
  `;
  const bookable = ((Array.isArray(siteRows) ? siteRows : []) as SiteRow[]).filter(
    (s) => !isNonBookableSite(campSlug, s.name, s.site_code)
  );
  const bookableIds = bookable.map((s) => s.id);
  const seasonEndExclusive = addDays(seasonTo, 1);
  const asOf = toDateOnly(snapshotDate);

  let reservations: SeasonReservationMetricInput[] = [];
  if (bookableIds.length > 0) {
    const rows = await sql`
      SELECT
        r.id,
        r.site_id,
        r.check_in_date,
        r.check_out_date,
        r.created_at,
        r.cancelled_at,
        COALESCE((
          SELECT SUM(bp.amount_due_cents)::int
          FROM camp_billing_periods bp
          WHERE bp.reservation_id = r.id
            AND bp.status != 'cancelled'
        ), 0)::int AS billed_due_cents,
        COALESCE((
          SELECT SUM(bp.amount_paid_cents)::int
          FROM camp_billing_periods bp
          WHERE bp.reservation_id = r.id
            AND bp.status != 'cancelled'
        ), 0)::int AS period_paid_cents,
        COALESCE((
          SELECT SUM(
            CASE
              WHEN p.payment_type = 'refund' THEN -p.amount_cents
              ELSE p.amount_cents
            END
          )::int
          FROM camp_payments p
          WHERE p.reservation_id = r.id
            AND p.payment_type IN ('reservation', 'past_due', 'refund')
            AND p.created_at::date <= ${asOf}::date
        ), 0)::int AS payment_net_through_as_of,
        COALESCE((
          SELECT SUM(
            CASE
              WHEN p.payment_type = 'refund' THEN -p.amount_cents
              ELSE p.amount_cents
            END
          )::int
          FROM camp_payments p
          WHERE p.reservation_id = r.id
            AND p.payment_type IN ('reservation', 'past_due', 'refund')
        ), 0)::int AS payment_net_all_time
      FROM camp_reservations r
      WHERE r.camp_slug = ${campSlug}
        AND r.site_id = ANY(${bookableIds}::uuid[])
        AND r.check_in_date < ${seasonEndExclusive}::date
        AND r.check_out_date > ${seasonFrom}::date
        AND r.created_at::date <= ${asOf}::date
        AND (r.cancelled_at IS NULL OR r.cancelled_at::date > ${asOf}::date)
    `;

    reservations = ((Array.isArray(rows) ? rows : []) as ReservationAggRow[]).map((r) => ({
      id: r.id,
      siteId: r.site_id,
      checkIn: toDateOnlyStr(r.check_in_date),
      checkOut: toDateOnlyStr(r.check_out_date),
      createdAt: toDateOnlyStr(r.created_at),
      cancelledAt: r.cancelled_at ? toDateOnlyStr(r.cancelled_at) : null,
      billedDueCents: Number(r.billed_due_cents) || 0,
      periodPaidCents: Number(r.period_paid_cents) || 0,
      paymentNetCentsThroughAsOf: Number(r.payment_net_through_as_of) || 0,
      paymentNetCentsAllTime: Number(r.payment_net_all_time) || 0,
    }));
  }

  const metrics = computeSeasonTotalsMetrics({
    bookableSiteCount: bookable.length,
    seasonFrom,
    seasonTo,
    snapshotDate: asOf,
    reservations,
  });

  return {
    ...metrics,
    campName: camp?.name ?? campSlug,
    bookableSiteCount: bookable.length,
  };
}

/**
 * Reservations created in each calendar month and the occupied nights those
 * bookings contribute inside the selected season. Cancelled reservations are excluded.
 */
export async function listMonthlyBookingTotals(input: {
  campSlug: string;
  seasonFrom: string;
  seasonTo: string;
  bookingFrom: string;
  bookingTo: string;
}): Promise<MonthlyBookingTotal[]> {
  if (!hasDb() || !sql) {
    throw new Error("Database not available");
  }
  if (!campUsesReservations(input.campSlug)) {
    throw new Error("Reservation system not available for this camp");
  }
  if (!isIsoDate(input.seasonFrom) || !isIsoDate(input.seasonTo) || input.seasonFrom > input.seasonTo) {
    throw new Error("Valid seasonFrom and seasonTo required");
  }
  const months = enumerateMonthRange(input.bookingFrom, input.bookingTo);
  if (!isIsoMonth(input.bookingFrom) || !isIsoMonth(input.bookingTo) || months.length === 0) {
    throw new Error("Valid bookingFrom and bookingTo required (YYYY-MM)");
  }
  if (months.length > 24) {
    throw new Error("Booking month range cannot exceed 24 months");
  }

  const bookingStart = `${input.bookingFrom}-01`;
  const bookingEndExclusive =
    input.bookingTo.endsWith("-12")
      ? `${Number(input.bookingTo.slice(0, 4)) + 1}-01-01`
      : `${input.bookingTo.slice(0, 4)}-${String(Number(input.bookingTo.slice(5, 7)) + 1).padStart(2, "0")}-01`;
  const seasonEndExclusive = addDays(input.seasonTo, 1);

  const rows = await sql`
    SELECT
      TO_CHAR(r.created_at::date, 'YYYY-MM') AS booking_month,
      COUNT(*)::int AS reservation_count,
      COALESCE(SUM(
        LEAST(r.check_out_date, ${seasonEndExclusive}::date)
        - GREATEST(r.check_in_date, ${input.seasonFrom}::date)
      ), 0)::int AS site_nights_booked
    FROM camp_reservations r
    WHERE r.camp_slug = ${input.campSlug}
      AND r.status != 'cancelled'
      AND r.created_at::date >= ${bookingStart}::date
      AND r.created_at::date < ${bookingEndExclusive}::date
      AND r.check_in_date < ${seasonEndExclusive}::date
      AND r.check_out_date > ${input.seasonFrom}::date
    GROUP BY TO_CHAR(r.created_at::date, 'YYYY-MM')
    ORDER BY booking_month ASC
  `;

  const byMonth = new Map(
    ((Array.isArray(rows) ? rows : []) as MonthlyBookingDbRow[]).map((row) => [
      row.booking_month,
      {
        month: row.booking_month,
        reservationCount: Number(row.reservation_count) || 0,
        siteNightsBooked: Number(row.site_nights_booked) || 0,
      },
    ])
  );

  return months.map(
    (month) =>
      byMonth.get(month) ?? {
        month,
        reservationCount: 0,
        siteNightsBooked: 0,
      }
  );
}

/** Live occupancy totals for every calendar month in the selected season. */
export async function listSeasonMonthTotals(input: {
  campSlug: string;
  seasonFrom: string;
  seasonTo: string;
}): Promise<SeasonMonthTotal[]> {
  if (!hasDb() || !sql) {
    throw new Error("Database not available");
  }
  if (!campUsesReservations(input.campSlug)) {
    throw new Error("Reservation system not available for this camp");
  }
  const monthRanges = buildSeasonMonthRanges(input.seasonFrom, input.seasonTo);
  if (monthRanges.length === 0) {
    throw new Error("Valid seasonFrom and seasonTo required");
  }
  if (monthRanges.length > 24) {
    throw new Error("Season range cannot exceed 24 months");
  }

  const siteRows = await sql`
    SELECT id, name, site_code
    FROM camp_sites
    WHERE camp_slug = ${input.campSlug}
    ORDER BY sort_order ASC, name ASC
  `;
  const bookable = ((Array.isArray(siteRows) ? siteRows : []) as SiteRow[]).filter(
    (site) => !isNonBookableSite(input.campSlug, site.name, site.site_code)
  );
  const bookableIds = bookable.map((site) => site.id);
  const seasonEndExclusive = addDays(input.seasonTo, 1);

  let stays: SeasonStayDbRow[] = [];
  if (bookableIds.length > 0) {
    const rows = await sql`
      SELECT r.id, r.site_id, r.check_in_date, r.check_out_date
      FROM camp_reservations r
      WHERE r.camp_slug = ${input.campSlug}
        AND r.status != 'cancelled'
        AND r.site_id = ANY(${bookableIds}::uuid[])
        AND r.check_in_date < ${seasonEndExclusive}::date
        AND r.check_out_date > ${input.seasonFrom}::date
    `;
    stays = (Array.isArray(rows) ? rows : []) as SeasonStayDbRow[];
  }

  return monthRanges.map((range) => {
    const overlapping = stays.filter((stay) => {
      const checkIn = toDateOnlyStr(stay.check_in_date);
      const checkOut = toDateOnlyStr(stay.check_out_date);
      return checkIn < addDays(range.to, 1) && checkOut > range.from;
    });
    const siteNightsBooked = countDistinctBookedSiteNights(
      range.from,
      range.to,
      overlapping.map((stay) => ({
        siteId: stay.site_id,
        checkIn: toDateOnlyStr(stay.check_in_date),
        checkOut: toDateOnlyStr(stay.check_out_date),
      }))
    );
    const totalSiteNights = bookable.length * nightsInInclusiveRange(range.from, range.to);

    return {
      ...range,
      reservationCount: overlapping.length,
      siteNightsBooked,
      siteNightsAvailable: Math.max(0, totalSiteNights - siteNightsBooked),
      totalSiteNights,
    };
  });
}

export async function listSeasonTotalSnapshots(input: {
  campSlug: string;
  seasonFrom: string;
  seasonTo: string;
}): Promise<SeasonTotalsSnapshotRecord[]> {
  if (!hasDb() || !sql) {
    throw new Error("Database not available");
  }
  const rows = await sql`
    SELECT *
    FROM director_season_total_snapshots
    WHERE camp_slug = ${input.campSlug}
      AND season_from = ${input.seasonFrom}::date
      AND season_to = ${input.seasonTo}::date
    ORDER BY snapshot_date ASC
  `;
  return ((Array.isArray(rows) ? rows : []) as SnapshotDbRow[]).map(mapSnapshotRow);
}

/** Remove one snapshot date, or every snapshot for the camp/season when snapshotDate is null. */
export async function deleteSeasonTotalSnapshots(input: {
  campSlug: string;
  seasonFrom: string;
  seasonTo: string;
  snapshotDate: string | null;
}): Promise<number> {
  if (!hasDb() || !sql) {
    throw new Error("Database not available");
  }

  const rows = input.snapshotDate
    ? await sql`
        DELETE FROM director_season_total_snapshots
        WHERE camp_slug = ${input.campSlug}
          AND season_from = ${input.seasonFrom}::date
          AND season_to = ${input.seasonTo}::date
          AND snapshot_date = ${input.snapshotDate}::date
        RETURNING id
      `
    : await sql`
        DELETE FROM director_season_total_snapshots
        WHERE camp_slug = ${input.campSlug}
          AND season_from = ${input.seasonFrom}::date
          AND season_to = ${input.seasonTo}::date
        RETURNING id
      `;

  return Array.isArray(rows) ? rows.length : 0;
}

export async function upsertSeasonTotalSnapshot(input: {
  campSlug: string;
  seasonFrom: string;
  seasonTo: string;
  snapshotDate: string;
  metrics: SeasonTotalsMetrics;
  generatedByContactId: string | null;
}): Promise<SeasonTotalsSnapshotRecord> {
  if (!hasDb() || !sql) {
    throw new Error("Database not available");
  }

  const rows = await sql`
    INSERT INTO director_season_total_snapshots (
      camp_slug,
      season_from,
      season_to,
      snapshot_date,
      site_nights_booked,
      site_nights_available,
      total_site_nights,
      booked_percent,
      available_percent,
      revenue_collected_cents,
      revenue_owed_cents,
      total_reservations,
      generated_at,
      generated_by_contact_id
    ) VALUES (
      ${input.campSlug},
      ${input.seasonFrom}::date,
      ${input.seasonTo}::date,
      ${input.snapshotDate}::date,
      ${input.metrics.siteNightsBooked},
      ${input.metrics.siteNightsAvailable},
      ${input.metrics.totalSiteNights},
      ${input.metrics.bookedPercent},
      ${input.metrics.availablePercent},
      ${input.metrics.revenueCollectedCents},
      ${input.metrics.revenueOwedCents},
      ${input.metrics.totalReservations},
      NOW(),
      ${input.generatedByContactId}
    )
    ON CONFLICT (camp_slug, season_from, season_to, snapshot_date)
    DO UPDATE SET
      site_nights_booked = EXCLUDED.site_nights_booked,
      site_nights_available = EXCLUDED.site_nights_available,
      total_site_nights = EXCLUDED.total_site_nights,
      booked_percent = EXCLUDED.booked_percent,
      available_percent = EXCLUDED.available_percent,
      revenue_collected_cents = EXCLUDED.revenue_collected_cents,
      revenue_owed_cents = EXCLUDED.revenue_owed_cents,
      total_reservations = EXCLUDED.total_reservations,
      generated_at = NOW(),
      generated_by_contact_id = EXCLUDED.generated_by_contact_id
    RETURNING *
  `;

  const row = (Array.isArray(rows) ? rows[0] : null) as SnapshotDbRow | null;
  if (!row) {
    throw new Error("Failed to save season totals snapshot");
  }
  return mapSnapshotRow(row);
}
