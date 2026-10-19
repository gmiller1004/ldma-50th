import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  campUsesReservations,
  caretakerAllowsCashCheckIn,
  caretakerAllowsCashExistingReservationPayment,
  caretakerEarliestCheckInDate,
  caretakerEarliestCheckInDateForEdit,
  isHookupSiteType,
  isNonBookableSite,
  isOnlineBookableSite,
  parseCapacitySiteFilter,
  siteMatchesCapacityFilter,
} from "./reservation-camps.ts";

describe("campUsesReservations", () => {
  it("includes all master camps", () => {
    assert.equal(campUsesReservations("stanton-arizona"), true);
    assert.equal(campUsesReservations("burnt-river-oregon"), true);
    assert.equal(campUsesReservations("vein-mountain-north-carolina"), true);
    assert.equal(campUsesReservations("unknown-camp"), false);
  });
});

describe("caretakerAllowsCashCheckIn", () => {
  const today = "2026-05-19";

  it("allows today and past within 7 days", () => {
    assert.equal(caretakerAllowsCashCheckIn("2026-05-19", today), true);
    assert.equal(caretakerAllowsCashCheckIn("2026-05-12", today), true);
    assert.equal(caretakerAllowsCashCheckIn("2026-05-11", today), false);
  });

  it("allows future check-in", () => {
    assert.equal(caretakerAllowsCashCheckIn("2026-05-20", today), true);
    assert.equal(caretakerAllowsCashCheckIn("2026-12-01", today), true);
  });
});

describe("caretakerAllowsCashExistingReservationPayment", () => {
  it("always allows cash for balance collection on existing stays", () => {
    assert.equal(caretakerAllowsCashExistingReservationPayment(), true);
  });
});

describe("caretakerEarliestCheckInDate", () => {
  it("is 7 days before today", () => {
    assert.equal(caretakerEarliestCheckInDate("2026-05-19"), "2026-05-12");
  });
});

describe("caretakerEarliestCheckInDateForEdit", () => {
  it("keeps existing check-in when older than the backdate window", () => {
    assert.equal(
      caretakerEarliestCheckInDateForEdit("2026-06-24", "2026-07-13"),
      "2026-06-24"
    );
  });

  it("uses the normal backdate floor when existing check-in is within the window", () => {
    assert.equal(
      caretakerEarliestCheckInDateForEdit("2026-07-10", "2026-07-13"),
      "2026-07-06"
    );
  });
});

describe("isOnlineBookableSite", () => {
  it("hides Stanton 1 & 2 online but keeps them assignable by caretakers", () => {
    for (const code of ["1", "2"]) {
      const name = `${code} — Premium — 30 Amp - Full Hook-Up`;
      assert.equal(isOnlineBookableSite("stanton-arizona", name, code), false);
      assert.equal(isNonBookableSite("stanton-arizona", name, code), false);
    }
    assert.equal(isOnlineBookableSite("stanton-arizona", "3 — Premium — 30 Amp - Full Hook-Up", "3"), true);
    assert.equal(isOnlineBookableSite("oconee-south-carolina", "Site 1", "1"), true);
  });

  it("hides Vein Mountain LC-02 online but keeps it assignable by caretakers", () => {
    const name = "LC-02 — 30 Amp w/ Water";
    assert.equal(isOnlineBookableSite("vein-mountain-north-carolina", name, "LC-02"), false);
    assert.equal(isNonBookableSite("vein-mountain-north-carolina", name, "LC-02"), false);
    assert.equal(isOnlineBookableSite("vein-mountain-north-carolina", "UC-02 — 30 Amp w/ Water", "UC-02"), true);
  });

  it("never offers never-bookable sites online", () => {
    assert.equal(isOnlineBookableSite("vein-mountain-north-carolina", "Upper 1", "UC-01"), false);
  });
});

describe("capacity site filter", () => {
  it("parses hookup and dry filters", () => {
    assert.equal(parseCapacitySiteFilter("hookup"), "hookup");
    assert.equal(parseCapacitySiteFilter("dry"), "dry");
    assert.equal(parseCapacitySiteFilter("all"), "all");
    assert.equal(parseCapacitySiteFilter(null), "all");
    assert.equal(parseCapacitySiteFilter("invalid"), "all");
  });

  it("classifies hookup site types", () => {
    assert.equal(isHookupSiteType("30 Amp Full Hook-Up"), true);
    assert.equal(isHookupSiteType("50 Amp"), true);
    assert.equal(isHookupSiteType("Dry Camping"), false);
    assert.equal(isHookupSiteType("Dry"), false);
  });

  it("filters sites by hookup vs dry", () => {
    assert.equal(siteMatchesCapacityFilter("30 Amp", "all"), true);
    assert.equal(siteMatchesCapacityFilter("Dry", "all"), true);
    assert.equal(siteMatchesCapacityFilter("30 Amp", "hookup"), true);
    assert.equal(siteMatchesCapacityFilter("Dry", "hookup"), false);
    assert.equal(siteMatchesCapacityFilter("Dry Camping", "dry"), true);
    assert.equal(siteMatchesCapacityFilter("30 Amp", "dry"), false);
  });
});
