import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  GUEST_MAX_CONSECUTIVE_NIGHTS,
  PUBLIC_BOOKING_DEPOSIT_CENTS,
  buildSiteTypeAvailability,
  computePublicPaymentOptions,
  formatSiteTypeGroupLabel,
  isSiteAvailable,
  pickNextAvailableSite,
  siteTypeGroupKey,
  validatePublicBookingRequest,
} from "./public-camp-booking.ts";

describe("siteTypeGroupKey", () => {
  it("groups by special_type and site_type", () => {
    assert.equal(siteTypeGroupKey("Premium", "30 Amp Full Hook-Up"), "Premium|30 Amp Full Hook-Up");
    assert.equal(siteTypeGroupKey(null, "Dry Camping"), "|Dry Camping");
  });

  it("formats labels", () => {
    assert.equal(formatSiteTypeGroupLabel("Premium", "30 Amp"), "Premium — 30 Amp");
    assert.equal(formatSiteTypeGroupLabel(null, "Dry Camping"), "Dry Camping");
  });
});

describe("isSiteAvailable", () => {
  const reservations = [
    { site_id: "a", check_in_date: "2026-07-10", check_out_date: "2026-07-15" },
  ];

  it("detects overlap", () => {
    assert.equal(isSiteAvailable("a", "2026-07-12", "2026-07-14", reservations), false);
    assert.equal(isSiteAvailable("a", "2026-07-15", "2026-07-17", reservations), true);
    assert.equal(isSiteAvailable("b", "2026-07-12", "2026-07-14", reservations), true);
  });
});

describe("pickNextAvailableSite", () => {
  const sites = [
    {
      id: "1",
      name: "Site 1",
      site_code: "1",
      site_type: "30 Amp",
      special_type: null,
      sort_order: 2,
      member_rate_daily: 30,
      member_rate_monthly: null,
      non_member_rate_daily: 40,
    },
    {
      id: "2",
      name: "Site 2",
      site_code: "2",
      site_type: "30 Amp",
      special_type: null,
      sort_order: 1,
      member_rate_daily: 30,
      member_rate_monthly: null,
      non_member_rate_daily: 40,
    },
  ];

  it("picks lowest sort_order available site in type group", () => {
    const key = siteTypeGroupKey(null, "30 Amp");
    const picked = pickNextAvailableSite(sites, key, "2026-08-01", "2026-08-05", [
      { site_id: "2", check_in_date: "2026-08-01", check_out_date: "2026-08-03" },
    ]);
    assert.equal(picked?.id, "1");
  });
});

describe("buildSiteTypeAvailability", () => {
  it("marks sold-out groups and counts availability", () => {
    const sites = [
      {
        id: "1",
        name: "A",
        site_code: "1",
        site_type: "Dry",
        special_type: null,
        sort_order: 1,
        member_rate_daily: 15,
        member_rate_monthly: null,
        non_member_rate_daily: 20,
      },
      {
        id: "2",
        name: "B",
        site_code: "2",
        site_type: "Dry",
        special_type: null,
        sort_order: 2,
        member_rate_daily: 15,
        member_rate_monthly: null,
        non_member_rate_daily: 20,
      },
    ];
    const rows = buildSiteTypeAvailability({
      campSlug: "oconee-south-carolina",
      checkIn: "2026-08-01",
      checkOut: "2026-08-03",
      sites,
      reservations: [{ site_id: "1", check_in_date: "2026-08-01", check_out_date: "2026-08-05" }],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].availableCount, 1);
    assert.equal(rows[0].totalCount, 2);
    assert.equal(rows[0].soldOut, false);
  });
});

describe("computePublicPaymentOptions", () => {
  it("offers full pay and deposit when total exceeds deposit", () => {
    const options = computePublicPaymentOptions({
      totalCents: 15_000,
      firstPeriodCents: 15_000,
      usesMonthlyMemberRate: false,
      isMember: false,
    });
    assert.equal(options.length, 2);
    assert.equal(options[0].id, "full");
    assert.equal(options[0].amountCents, 15_000);
    assert.equal(options[1].id, "deposit");
    assert.equal(options[1].amountCents, PUBLIC_BOOKING_DEPOSIT_CENTS);
  });

  it("uses first month for long member stays", () => {
    const options = computePublicPaymentOptions({
      totalCents: 90_000,
      firstPeriodCents: 30_000,
      usesMonthlyMemberRate: true,
      isMember: true,
    });
    assert.equal(options[0].label, "Pay first month in full");
    assert.equal(options[0].amountCents, 30_000);
  });
});

describe("validatePublicBookingRequest", () => {
  it("limits guests to 10 consecutive nights", () => {
    const ok = validatePublicBookingRequest({
      campSlug: "oconee-south-carolina",
      checkIn: "2026-08-01",
      checkOut: "2026-08-11",
      reservationType: "guest",
    });
    assert.equal(ok.ok, true);

    const tooLong = validatePublicBookingRequest({
      campSlug: "oconee-south-carolina",
      checkIn: "2026-08-01",
      checkOut: "2026-08-12",
      reservationType: "guest",
    });
    assert.equal(tooLong.ok, false);
    if (!tooLong.ok) {
      assert.match(tooLong.error, new RegExp(String(GUEST_MAX_CONSECUTIVE_NIGHTS)));
    }
  });

  it("allows members longer stays", () => {
    const result = validatePublicBookingRequest({
      campSlug: "oconee-south-carolina",
      checkIn: "2026-08-01",
      checkOut: "2026-08-20",
      reservationType: "member",
    });
    assert.equal(result.ok, true);
  });

  it("rejects closed-season dates", () => {
    const result = validatePublicBookingRequest({
      campSlug: "stanton-arizona",
      checkIn: "2026-07-01",
      checkOut: "2026-07-05",
      reservationType: "member",
    });
    assert.equal(result.ok, false);
  });
});
