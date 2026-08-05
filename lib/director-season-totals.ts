/**
 * Director Season Totals — pure metric helpers and CSV for weekly snapshots.
 */

import {
  isValidDateRange,
  nightsInInclusiveRange,
} from "@/lib/camp-capacity";
import { CAMP_SEASON_RULES } from "@/lib/camp-seasons";
import { addDays, countNights } from "@/lib/reservation-dates";

export const SEASON_TOTALS_CSV_HEADERS = [
  "CAMP",
  "SEASON FROM",
  "SEASON TO",
  "AS OF",
  "SITE NIGHTS BOOKED",
  "SITE NIGHTS BOOKED %",
  "SITE NIGHTS AVAILABLE",
  "SITE NIGHTS AVAILABLE %",
  "TOTAL SITE NIGHTS",
  "REVENUE COLLECTED",
  "REVENUE OWED",
  "TOTAL RESERVATIONS",
  "GENERATED AT",
] as const;

export const MONTHLY_BOOKINGS_CSV_HEADERS = [
  "CAMP",
  "BOOKING MONTH",
  "RESERVATIONS - NEW",
  "SITE NIGHTS BOOKED",
] as const;

export const SEASON_MONTHS_CSV_HEADERS = [
  "CAMP",
  "MONTH",
  "MONTH FROM",
  "MONTH TO",
  "RESERVATIONS",
  "SITE NIGHTS BOOKED",
  "SITE NIGHTS AVAILABLE",
  "TOTAL SITE NIGHTS",
] as const;

export type SeasonRange = {
  from: string;
  to: string;
  /** Label like "October 1 – May 31" or the ISO range. */
  label: string;
  openYear: number;
};

export type SeasonReservationMetricInput = {
  id: string;
  siteId: string;
  checkIn: string;
  checkOut: string;
  /** YYYY-MM-DD or ISO timestamp — compared as date prefix. */
  createdAt: string;
  cancelledAt: string | null;
  /** Sum of amount_due_cents on non-cancelled periods. */
  billedDueCents: number;
  /** Sum of amount_paid_cents on non-cancelled periods (includes import credits). */
  periodPaidCents: number;
  /** Net camp_payments (charges − refunds) with created_at::date <= asOf. */
  paymentNetCentsThroughAsOf: number;
  /** Net camp_payments across all time for this reservation. */
  paymentNetCentsAllTime: number;
};

export type SeasonTotalsMetrics = {
  siteNightsBooked: number;
  siteNightsAvailable: number;
  totalSiteNights: number;
  bookedPercent: number;
  availablePercent: number;
  revenueCollectedCents: number;
  revenueOwedCents: number;
  totalReservations: number;
};

export type SeasonTotalsSnapshotRow = SeasonTotalsMetrics & {
  campSlug: string;
  campName: string;
  seasonFrom: string;
  seasonTo: string;
  snapshotDate: string;
  generatedAt: string;
};

export type MonthlyBookingTotal = {
  month: string;
  reservationCount: number;
  siteNightsBooked: number;
};

export type SeasonMonthRange = {
  month: string;
  label: string;
  from: string;
  to: string;
};

export type SeasonMonthTotal = SeasonMonthRange & {
  reservationCount: number;
  siteNightsBooked: number;
  siteNightsAvailable: number;
  totalSiteNights: number;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function monthLong(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleString("en-US", { month: "long" });
}

export function toDateOnly(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}

export function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function isIsoMonth(s: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

export function enumerateMonthRange(from: string, to: string): string[] {
  if (!isIsoMonth(from) || !isIsoMonth(to) || from > to) return [];

  const months: string[] = [];
  let year = Number(from.slice(0, 4));
  let month = Number(from.slice(5, 7));
  const endYear = Number(to.slice(0, 4));
  const endMonth = Number(to.slice(5, 7));

  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${pad2(month)}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

export function formatBookingMonthLabel(isoMonth: string): string {
  if (!isIsoMonth(isoMonth)) return isoMonth;
  const year = Number(isoMonth.slice(0, 4));
  const month = Number(isoMonth.slice(5, 7));
  const name = new Date(year, month - 1, 1).toLocaleString("en-US", { month: "long" });
  return `${name}-${String(year).slice(-2)}`;
}

export function buildSeasonMonthRanges(seasonFrom: string, seasonTo: string): SeasonMonthRange[] {
  if (!isValidDateRange(seasonFrom, seasonTo)) return [];
  const months = enumerateMonthRange(seasonFrom.slice(0, 7), seasonTo.slice(0, 7));

  return months.map((month) => {
    const year = Number(month.slice(0, 4));
    const monthNumber = Number(month.slice(5, 7));
    const monthFrom = `${month}-01`;
    const monthTo = `${month}-${pad2(lastDayOfMonth(year, monthNumber))}`;
    return {
      month,
      label: monthLong(monthNumber),
      from: monthFrom < seasonFrom ? seasonFrom : monthFrom,
      to: monthTo > seasonTo ? seasonTo : monthTo,
    };
  });
}

/** Open-season inclusive range for camps with CAMP_SEASON_RULES. */
export function getOpenSeasonRange(campSlug: string, openYear: number): SeasonRange | null {
  const rule = CAMP_SEASON_RULES[campSlug];
  if (!rule || !Number.isInteger(openYear) || openYear < 2000 || openYear > 2100) {
    return null;
  }

  const from = `${openYear}-${pad2(rule.openMonth)}-${pad2(rule.openDay)}`;

  // Season ends the day before closed start. Closed Jun 1 → open ends May 31.
  const crossesYear = rule.openMonth > rule.closedMonth;
  const toYear = crossesYear ? openYear + 1 : openYear;
  const openEndMonth = rule.closedMonth === 1 ? 12 : rule.closedMonth - 1;
  const openEndYear = rule.closedMonth === 1 ? toYear - 1 : toYear;
  const openEndDay =
    rule.closedDay === 1
      ? lastDayOfMonth(openEndYear, openEndMonth)
      : rule.closedDay - 1;
  const to = `${openEndYear}-${pad2(openEndMonth)}-${pad2(openEndDay)}`;

  if (!isValidDateRange(from, to)) return null;

  return {
    from,
    to,
    openYear,
    label: `${monthLong(rule.openMonth)} ${rule.openDay} – ${monthLong(openEndMonth)} ${openEndDay}`,
  };
}

/**
 * Default season for a camp relative to a reference date (usually today).
 * If currently inside an open window, use that season; otherwise use the next upcoming open.
 */
export function defaultSeasonForCamp(campSlug: string, referenceDate: string): SeasonRange | null {
  const ref = toDateOnly(referenceDate);
  if (!isIsoDate(ref)) return null;
  const year = Number(ref.slice(0, 4));

  for (const openYear of [year - 1, year, year + 1]) {
    const range = getOpenSeasonRange(campSlug, openYear);
    if (!range) continue;
    if (ref >= range.from && ref <= range.to) return range;
  }

  // Upcoming: earliest season that starts on/after ref, else latest that ended before ref.
  const candidates = [year - 1, year, year + 1]
    .map((y) => getOpenSeasonRange(campSlug, y))
    .filter((r): r is SeasonRange => r != null)
    .sort((a, b) => a.from.localeCompare(b.from));

  const upcoming = candidates.find((r) => r.from >= ref);
  if (upcoming) return upcoming;
  return candidates[candidates.length - 1] ?? null;
}

/** Season options around a reference year for the UI selector. */
export function listSeasonOptions(campSlug: string, aroundYear: number, span = 2): SeasonRange[] {
  const years: number[] = [];
  for (let y = aroundYear - span; y <= aroundYear + span; y++) years.push(y);
  return years
    .map((y) => getOpenSeasonRange(campSlug, y))
    .filter((r): r is SeasonRange => r != null)
    .sort((a, b) => b.from.localeCompare(a.from));
}

export function stayOverlapsSeason(
  checkIn: string,
  checkOut: string,
  seasonFrom: string,
  seasonTo: string
): boolean {
  const seasonEndExclusive = addDays(seasonTo, 1);
  return checkIn < seasonEndExclusive && checkOut > seasonFrom;
}

/**
 * Reservation existed as of snapshotDate:
 * created on/before as-of, and not cancelled until after as-of.
 */
export function reservationActiveAsOf(
  createdAt: string,
  cancelledAt: string | null,
  snapshotDate: string
): boolean {
  const asOf = toDateOnly(snapshotDate);
  const created = toDateOnly(createdAt);
  if (created > asOf) return false;
  if (!cancelledAt) return true;
  const cancelled = toDateOnly(cancelledAt);
  return cancelled > asOf;
}

export function collectedCentsForReservation(input: {
  periodPaidCents: number;
  paymentNetCentsThroughAsOf: number;
  paymentNetCentsAllTime: number;
}): number {
  const importCredit = Math.max(0, input.periodPaidCents - Math.max(0, input.paymentNetCentsAllTime));
  return Math.max(0, input.paymentNetCentsThroughAsOf) + importCredit;
}

export function owedCentsForReservation(input: {
  billedDueCents: number;
  collectedCents: number;
}): number {
  return Math.max(0, input.billedDueCents - input.collectedCents);
}

/** Distinct occupied nights per site within an inclusive season range (checkout exclusive). */
export function countDistinctBookedSiteNights(
  seasonFrom: string,
  seasonTo: string,
  stays: { siteId: string; checkIn: string; checkOut: string }[]
): number {
  const seasonEndExclusive = addDays(seasonTo, 1);
  const nightsBySite = new Map<string, Set<string>>();

  for (const stay of stays) {
    const overlapStart = stay.checkIn > seasonFrom ? stay.checkIn : seasonFrom;
    const overlapEnd =
      stay.checkOut < seasonEndExclusive ? stay.checkOut : seasonEndExclusive;
    if (overlapEnd <= overlapStart) continue;

    let set = nightsBySite.get(stay.siteId);
    if (!set) {
      set = new Set();
      nightsBySite.set(stay.siteId, set);
    }

    let d = overlapStart;
    const total = countNights(overlapStart, overlapEnd);
    for (let i = 0; i < total; i++) {
      set.add(d);
      d = addDays(d, 1);
    }
  }

  let booked = 0;
  for (const set of nightsBySite.values()) {
    booked += set.size;
  }
  return booked;
}

export function computeSeasonTotalsMetrics(input: {
  bookableSiteCount: number;
  seasonFrom: string;
  seasonTo: string;
  snapshotDate: string;
  reservations: SeasonReservationMetricInput[];
}): SeasonTotalsMetrics {
  const { bookableSiteCount, seasonFrom, seasonTo, snapshotDate, reservations } = input;

  const included = reservations.filter(
    (r) =>
      stayOverlapsSeason(r.checkIn, r.checkOut, seasonFrom, seasonTo) &&
      reservationActiveAsOf(r.createdAt, r.cancelledAt, snapshotDate)
  );

  const rangeNights = nightsInInclusiveRange(seasonFrom, seasonTo);
  const totalSiteNights = Math.max(0, bookableSiteCount) * Math.max(0, rangeNights);
  const siteNightsBooked = Math.min(
    totalSiteNights,
    countDistinctBookedSiteNights(
      seasonFrom,
      seasonTo,
      included.map((r) => ({
        siteId: r.siteId,
        checkIn: r.checkIn,
        checkOut: r.checkOut,
      }))
    )
  );
  const siteNightsAvailable = Math.max(0, totalSiteNights - siteNightsBooked);
  const bookedPercent =
    totalSiteNights > 0
      ? Math.round((siteNightsBooked / totalSiteNights) * 1000) / 10
      : 0;
  const availablePercent =
    totalSiteNights > 0
      ? Math.round((siteNightsAvailable / totalSiteNights) * 1000) / 10
      : 0;

  let revenueCollectedCents = 0;
  let revenueOwedCents = 0;
  for (const r of included) {
    const collected = collectedCentsForReservation(r);
    revenueCollectedCents += collected;
    revenueOwedCents += owedCentsForReservation({
      billedDueCents: Math.max(0, r.billedDueCents),
      collectedCents: collected,
    });
  }

  return {
    siteNightsBooked,
    siteNightsAvailable,
    totalSiteNights,
    bookedPercent,
    availablePercent,
    revenueCollectedCents,
    revenueOwedCents,
    totalReservations: included.length,
  };
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatMoneyCsv(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function buildSeasonTotalsCsv(
  rows: SeasonTotalsSnapshotRow[],
  options?: { includeHeader?: boolean }
): string {
  const includeHeader = options?.includeHeader !== false;
  const sorted = [...rows].sort((a, b) => {
    const camp = a.campSlug.localeCompare(b.campSlug);
    if (camp !== 0) return camp;
    const season = a.seasonFrom.localeCompare(b.seasonFrom);
    if (season !== 0) return season;
    return a.snapshotDate.localeCompare(b.snapshotDate);
  });

  const lines: string[] = [];
  if (includeHeader) {
    lines.push(SEASON_TOTALS_CSV_HEADERS.join(","));
  }
  for (const row of sorted) {
    lines.push(
      [
        escapeCsvCell(row.campName),
        row.seasonFrom,
        row.seasonTo,
        row.snapshotDate,
        String(row.siteNightsBooked),
        String(row.bookedPercent),
        String(row.siteNightsAvailable),
        String(row.availablePercent),
        String(row.totalSiteNights),
        formatMoneyCsv(row.revenueCollectedCents),
        formatMoneyCsv(row.revenueOwedCents),
        String(row.totalReservations),
        escapeCsvCell(row.generatedAt),
      ].join(",")
    );
  }
  return lines.join("\n") + (lines.length ? "\n" : "");
}

export function buildMonthlyBookingsCsvRows(input: {
  campName: string;
  totals: MonthlyBookingTotal[];
}): string[] {
  return input.totals.map((total) =>
    [
      escapeCsvCell(input.campName),
      total.month,
      String(total.reservationCount),
      String(total.siteNightsBooked),
    ].join(",")
  );
}

export function buildSeasonMonthsCsvRows(input: {
  campName: string;
  totals: SeasonMonthTotal[];
}): string[] {
  return input.totals.map((total) =>
    [
      escapeCsvCell(input.campName),
      escapeCsvCell(total.label),
      total.from,
      total.to,
      String(total.reservationCount),
      String(total.siteNightsBooked),
      String(total.siteNightsAvailable),
      String(total.totalSiteNights),
    ].join(",")
  );
}

/** Full director report: all three reporting sections in one CSV. */
export function buildDirectorReportCsv(input: {
  campName: string;
  seasonFrom: string;
  seasonTo: string;
  seasonLabel: string;
  snapshots: SeasonTotalsSnapshotRow[];
  monthlyBookings: MonthlyBookingTotal[];
  seasonMonths: SeasonMonthTotal[];
}): string {
  const lines: string[] = [];

  lines.push(`${escapeCsvCell(`${input.campName} Season ${input.seasonLabel}`)}`);
  lines.push(`Season range,${input.seasonFrom},${input.seasonTo}`);
  lines.push("");

  lines.push("1. SEASON TOTALS");
  lines.push(SEASON_TOTALS_CSV_HEADERS.join(","));
  const seasonTotalsCsv = buildSeasonTotalsCsv(input.snapshots, { includeHeader: false });
  if (seasonTotalsCsv.trim().length > 0) {
    lines.push(seasonTotalsCsv.trimEnd());
  }
  lines.push("");

  lines.push("2. CURRENT MONTH BOOKINGS");
  lines.push(MONTHLY_BOOKINGS_CSV_HEADERS.join(","));
  lines.push(
    ...buildMonthlyBookingsCsvRows({
      campName: input.campName,
      totals: input.monthlyBookings,
    })
  );
  lines.push("");

  lines.push("3. SEASON BY MONTH");
  lines.push(SEASON_MONTHS_CSV_HEADERS.join(","));
  lines.push(
    ...buildSeasonMonthsCsvRows({
      campName: input.campName,
      totals: input.seasonMonths,
    })
  );

  return lines.join("\n") + "\n";
}

export function seasonTitle(campName: string, season: Pick<SeasonRange, "from" | "to" | "label">): string {
  return `${campName} Season ${season.label}`;
}

/** Format MM/DD/YY for trend column headers. */
export function formatSnapshotColumnDate(isoDate: string): string {
  const [y, m, d] = toDateOnly(isoDate).split("-").map(Number);
  const yy = String(y).slice(-2);
  return `${pad2(m)}/${pad2(d)}/${yy}`;
}
