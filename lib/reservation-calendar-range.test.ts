import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { format } from "date-fns";
import {
  isCompleteDateOnly,
  resolveCalendarRangeStart,
  todayDateOnlyLocal,
} from "./reservation-calendar-range.ts";

describe("isCompleteDateOnly", () => {
  it("accepts real YYYY-MM-DD days", () => {
    assert.equal(isCompleteDateOnly("2026-08-14"), true);
    assert.equal(isCompleteDateOnly("2026-02-28"), true);
  });

  it("rejects empty, partial, and impossible dates from native date inputs", () => {
    assert.equal(isCompleteDateOnly(""), false);
    assert.equal(isCompleteDateOnly("2026"), false);
    assert.equal(isCompleteDateOnly("2026-08"), false);
    assert.equal(isCompleteDateOnly("2026-08-"), false);
    assert.equal(isCompleteDateOnly("2026-02-31"), false);
    assert.equal(isCompleteDateOnly("not-a-date"), false);
  });
});

describe("resolveCalendarRangeStart", () => {
  it("parses a complete date as local midnight", () => {
    const start = resolveCalendarRangeStart("2026-08-14");
    assert.equal(format(start, "yyyy-MM-dd"), "2026-08-14");
    assert.equal(start.getHours(), 0);
  });

  it("falls back instead of producing an Invalid Date that format() would throw on", () => {
    const fallback = new Date(2026, 7, 1);
    for (const raw of ["", "2026-08", "2026-02-31"]) {
      const start = resolveCalendarRangeStart(raw, fallback);
      assert.equal(Number.isNaN(start.getTime()), false);
      assert.equal(format(start, "yyyy-MM-dd"), "2026-08-01");
    }
  });
});

describe("todayDateOnlyLocal", () => {
  it("uses local calendar date, not UTC", () => {
    const eveningPacific = new Date(2026, 7, 14, 20, 0, 0);
    assert.equal(todayDateOnlyLocal(eveningPacific), "2026-08-14");
  });
});
