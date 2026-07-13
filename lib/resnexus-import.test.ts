import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildReservationFromRows,
  classifyReservationType,
  parseResNexusCsv,
} from "./resnexus-import.ts";
import {
  isResNexusBillingPaidInFull,
  resnexusBillingTotals,
  resnexusRawPaidCents,
} from "./resnexus-billing-repair.ts";
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

  it("classifies Loud Mine Joey Muller stay as paid in full from ResNexus CSV", () => {
    const csv = readFileSync(
      join(process.cwd(), "data/camp-reservations/Loud Mine Future Reservations.csv"),
      "utf8"
    );
    const rows = parseResNexusCsv(csv).filter((r) => r.resNumber === "13691");
    const parsed = buildReservationFromRows("loud-mine-georgia", "13691", rows, {
      memberRateDaily: 14,
      memberRateMonthly: 360,
      nonMemberRateDaily: 30,
    });
    assert.ok(parsed);
    assert.equal(isResNexusBillingPaidInFull(parsed), true);
    const { totalDueCents, allocatedPaidCents } = resnexusBillingTotals(parsed);
    assert.equal(totalDueCents, 36_000);
    assert.equal(allocatedPaidCents, 36_000);
    assert.equal(resnexusRawPaidCents(rows), 72_000);
  });
});
