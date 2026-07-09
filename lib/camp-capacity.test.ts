import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeCapacityStats,
  computeSiteNightOccupancy,
  currentMonthValue,
  isValidDateRange,
  monthDateRange,
  nightsInInclusiveRange,
  overlapNights,
} from "./camp-capacity.ts";

describe("monthDateRange", () => {
  it("returns first and last day of month", () => {
    assert.deepEqual(monthDateRange("2026-07"), { from: "2026-07-01", to: "2026-07-31" });
    assert.deepEqual(monthDateRange("2026-02"), { from: "2026-02-01", to: "2026-02-28" });
  });

  it("rejects invalid values", () => {
    assert.equal(monthDateRange("2026-13"), null);
    assert.equal(monthDateRange("bad"), null);
  });
});

describe("computeCapacityStats", () => {
  it("computes booked and available percentages", () => {
    const s = computeCapacityStats(12, 40);
    assert.equal(s.bookedSites, 12);
    assert.equal(s.availableSites, 28);
    assert.equal(s.bookedPercent, 30);
    assert.equal(s.availablePercent, 70);
  });

  it("handles empty inventory", () => {
    const s = computeCapacityStats(0, 0);
    assert.equal(s.bookedPercent, 0);
    assert.equal(s.availablePercent, 0);
  });
});

describe("isValidDateRange", () => {
  it("validates ordered dates", () => {
    assert.equal(isValidDateRange("2026-07-01", "2026-07-31"), true);
    assert.equal(isValidDateRange("2026-07-31", "2026-07-01"), false);
  });
});

describe("currentMonthValue", () => {
  it("formats YYYY-MM", () => {
    assert.equal(currentMonthValue(new Date("2026-03-15T12:00:00")), "2026-03");
  });
});

describe("overlapNights", () => {
  it("counts partial stay within a month", () => {
    assert.equal(overlapNights("2026-07-10", "2026-07-17", "2026-07-01", "2026-07-31"), 7);
  });

  it("returns zero when stay is outside range", () => {
    assert.equal(overlapNights("2026-08-01", "2026-08-08", "2026-07-01", "2026-07-31"), 0);
  });
});

describe("computeSiteNightOccupancy", () => {
  it("treats a one-week stay as fractional occupancy in a month", () => {
    const stats = computeSiteNightOccupancy(40, "2026-07-01", "2026-07-31", [
      { siteId: "site-a", checkIn: "2026-07-10", checkOut: "2026-07-17" },
    ]);
    assert.equal(stats.rangeNights, 31);
    assert.equal(stats.totalSiteNights, 40 * 31);
    assert.equal(stats.bookedSiteNights, 7);
    assert.equal(stats.bookedPercent, 0.6);
  });

  it("still counts site as fully booked in binary site model separately", () => {
    const siteStats = computeCapacityStats(1, 40);
    assert.equal(siteStats.bookedPercent, 2.5);
    const nightStats = computeSiteNightOccupancy(40, "2026-07-01", "2026-07-31", [
      { siteId: "site-a", checkIn: "2026-07-10", checkOut: "2026-07-17" },
    ]);
    assert.ok(nightStats.bookedPercent < siteStats.bookedPercent || nightStats.bookedPercent < 5);
  });
});
