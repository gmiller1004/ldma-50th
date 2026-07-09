/**
 * Camp site capacity for a date range: booked vs available bookable sites.
 */

import { addDays, countNights } from "@/lib/reservation-dates";

export type CampCapacityStats = {
  totalSites: number;
  bookedSites: number;
  availableSites: number;
  bookedPercent: number;
  availablePercent: number;
};

export type SiteNightOccupancyStats = {
  rangeNights: number;
  totalSiteNights: number;
  bookedSiteNights: number;
  availableSiteNights: number;
  bookedPercent: number;
  availablePercent: number;
};

export type StayOverlapInput = {
  siteId: string;
  checkIn: string;
  checkOut: string;
};

/** Nights in an inclusive calendar range (from through to). */
export function nightsInInclusiveRange(from: string, to: string): number {
  return countNights(from, addDays(to, 1));
}

/** Nights a stay overlaps an inclusive range. Stay and range use checkout-exclusive end dates. */
export function overlapNights(
  stayCheckIn: string,
  stayCheckOut: string,
  rangeFrom: string,
  rangeTo: string
): number {
  const rangeEndExclusive = addDays(rangeTo, 1);
  const overlapStart = stayCheckIn > rangeFrom ? stayCheckIn : rangeFrom;
  const overlapEnd = stayCheckOut < rangeEndExclusive ? stayCheckOut : rangeEndExclusive;
  if (overlapEnd <= overlapStart) return 0;
  return countNights(overlapStart, overlapEnd);
}

/**
 * Site-night occupancy: booked site-nights ÷ (total sites × nights in range).
 * Partial-week stays contribute proportionally; per-site nights capped at range length.
 */
export function computeSiteNightOccupancy(
  totalSites: number,
  rangeFrom: string,
  rangeTo: string,
  stays: StayOverlapInput[]
): SiteNightOccupancyStats {
  const rangeNights = nightsInInclusiveRange(rangeFrom, rangeTo);
  const totalSiteNights = totalSites * rangeNights;

  if (totalSites <= 0 || rangeNights <= 0) {
    return {
      rangeNights,
      totalSiteNights: 0,
      bookedSiteNights: 0,
      availableSiteNights: 0,
      bookedPercent: 0,
      availablePercent: 0,
    };
  }

  const nightsBySite = new Map<string, number>();
  for (const stay of stays) {
    const nights = overlapNights(stay.checkIn, stay.checkOut, rangeFrom, rangeTo);
    if (nights <= 0) continue;
    const prev = nightsBySite.get(stay.siteId) ?? 0;
    nightsBySite.set(stay.siteId, Math.min(rangeNights, prev + nights));
  }

  let bookedSiteNights = 0;
  for (const nights of nightsBySite.values()) {
    bookedSiteNights += nights;
  }
  bookedSiteNights = Math.min(bookedSiteNights, totalSiteNights);
  const availableSiteNights = totalSiteNights - bookedSiteNights;
  const bookedPercent = Math.round((bookedSiteNights / totalSiteNights) * 1000) / 10;
  const availablePercent = Math.round((availableSiteNights / totalSiteNights) * 1000) / 10;

  return {
    rangeNights,
    totalSiteNights,
    bookedSiteNights,
    availableSiteNights,
    bookedPercent,
    availablePercent,
  };
}

/** Parse YYYY-MM into inclusive from/to date strings for that calendar month. */
export function monthDateRange(monthValue: string): { from: string; to: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(monthValue.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  const mm = String(month).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  return {
    from: `${year}-${mm}-01`,
    to: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function currentMonthValue(today = new Date()): string {
  return today.toLocaleDateString("en-CA").slice(0, 7);
}

export function computeCapacityStats(bookedSites: number, totalSites: number): CampCapacityStats {
  const booked = Math.max(0, Math.min(bookedSites, totalSites));
  const total = Math.max(0, totalSites);
  if (total === 0) {
    return {
      totalSites: 0,
      bookedSites: 0,
      availableSites: 0,
      bookedPercent: 0,
      availablePercent: 0,
    };
  }
  const availableSites = total - booked;
  const bookedPercent = Math.round((booked / total) * 1000) / 10;
  const availablePercent = Math.round((availableSites / total) * 1000) / 10;
  return {
    totalSites: total,
    bookedSites: booked,
    availableSites,
    bookedPercent,
    availablePercent,
  };
}

export function isValidDateRange(from: string, to: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from <= to;
}
