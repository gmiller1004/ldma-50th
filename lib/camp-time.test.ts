import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { campTimeZone, campTodayStr } from "./camp-time.ts";

describe("campTimeZone", () => {
  it("maps camps to their local zone", () => {
    assert.equal(campTimeZone("stanton-arizona"), "America/Phoenix");
    assert.equal(campTimeZone("italian-bar-california"), "America/Los_Angeles");
    assert.equal(campTimeZone("blue-bucket-oregon"), "America/Los_Angeles");
    assert.equal(campTimeZone("loud-mine-georgia"), "America/New_York");
    assert.equal(campTimeZone("vein-mountain-north-carolina"), "America/New_York");
    assert.equal(campTimeZone("oconee-south-carolina"), "America/New_York");
    assert.equal(campTimeZone(undefined), "America/Los_Angeles");
  });
});

describe("campTodayStr", () => {
  // 2026-10-05 6:30 pm Pacific = 2026-10-06 01:30 UTC
  const evening = new Date("2026-10-06T01:30:00Z");

  it("keeps the camp's calendar date in the evening", () => {
    assert.equal(campTodayStr("stanton-arizona", evening), "2026-10-05");
    assert.equal(campTodayStr("italian-bar-california", evening), "2026-10-05");
  });

  it("eastern camps roll over at their own midnight", () => {
    assert.equal(campTodayStr("loud-mine-georgia", evening), "2026-10-05");
    assert.equal(campTodayStr("loud-mine-georgia", new Date("2026-10-06T04:30:00Z")), "2026-10-06");
  });
});
