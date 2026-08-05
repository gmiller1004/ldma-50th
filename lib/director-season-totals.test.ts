import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildSeasonMonthRanges,
  buildSeasonTotalsCsv,
  collectedCentsForReservation,
  computeSeasonTotalsMetrics,
  defaultSeasonForCamp,
  enumerateMonthRange,
  formatBookingMonthLabel,
  formatSnapshotColumnDate,
  getOpenSeasonRange,
  isIsoMonth,
  listSeasonOptions,
  owedCentsForReservation,
  reservationActiveAsOf,
  seasonTitle,
  stayOverlapsSeason,
} from "./director-season-totals.ts";

describe("monthly booking helpers", () => {
  it("validates and enumerates inclusive month ranges", () => {
    assert.equal(isIsoMonth("2026-07"), true);
    assert.equal(isIsoMonth("2026-13"), false);
    assert.deepEqual(enumerateMonthRange("2026-11", "2027-02"), [
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
    ]);
  });

  it("returns no months for reversed ranges", () => {
    assert.deepEqual(enumerateMonthRange("2026-08", "2026-07"), []);
  });

  it("formats month headings like the director spreadsheet", () => {
    assert.equal(formatBookingMonthLabel("2026-07"), "July-26");
    assert.equal(formatBookingMonthLabel("2026-08"), "August-26");
  });
});

describe("buildSeasonMonthRanges", () => {
  it("splits Stanton season into October through May", () => {
    const months = buildSeasonMonthRanges("2026-10-01", "2027-05-31");
    assert.equal(months.length, 8);
    assert.deepEqual(months[0], {
      month: "2026-10",
      label: "October",
      from: "2026-10-01",
      to: "2026-10-31",
    });
    assert.deepEqual(months[7], {
      month: "2027-05",
      label: "May",
      from: "2027-05-01",
      to: "2027-05-31",
    });
  });

  it("clips partial first and final months to the selected range", () => {
    assert.deepEqual(buildSeasonMonthRanges("2026-10-15", "2026-11-10"), [
      {
        month: "2026-10",
        label: "October",
        from: "2026-10-15",
        to: "2026-10-31",
      },
      {
        month: "2026-11",
        label: "November",
        from: "2026-11-01",
        to: "2026-11-10",
      },
    ]);
  });
});

describe("getOpenSeasonRange", () => {
  it("resolves Stanton Oct 1 – May 31 crossing year", () => {
    const range = getOpenSeasonRange("stanton-arizona", 2026);
    assert.deepEqual(
      { from: range?.from, to: range?.to, label: range?.label },
      {
        from: "2026-10-01",
        to: "2027-05-31",
        label: "October 1 – May 31",
      }
    );
  });

  it("resolves Burnt River Apr 1 – Oct 31 same year", () => {
    const range = getOpenSeasonRange("burnt-river-oregon", 2026);
    assert.equal(range?.from, "2026-04-01");
    assert.equal(range?.to, "2026-10-31");
  });

  it("returns null for camps without season rules", () => {
    assert.equal(getOpenSeasonRange("vein-mountain-north-carolina", 2026), null);
  });
});

describe("defaultSeasonForCamp", () => {
  it("picks upcoming Stanton season before October", () => {
    const range = defaultSeasonForCamp("stanton-arizona", "2026-08-05");
    assert.equal(range?.from, "2026-10-01");
    assert.equal(range?.to, "2027-05-31");
  });

  it("picks in-progress Stanton season in winter", () => {
    const range = defaultSeasonForCamp("stanton-arizona", "2027-01-15");
    assert.equal(range?.from, "2026-10-01");
    assert.equal(range?.to, "2027-05-31");
  });
});

describe("listSeasonOptions", () => {
  it("returns seasons newest first", () => {
    const options = listSeasonOptions("stanton-arizona", 2026, 1);
    assert.equal(options[0]?.from, "2027-10-01");
    assert.ok(options.some((o) => o.from === "2026-10-01"));
  });
});

describe("stayOverlapsSeason", () => {
  it("includes stays that touch the season window", () => {
    assert.equal(
      stayOverlapsSeason("2026-09-20", "2026-10-05", "2026-10-01", "2027-05-31"),
      true
    );
    assert.equal(
      stayOverlapsSeason("2026-06-01", "2026-06-15", "2026-10-01", "2027-05-31"),
      false
    );
  });
});

describe("reservationActiveAsOf", () => {
  it("includes reservations created on or before as-of", () => {
    assert.equal(reservationActiveAsOf("2026-07-01", null, "2026-07-29"), true);
    assert.equal(reservationActiveAsOf("2026-07-30", null, "2026-07-29"), false);
  });

  it("excludes reservations cancelled on or before as-of", () => {
    assert.equal(reservationActiveAsOf("2026-07-01", "2026-07-20", "2026-07-29"), false);
    assert.equal(reservationActiveAsOf("2026-07-01", "2026-07-30", "2026-07-29"), true);
  });
});

describe("collected and owed", () => {
  it("adds import credit beyond payment ledger", () => {
    const collected = collectedCentsForReservation({
      periodPaidCents: 51000,
      paymentNetCentsThroughAsOf: 0,
      paymentNetCentsAllTime: 0,
    });
    assert.equal(collected, 51000);
  });

  it("does not double-count payments already on the ledger", () => {
    const collected = collectedCentsForReservation({
      periodPaidCents: 51000,
      paymentNetCentsThroughAsOf: 45500,
      paymentNetCentsAllTime: 45500,
    });
    assert.equal(collected, 51000);
  });

  it("computes remaining owed from billed total", () => {
    assert.equal(
      owedCentsForReservation({ billedDueCents: 408000, collectedCents: 45500 }),
      362500
    );
  });
});

describe("computeSeasonTotalsMetrics", () => {
  const base = {
    id: "r1",
    siteId: "site-a",
    checkIn: "2026-10-01",
    checkOut: "2026-11-01",
    createdAt: "2026-07-01",
    cancelledAt: null,
    billedDueCents: 51000,
    periodPaidCents: 0,
    paymentNetCentsThroughAsOf: 10000,
    paymentNetCentsAllTime: 10000,
  };

  it("computes site nights, revenue, and reservation count", () => {
    const metrics = computeSeasonTotalsMetrics({
      bookableSiteCount: 2,
      seasonFrom: "2026-10-01",
      seasonTo: "2026-10-10",
      snapshotDate: "2026-07-29",
      reservations: [
        {
          ...base,
          checkIn: "2026-10-01",
          checkOut: "2026-10-06",
        },
      ],
    });
    // 2 sites × 10 nights = 20; stay books 5 nights
    assert.equal(metrics.totalSiteNights, 20);
    assert.equal(metrics.siteNightsBooked, 5);
    assert.equal(metrics.siteNightsAvailable, 15);
    assert.equal(metrics.bookedPercent, 25);
    assert.equal(metrics.availablePercent, 75);
    assert.equal(metrics.revenueCollectedCents, 10000);
    assert.equal(metrics.revenueOwedCents, 41000);
    assert.equal(metrics.totalReservations, 1);
  });

  it("caps overlapping stays on the same site to one night", () => {
    const metrics = computeSeasonTotalsMetrics({
      bookableSiteCount: 1,
      seasonFrom: "2026-10-01",
      seasonTo: "2026-10-10",
      snapshotDate: "2026-08-05",
      reservations: [
        { ...base, id: "a", checkIn: "2026-10-01", checkOut: "2026-10-06" },
        {
          ...base,
          id: "b",
          checkIn: "2026-10-03",
          checkOut: "2026-10-08",
          paymentNetCentsThroughAsOf: 0,
          paymentNetCentsAllTime: 0,
          billedDueCents: 0,
        },
      ],
    });
    // Distinct nights Oct 1–7 = 7 (checkout exclusive), range is 10 nights
    assert.equal(metrics.siteNightsBooked, 7);
    assert.equal(metrics.totalReservations, 2);
  });

  it("excludes future-created and already-cancelled stays from as-of snapshot", () => {
    const metrics = computeSeasonTotalsMetrics({
      bookableSiteCount: 10,
      seasonFrom: "2026-10-01",
      seasonTo: "2027-05-31",
      snapshotDate: "2026-07-29",
      reservations: [
        base,
        { ...base, id: "future", createdAt: "2026-08-01" },
        { ...base, id: "cancelled", cancelledAt: "2026-07-15" },
      ],
    });
    assert.equal(metrics.totalReservations, 1);
  });
});

describe("CSV and display helpers", () => {
  it("formats snapshot column dates", () => {
    assert.equal(formatSnapshotColumnDate("2026-07-29"), "07/29/26");
  });

  it("builds season title", () => {
    assert.equal(
      seasonTitle("Stanton", {
        from: "2026-10-01",
        to: "2027-05-31",
        label: "October 1 – May 31",
      }),
      "Stanton Season October 1 – May 31"
    );
  });

  it("exports CSV with header and sorted rows", () => {
    const csv = buildSeasonTotalsCsv([
      {
        campSlug: "stanton-arizona",
        campName: "Stanton",
        seasonFrom: "2026-10-01",
        seasonTo: "2027-05-31",
        snapshotDate: "2026-08-05",
        siteNightsBooked: 11372,
        siteNightsAvailable: 56298,
        totalSiteNights: 67670,
        bookedPercent: 16.8,
        availablePercent: 83.2,
        revenueCollectedCents: 701900,
        revenueOwedCents: 15019400,
        totalReservations: 88,
        generatedAt: "2026-08-05T20:00:00.000Z",
      },
      {
        campSlug: "stanton-arizona",
        campName: "Stanton",
        seasonFrom: "2026-10-01",
        seasonTo: "2027-05-31",
        snapshotDate: "2026-07-29",
        siteNightsBooked: 11208,
        siteNightsAvailable: 56462,
        totalSiteNights: 67670,
        bookedPercent: 16.5,
        availablePercent: 83.5,
        revenueCollectedCents: 679100,
        revenueOwedCents: 14659400,
        totalReservations: 83,
        generatedAt: "2026-07-29T20:00:00.000Z",
      },
    ]);
    const lines = csv.trim().split("\n");
    assert.equal(lines[0]?.startsWith("CAMP,"), true);
    assert.ok(lines[1]?.includes("2026-07-29"));
    assert.ok(lines[2]?.includes("2026-08-05"));
    assert.ok(lines[1]?.includes("6791.00"));
  });
});
