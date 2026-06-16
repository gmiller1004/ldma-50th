import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseResNexusDateRange,
  extractSiteCode,
  parseMoney,
  allocatePeriodPayments,
  classifyReservationType,
  parseGuestName,
} from "./resnexus-import.ts";

describe("parseResNexusDateRange", () => {
  it("parses same-year monthly range with exclusive checkout", () => {
    const r = parseResNexusDateRange("10/1-10/31/2026");
    assert.equal(r?.checkIn, "2026-10-01");
    assert.equal(r?.checkOut, "2026-11-01");
  });

  it("parses cross-month range", () => {
    const r = parseResNexusDateRange("6/9-7/8/2026");
    assert.equal(r?.checkIn, "2026-06-09");
    assert.equal(r?.checkOut, "2026-07-09");
  });
});

describe("extractSiteCode", () => {
  it("normalizes Stanton numeric sites", () => {
    assert.equal(extractSiteCode("042 North Camp: Full Hook Up - 30 AMP"), "42");
    assert.equal(extractSiteCode("A-03 South Camp: Dry Camp"), "A-03");
  });

  it("normalizes Blue Bucket and Loud Mine", () => {
    assert.equal(extractSiteCode("016 Main Camp: Hook Up - 50 AMP w/ Water"), "16");
    assert.equal(extractSiteCode("D004 Dry Camp"), "D4");
  });
});

describe("allocatePeriodPayments", () => {
  it("prepay spills into next period", () => {
    const result = allocatePeriodPayments([
      { amountDueCents: 48000, paidRaw: "$960.00" },
      { amountDueCents: 48000, paidRaw: "--" },
      { amountDueCents: 17032, paidRaw: "--" },
    ]);
    assert.equal(result[0].amountPaidCents, 48000);
    assert.equal(result[0].status, "paid");
    assert.equal(result[1].amountPaidCents, 48000);
    assert.equal(result[1].status, "paid");
    assert.equal(result[2].amountPaidCents, 0);
    assert.equal(result[2].status, "unpaid");
  });

  it("partial payment on single period", () => {
    const result = allocatePeriodPayments([
      { amountDueCents: 51000, paidRaw: "$455.00" },
      { amountDueCents: 51000, paidRaw: "--" },
    ]);
    assert.equal(result[0].status, "partial");
    assert.equal(result[0].amountPaidCents, 45500);
  });
});

describe("classifyReservationType", () => {
  const rates = {
    memberRateDaily: 19,
    memberRateMonthly: 510,
    nonMemberRateDaily: 45,
  };

  it("zero total is member comp", () => {
    const r = classifyReservationType([{ amountDueCents: 0, nights: 31 }], rates);
    assert.equal(r.type, "member");
    assert.equal(r.reason, "comp_zero_amount");
  });

  it("matches member monthly period amount", () => {
    const nights = 31;
    const expected = Math.round(510 * (nights / 30) * 100);
    const r = classifyReservationType([{ amountDueCents: expected, nights }], rates);
    assert.equal(r.type, "member");
  });
});

describe("parseGuestName", () => {
  it("handles slash in name", () => {
    const r = parseGuestName("Anthony/ Liz Perez");
    assert.equal(r.firstName, "Anthony");
    assert.equal(r.lastName, "Liz Perez");
  });
});

describe("parseMoney", () => {
  it("parses currency", () => {
    assert.equal(parseMoney("$1,620.00"), 162000);
    assert.equal(parseMoney("--"), null);
  });
});
