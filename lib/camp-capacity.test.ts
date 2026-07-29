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
  buildSiteNightOccupancyCsv,
  buildSiteNightOccupancyGrid,
  buildSiteNightOccupancySpreadsheetXml,
  enumerateInclusiveDates,
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
    assert.equal(nightsInInclusiveRange("2026-07-01", "2026-07-31"), 31);
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

describe("buildSiteNightOccupancyGrid", () => {
  it("marks nights between check-in and exclusive check-out", () => {
    const dates = enumerateInclusiveDates("2026-07-01", "2026-07-05");
    const grid = buildSiteNightOccupancyGrid(
      [{ id: "a", name: "Site A" }, { id: "b", name: "Site B" }],
      dates,
      [{ siteId: "a", checkIn: "2026-07-02", checkOut: "2026-07-04" }]
    );
    assert.deepEqual(grid[0].booked, [false, true, true, false, false]);
    assert.deepEqual(grid[1].booked, [false, false, false, false, false]);
  });
});

describe("buildSiteNightOccupancySpreadsheetXml", () => {
  it("emits yellow booked cells with x", () => {
    const dates = ["2026-07-01", "2026-07-02"];
    const xml = buildSiteNightOccupancySpreadsheetXml({
      campName: "Stanton",
      from: "2026-07-01",
      to: "2026-07-02",
      dates,
      rows: [
        { siteId: "a", siteName: "32 — Hookup", booked: [true, false] },
      ],
    });
    assert.match(xml, /ss:Color="#FFFF00"/);
    assert.match(xml, /ss:StyleID="Booked"><Data ss:Type="String">x<\/Data>/);
    assert.match(xml, /32 — Hookup/);
  });
});

describe("buildSiteNightOccupancyCsv", () => {
  it("writes site rows and x markers", () => {
    const csv = buildSiteNightOccupancyCsv(
      ["2026-07-01", "2026-07-02"],
      [{ siteId: "a", siteName: "Site A", booked: [true, false] }]
    );
    assert.equal(csv, "Site,2026-07-01,2026-07-02\nSite A,x,\n");
  });
});
