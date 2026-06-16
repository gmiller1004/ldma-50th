import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  campUsesReservations,
  caretakerAllowsCashCheckIn,
  caretakerEarliestCheckInDate,
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

  it("disallows future check-in", () => {
    assert.equal(caretakerAllowsCashCheckIn("2026-05-20", today), false);
  });
});

describe("caretakerEarliestCheckInDate", () => {
  it("is 7 days before today", () => {
    assert.equal(caretakerEarliestCheckInDate("2026-05-19"), "2026-05-12");
  });
});
