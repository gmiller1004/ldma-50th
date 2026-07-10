import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CAMP_CANCELLATION_POLICY_PATH,
  campCancellationPolicyUrl,
  getCampCancellationPolicyContent,
} from "./camp-cancellation-policy.ts";

describe("campCancellationPolicyUrl", () => {
  it("builds policy URL from site base", () => {
    const prev = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://myldma.com";
    try {
      assert.equal(
        campCancellationPolicyUrl(),
        `https://myldma.com${CAMP_CANCELLATION_POLICY_PATH}`
      );
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = prev;
    }
  });
});

describe("getCampCancellationPolicyContent", () => {
  it("matches cancellation-refund fee constants", () => {
    const c = getCampCancellationPolicyContent();
    assert.equal(c.fullRefundDaysBeforeCheckIn, 7);
    assert.equal(c.dailyCancellationFee, "$25");
    assert.equal(c.dryMonthlyCancellationFee, "$25");
    assert.equal(c.hookupMonthlyCancellationFee, "$100");
    assert.equal(c.memberDailyMaxNights, 29);
  });
});
