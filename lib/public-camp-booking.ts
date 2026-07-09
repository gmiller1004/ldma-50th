/**
 * Public (customer-facing) camp reservation booking by site type.
 */

import { formatSiteDisplayName } from "@/lib/camp-master";
import { isNonBookableSite } from "@/lib/reservation-camps";
import {
  computeStayPricing,
  generateBillingPeriods,
  MEMBER_DAILY_MAX_NIGHTS,
  type SiteRates,
} from "@/lib/reservation-pricing";
import { siteRatesFromRow } from "@/lib/reservation-billing";
import { validateStayWithinOpenSeason } from "@/lib/camp-seasons";
import { countNights } from "@/lib/reservation-dates";

export const PUBLIC_BOOKING_IMPORT_SOURCE = "public_web";
export const PUBLIC_BOOKING_DEPOSIT_CENTS = 10_000;
export const GUEST_MAX_CONSECUTIVE_NIGHTS = 10;
export const PUBLIC_BOOKING_CONFIRMATION_DELAY_MINUTES = 15;

export type CampSiteRow = {
  id: string;
  name: string;
  site_code: string | null;
  site_type: string;
  special_type: string | null;
  sort_order: number;
  member_rate_daily: number | string | null;
  member_rate_monthly: number | string | null;
  non_member_rate_daily: number | string | null;
};

export type ReservationStayRow = {
  site_id: string;
  check_in_date: string;
  check_out_date: string;
};

export function siteTypeGroupKey(specialType: string | null, siteType: string): string {
  return `${(specialType ?? "").trim()}|${siteType.trim()}`;
}

export function parseSiteTypeGroupKey(key: string): { specialType: string | null; siteType: string } {
  const [special, ...rest] = key.split("|");
  const siteType = rest.join("|").trim();
  return { specialType: special.trim() || null, siteType };
}

export function formatSiteTypeGroupLabel(specialType: string | null, siteType: string): string {
  if (specialType?.trim()) return `${specialType.trim()} — ${siteType.trim()}`;
  return siteType.trim();
}

export function siteMatchesTypeGroup(
  site: Pick<CampSiteRow, "site_type" | "special_type">,
  key: string
): boolean {
  const parsed = parseSiteTypeGroupKey(key);
  const special = (site.special_type ?? "").trim();
  const type = site.site_type.trim();
  return special === (parsed.specialType ?? "").trim() && type === parsed.siteType;
}

export function filterBookableSites(campSlug: string, sites: CampSiteRow[]): CampSiteRow[] {
  return sites.filter((s) => !isNonBookableSite(campSlug, s.name, s.site_code));
}

export function reservationOverlapsStay(
  res: ReservationStayRow,
  checkIn: string,
  checkOut: string
): boolean {
  const checkInStr = String(res.check_in_date).slice(0, 10);
  const checkOutStr = String(res.check_out_date).slice(0, 10);
  return checkInStr < checkOut && checkOutStr > checkIn;
}

export function isSiteAvailable(
  siteId: string,
  checkIn: string,
  checkOut: string,
  reservations: ReservationStayRow[]
): boolean {
  return !reservations.some((r) => r.site_id === siteId && reservationOverlapsStay(r, checkIn, checkOut));
}

export function pickNextAvailableSite(
  sites: CampSiteRow[],
  siteTypeKey: string,
  checkIn: string,
  checkOut: string,
  reservations: ReservationStayRow[]
): CampSiteRow | null {
  const matching = sites
    .filter((s) => siteMatchesTypeGroup(s, siteTypeKey))
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  for (const site of matching) {
    if (isSiteAvailable(site.id, checkIn, checkOut, reservations)) return site;
  }
  return null;
}

export type SiteTypeAvailability = {
  siteTypeKey: string;
  label: string;
  availableCount: number;
  totalCount: number;
  soldOut: boolean;
  memberRateDaily: number | null;
  memberRateMonthly: number | null;
  nonMemberRateDaily: number | null;
  memberTotalCents: number;
  guestTotalCents: number;
  usesMonthlyMemberRate: boolean;
  nights: number;
};

export function buildSiteTypeAvailability(input: {
  campSlug: string;
  checkIn: string;
  checkOut: string;
  sites: CampSiteRow[];
  reservations: ReservationStayRow[];
}): SiteTypeAvailability[] {
  const { campSlug, checkIn, checkOut, sites, reservations } = input;
  const bookable = filterBookableSites(campSlug, sites);
  const nights = countNights(checkIn, checkOut);
  if (nights < 1) return [];

  const groups = new Map<string, CampSiteRow[]>();
  for (const site of bookable) {
    const key = siteTypeGroupKey(site.special_type, site.site_type);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(site);
  }

  const out: SiteTypeAvailability[] = [];
  for (const [key, groupSites] of groups) {
    const representative = groupSites[0];
    const rates = siteRatesFromRow(representative);
    const parsed = parseSiteTypeGroupKey(key);
    const available = groupSites.filter((s) =>
      isSiteAvailable(s.id, checkIn, checkOut, reservations)
    );

    const memberPricing = computeStayPricing({
      checkInDate: checkIn,
      checkOutDate: checkOut,
      isMember: true,
      rates,
    });
    const guestPricing = computeStayPricing({
      checkInDate: checkIn,
      checkOutDate: checkOut,
      isMember: false,
      rates,
    });

    out.push({
      siteTypeKey: key,
      label: formatSiteTypeGroupLabel(parsed.specialType, parsed.siteType),
      availableCount: available.length,
      totalCount: groupSites.length,
      soldOut: available.length === 0,
      memberRateDaily: rates.memberRateDaily,
      memberRateMonthly: rates.memberRateMonthly,
      nonMemberRateDaily: rates.nonMemberRateDaily,
      memberTotalCents: memberPricing.totalCents,
      guestTotalCents: guestPricing.totalCents,
      usesMonthlyMemberRate: memberPricing.usesMonthlyMemberRate,
      nights,
    });
  }

  return out.sort((a, b) => a.label.localeCompare(b.label));
}

export type PaymentOption = {
  id: "full" | "deposit";
  label: string;
  amountCents: number;
  balanceNote: string | null;
};

export function computePublicPaymentOptions(input: {
  totalCents: number;
  firstPeriodCents: number;
  usesMonthlyMemberRate: boolean;
  isMember: boolean;
}): PaymentOption[] {
  const { totalCents, firstPeriodCents, usesMonthlyMemberRate, isMember } = input;
  const payInFullCents = usesMonthlyMemberRate ? firstPeriodCents : totalCents;
  const options: PaymentOption[] = [
    {
      id: "full",
      label: usesMonthlyMemberRate ? "Pay first month in full" : "Pay in full",
      amountCents: payInFullCents,
      balanceNote: usesMonthlyMemberRate
        ? null
        : isMember
          ? null
          : null,
    },
  ];

  if (payInFullCents > PUBLIC_BOOKING_DEPOSIT_CENTS) {
    const balanceNote = usesMonthlyMemberRate
      ? "Remainder of your first month will be due before arrival."
      : "Remaining balance will be due before arrival.";
    options.push({
      id: "deposit",
      label: "$100 deposit",
      amountCents: PUBLIC_BOOKING_DEPOSIT_CENTS,
      balanceNote,
    });
  }

  return options;
}

export function firstBillingPeriodCents(
  checkIn: string,
  checkOut: string,
  isMember: boolean,
  rates: SiteRates
): number {
  const periods = generateBillingPeriods({
    checkInDate: checkIn,
    checkOutDate: checkOut,
    isMember,
    rates,
  });
  return periods[0]?.amountDueCents ?? 0;
}

export function validatePublicBookingRequest(input: {
  campSlug: string;
  checkIn: string;
  checkOut: string;
  reservationType: "member" | "guest";
}): { ok: true; nights: number } | { ok: false; error: string } {
  const { campSlug, checkIn, checkOut, reservationType } = input;
  const nights = countNights(checkIn, checkOut);
  if (nights < 1) return { ok: false, error: "Check-out must be after check-in." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) {
    return { ok: false, error: "Invalid dates." };
  }
  if (checkIn >= checkOut) return { ok: false, error: "Check-out must be after check-in." };

  const season = validateStayWithinOpenSeason(campSlug, checkIn, checkOut);
  if (!season.ok) return season;

  if (reservationType === "guest" && nights > GUEST_MAX_CONSECUTIVE_NIGHTS) {
    return {
      ok: false,
      error: `Guest reservations are limited to ${GUEST_MAX_CONSECUTIVE_NIGHTS} consecutive nights. Members may book longer stays — log in to use member rates.`,
    };
  }

  return { ok: true, nights };
}

export function formatSiteAssignmentLabel(site: Pick<CampSiteRow, "site_code" | "name" | "site_type" | "special_type">): string {
  if (site.site_code) {
    return formatSiteDisplayName(site.site_code, site.site_type, site.special_type);
  }
  return site.name;
}

export function isLongStay(nights: number): boolean {
  return nights > MEMBER_DAILY_MAX_NIGHTS;
}
