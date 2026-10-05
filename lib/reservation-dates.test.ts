import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { countNights } from "./reservation-dates.ts";

describe("countNights", () => {
  it("does not add a night across the November DST change", () => {
    const tz = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
    try {
      assert.equal(countNights("2026-10-31", "2026-11-02"), 2);
      assert.equal(countNights("2026-10-04", "2026-11-03"), 30);
      assert.equal(countNights("2026-03-07", "2026-03-09"), 2);
    } finally {
      process.env.TZ = tz;
    }
  });
});
