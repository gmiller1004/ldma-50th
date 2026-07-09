/**
 * Parse and classify ResNexus future-reservation CSV exports.
 */

import { countNights } from "@/lib/reservation-dates";
import type { SiteRates } from "@/lib/reservation-pricing";

export type ResNexusCsvRow = {
  resNumber: string;
  date: string;
  guest: string;
  site: string;
  amount: string;
  paid: string;
  reservedOn: string;
};

export type ParsedPeriod = {
  periodStart: string;
  periodEnd: string;
  nights: number;
  amountDueCents: number;
  amountPaidCents: number;
  paidRaw: string | null;
  status: "unpaid" | "partial" | "paid" | "waived";
};

export type ParsedReservation = {
  resNumber: string;
  campSlug: string;
  guestName: string;
  guestFirstName: string;
  guestLastName: string;
  siteLabel: string;
  siteCode: string | null;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  periods: ParsedPeriod[];
  reservationType: "member" | "guest";
  needsReview: boolean;
  classificationReason: string;
  warnings: string[];
};

export function parseMoney(value: string | null | undefined): number | null {
  const t = (value ?? "").trim().replace(/[$,]/g, "");
  if (!t || t === "--") return null;
  const n = parseFloat(t);
  return Number.isNaN(n) ? null : Math.round(n * 100);
}

/** ResNexus end date is last night on site; store exclusive check-out as day after. */
export function parseResNexusDateRange(
  dateStr: string
): { checkIn: string; checkOut: string } | null {
  const s = dateStr.trim().replace(/"/g, "");

  const crossYear = /^(\d{1,2})\/(\d{1,2})\/(\d{4})-(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (crossYear) {
    const [, m1, d1, y1, m2, d2, y2] = crossYear;
    const checkIn = `${y1}-${pad(m1)}-${pad(d1)}`;
    const lastNight = `${y2}-${pad(m2)}-${pad(d2)}`;
    return { checkIn, checkOut: addOneDay(lastNight) };
  }

  const sameYear = /^(\d{1,2})\/(\d{1,2})-(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (sameYear) {
    const [, m1, d1, m2, d2, y] = sameYear;
    const checkIn = `${y}-${pad(m1)}-${pad(d1)}`;
    const lastNight = `${y}-${pad(m2)}-${pad(d2)}`;
    return { checkIn, checkOut: addOneDay(lastNight) };
  }

  return null;
}

function pad(n: string): string {
  return n.padStart(2, "0");
}

function addOneDay(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Normalize site label to master site_code (e.g. 016 → 16, D004 → D4). */
export function extractSiteCode(siteLabel: string): string | null {
  const s = siteLabel.trim();

  const dry = /^(D0*\d+)/i.exec(s);
  if (dry) {
    const num = parseInt(dry[1].slice(1).replace(/^0+/, "") || "0", 10);
    return `D${num}`;
  }

  const alpha = /^([A-Z]-\d+)/i.exec(s);
  if (alpha) return alpha[1].toUpperCase();

  const numPrefix = /^0*(\d+)\s/.exec(s);
  if (numPrefix) return String(parseInt(numPrefix[1], 10));

  return null;
}

export function parseGuestName(guest: string): { firstName: string; lastName: string; full: string } {
  const full = guest.trim().replace(/\s+/g, " ");
  const cleaned = full.replace(/\//g, " ").replace(/\s+/g, " ").trim();
  const parts = cleaned.split(" ").filter(Boolean);
  if (parts.length === 0) return { firstName: "Guest", lastName: "", full: "Guest" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "", full: cleaned };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
    full: cleaned,
  };
}

export function allocatePeriodPayments(
  periods: { amountDueCents: number; paidRaw: string | null }[]
): { amountPaidCents: number; status: ParsedPeriod["status"] }[] {
  let carryCents = 0;
  return periods.map((p) => {
    const rowPaid = parseMoney(p.paidRaw ?? null);
    let pool = carryCents + (rowPaid ?? 0);
    const due = p.amountDueCents;

    if (due === 0) {
      return { amountPaidCents: 0, status: "waived" as const };
    }

    const applied = Math.min(pool, due);
    pool -= applied;
    carryCents = pool;

    let status: ParsedPeriod["status"] = "unpaid";
    if (applied >= due) status = "paid";
    else if (applied > 0) status = "partial";

    return { amountPaidCents: applied, status };
  });
}

function expectedMemberCents(nights: number, rates: SiteRates): number {
  const monthly = rates.memberRateMonthly ?? 0;
  const daily = rates.memberRateDaily ?? 0;
  if (nights <= 29) return Math.round(nights * daily * 100);
  return Math.round(monthly * (nights / 30) * 100);
}

function expectedGuestCents(nights: number, rates: SiteRates): number {
  const daily = rates.nonMemberRateDaily ?? 0;
  return Math.round(nights * daily * 100);
}

function classifyByAmounts(input: {
  amountCents: number;
  nights: number;
  rates: SiteRates;
  toleranceCents: number;
  reviewThresholdCents: number;
  reasonPrefix: string;
}): { type: "member" | "guest"; needsReview: boolean; reason: string } | null {
  const { amountCents, nights, rates, toleranceCents, reviewThresholdCents, reasonPrefix } = input;
  if (nights < 1 || amountCents <= 0) return null;

  const memberExpected = expectedMemberCents(nights, rates);
  const guestExpected = expectedGuestCents(nights, rates);
  const memberDiff = Math.abs(amountCents - memberExpected);
  const guestDiff = Math.abs(amountCents - guestExpected);

  if (memberDiff <= guestDiff && memberDiff <= toleranceCents) {
    return {
      type: "member",
      needsReview: memberDiff > reviewThresholdCents,
      reason: `${reasonPrefix}_member`,
    };
  }
  if (guestDiff < memberDiff && guestDiff <= toleranceCents) {
    return {
      type: "guest",
      needsReview: guestDiff > reviewThresholdCents,
      reason: `${reasonPrefix}_guest`,
    };
  }

  const perNight = Math.round(amountCents / nights);
  const memberPerNight = Math.round((rates.memberRateDaily ?? 0) * 100);
  const guestPerNight = Math.round((rates.nonMemberRateDaily ?? 0) * 100);
  const memberNightDiff = Math.abs(perNight - memberPerNight);
  const guestNightDiff = Math.abs(perNight - guestPerNight);
  const nightTolerance = Math.max(500, Math.round(memberPerNight * 0.15));

  if (memberNightDiff <= guestNightDiff && memberNightDiff <= nightTolerance) {
    return {
      type: "member",
      needsReview: memberNightDiff > 100,
      reason: `${reasonPrefix}_per_night_member`,
    };
  }
  if (guestNightDiff < memberNightDiff && guestNightDiff <= nightTolerance) {
    return {
      type: "guest",
      needsReview: guestNightDiff > 100,
      reason: `${reasonPrefix}_per_night_guest`,
    };
  }

  return null;
}

export function classifyReservationType(
  periods: { amountDueCents: number; nights: number }[],
  rates: SiteRates
): { type: "member" | "guest"; needsReview: boolean; reason: string } {
  const totalDue = periods.reduce((s, p) => s + p.amountDueCents, 0);
  const totalNights = periods.reduce((s, p) => s + p.nights, 0);

  if (totalDue === 0) {
    return { type: "member", needsReview: false, reason: "comp_zero_amount" };
  }

  const first = periods[0];
  if (!first || first.nights < 1) {
    return { type: "guest", needsReview: true, reason: "missing_period" };
  }

  if (totalNights >= 30) {
    const fullStay = classifyByAmounts({
      amountCents: totalDue,
      nights: totalNights,
      rates,
      toleranceCents: 50_000,
      reviewThresholdCents: 10_000,
      reasonPrefix: "full_stay",
    });
    if (fullStay) return fullStay;
  }

  const firstPeriod = classifyByAmounts({
    amountCents: first.amountDueCents,
    nights: first.nights,
    rates,
    toleranceCents: 2_000,
    reviewThresholdCents: 500,
    reasonPrefix: "period",
  });
  if (firstPeriod) return firstPeriod;

  return { type: "guest", needsReview: true, reason: "amount_ambiguous" };
}

export function buildReservationFromRows(
  campSlug: string,
  resNumber: string,
  rows: ResNexusCsvRow[],
  rates: SiteRates
): ParsedReservation | null {
  const warnings: string[] = [];
  if (rows.length === 0) return null;

  const siteLabel = rows[0].site.trim();
  const siteCode = extractSiteCode(siteLabel);
  if (!siteCode) warnings.push(`unparsed_site:${siteLabel}`);

  const periodDrafts: ParsedPeriod[] = [];
  for (const row of rows) {
    const range = parseResNexusDateRange(row.date);
    if (!range) {
      warnings.push(`unparsed_date:${row.date}`);
      continue;
    }
    const nights = countNights(range.checkIn, range.checkOut);
    const amountDueCents = parseMoney(row.amount) ?? 0;
    periodDrafts.push({
      periodStart: range.checkIn,
      periodEnd: range.checkOut,
      nights,
      amountDueCents,
      amountPaidCents: 0,
      paidRaw: row.paid?.trim() || null,
      status: "unpaid",
    });
  }

  if (periodDrafts.length === 0) return null;

  const allocated = allocatePeriodPayments(
    periodDrafts.map((p) => ({ amountDueCents: p.amountDueCents, paidRaw: p.paidRaw }))
  );
  const periods = periodDrafts.map((p, i) => ({
    ...p,
    amountPaidCents: allocated[i].amountPaidCents,
    status: allocated[i].status,
  }));

  const checkInDate = periods[0].periodStart;
  const checkOutDate = periods[periods.length - 1].periodEnd;
  const nights = countNights(checkInDate, checkOutDate);

  const { firstName, lastName, full } = parseGuestName(rows[0].guest);
  const classification = classifyReservationType(periods, rates);

  return {
    resNumber,
    campSlug,
    guestName: full,
    guestFirstName: firstName,
    guestLastName: lastName,
    siteLabel,
    siteCode,
    checkInDate,
    checkOutDate,
    nights,
    periods,
    reservationType: classification.type,
    needsReview: classification.needsReview || warnings.length > 0,
    classificationReason: classification.reason,
    warnings,
  };
}

export function parseResNexusCsv(content: string): ResNexusCsvRow[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const rows: ResNexusCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = parseCsvLine(lines[i]);
    if (parts.length < 6) continue;
    rows.push({
      resNumber: parts[0]?.replace(/"/g, "").trim() ?? "",
      date: parts[1]?.replace(/"/g, "").trim() ?? "",
      guest: parts[2]?.replace(/"/g, "").trim() ?? "",
      site: parts[3]?.replace(/"/g, "").trim() ?? "",
      amount: parts[4]?.replace(/"/g, "").trim() ?? "",
      paid: parts[5]?.replace(/"/g, "").trim() ?? "",
      reservedOn: parts[11]?.replace(/"/g, "").trim() ?? "",
    });
  }
  return rows.filter((r) => r.resNumber);
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (c === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

export const RESNEXUS_IMPORT_FILES: { campSlug: string; filename: string }[] = [
  { campSlug: "stanton-arizona", filename: "stanton_stayed_on.csv" },
  { campSlug: "blue-bucket-oregon", filename: "Blue Bucket Future Reservations.csv" },
  { campSlug: "loud-mine-georgia", filename: "Loud Mine Future Reservations.csv" },
];
