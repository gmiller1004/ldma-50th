import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  campOpenSeasonSummary,
  isDateInCampClosedSeason,
  validateStayWithinOpenSeason,
} from "./camp-seasons.ts";

describe("isDateInCampClosedSeason", () => {
  it("Stanton is closed Jun 1 – Sep 30", () => {
    assert.equal(isDateInCampClosedSeason("stanton-arizona", "2026-06-01"), true);
    assert.equal(isDateInCampClosedSeason("stanton-arizona", "2026-08-15"), true);
    assert.equal(isDateInCampClosedSeason("stanton-arizona", "2026-09-30"), true);
    assert.equal(isDateInCampClosedSeason("stanton-arizona", "2026-10-01"), false);
    assert.equal(isDateInCampClosedSeason("stanton-arizona", "2026-05-31"), false);
  });

  it("Burnt River is closed Nov 1 – Mar 31", () => {
    assert.equal(isDateInCampClosedSeason("burnt-river-oregon", "2026-11-15"), true);
    assert.equal(isDateInCampClosedSeason("burnt-river-oregon", "2027-01-10"), true);
    assert.equal(isDateInCampClosedSeason("burnt-river-oregon", "2027-03-31"), true);
    assert.equal(isDateInCampClosedSeason("burnt-river-oregon", "2027-04-01"), false);
    assert.equal(isDateInCampClosedSeason("burnt-river-oregon", "2026-10-31"), false);
  });

  it("Italian Bar is closed Dec 1 – last day of February", () => {
    assert.equal(isDateInCampClosedSeason("italian-bar-california", "2026-12-01"), true);
    assert.equal(isDateInCampClosedSeason("italian-bar-california", "2027-01-15"), true);
    assert.equal(isDateInCampClosedSeason("italian-bar-california", "2027-02-28"), true);
    assert.equal(isDateInCampClosedSeason("italian-bar-california", "2027-03-01"), false);
    assert.equal(isDateInCampClosedSeason("italian-bar-california", "2026-11-30"), false);
  });

  it("year-round camps have no closed season", () => {
    assert.equal(isDateInCampClosedSeason("oconee-south-carolina", "2026-07-04"), false);
  });
});

describe("campOpenSeasonSummary", () => {
  it("describes Stanton open and closed windows", () => {
    const summary = campOpenSeasonSummary("stanton-arizona");
    assert.match(summary ?? "", /Open October 1 – May 31/);
    assert.match(summary ?? "", /Closed June 1 – September 30/);
  });
});

describe("validateStayWithinOpenSeason", () => {
  it("rejects stays overlapping closed nights with open season details", () => {
    const result = validateStayWithinOpenSeason("stanton-arizona", "2026-09-28", "2026-10-03");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /closed/i);
      assert.match(result.error, /Open October 1/i);
      assert.match(result.error, /Closed June 1/i);
    }
  });

  it("allows fully open stays", () => {
    assert.deepEqual(
      validateStayWithinOpenSeason("stanton-arizona", "2026-10-05", "2026-10-10"),
      { ok: true }
    );
  });
});
