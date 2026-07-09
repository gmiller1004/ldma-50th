import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildReservationFromRows,
  classifyReservationType,
  parseResNexusCsv,
} from "./resnexus-import.ts";
import { computeStayPricing } from "./reservation-pricing.ts";

const STANTON_RATES = {
  memberRateDaily: 19,
  memberRateMonthly: 453.75,
  nonMemberRateDaily: 45.5625,
};

describe("classifyReservationType", () => {
  it("classifies long Stanton stays as member when ResNexus total is near LDMA monthly", () => {
    const csv = readFileSync(
      join(process.cwd(), "data/camp-reservations/stanton_stayed_on.csv"),
      "utf8"
    );
    const rows = parseResNexusCsv(csv).filter((r) => r.resNumber === "37582");
    const parsed = buildReservationFromRows("stanton-arizona", "37582", rows, STANTON_RATES);
    assert.ok(parsed);
    assert.equal(parsed.reservationType, "member");

    const pricing = computeStayPricing({
      checkInDate: parsed.checkInDate,
      checkOutDate: parsed.checkOutDate,
      isMember: true,
      rates: STANTON_RATES,
    });
    assert.ok(pricing.totalCents < 4_000_00);
    assert.ok(pricing.totalCents > 3_500_00);
  });

  it("classifies short paid stays as member when per-night rate matches LDMA daily", () => {
    const csv = readFileSync(
      join(process.cwd(), "data/camp-reservations/stanton_stayed_on.csv"),
      "utf8"
    );
    const rows = parseResNexusCsv(csv).filter((r) => r.resNumber === "37568");
    const parsed = buildReservationFromRows("stanton-arizona", "37568", rows, STANTON_RATES);
    assert.ok(parsed);
    assert.equal(parsed.reservationType, "member");

    const paidTotal = parsed.periods.reduce((s, p) => s + p.amountPaidCents, 0);
    assert.equal(paidTotal, 17_100);
    const guestTotal = computeStayPricing({
      checkInDate: parsed.checkInDate,
      checkOutDate: parsed.checkOutDate,
      isMember: false,
      rates: STANTON_RATES,
    }).totalCents;
    assert.ok(guestTotal > paidTotal * 2);
  });

  it("still picks guest when amounts clearly match guest daily", () => {
    const result = classifyReservationType(
      [{ amountDueCents: 45_562, nights: 1 }],
      STANTON_RATES
    );
    assert.equal(result.type, "guest");
  });
});
