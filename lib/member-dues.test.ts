import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildDuesStaffNotice,
  maintenanceOptions,
  membershipOptions,
  priceDuesSelection,
  type MemberDuesSnapshot,
} from "./member-dues";

const NOW = new Date("2026-11-09T20:00:00Z");

function snapshot(overrides: Partial<MemberDuesSnapshot> = {}): MemberDuesSnapshot {
  return {
    showMaintenance: true,
    maintenanceDue: 20,
    maintenanceThruNextYear: 150,
    maintenanceMonthlyFee: 10,
    nextMaintenanceDueDate: "2026-11-01",
    membershipDue: 30,
    membershipBalance: 410,
    nextMembershipDueDate: "2026-12-01",
    onAutoPay: false,
    autoPayNextTotal: null,
    autoPayNextDate: null,
    ...overrides,
  };
}

describe("member dues options", () => {
  it("offers due-now and pay-ahead maintenance, due-now and payoff membership", () => {
    assert.deepEqual(
      maintenanceOptions(snapshot(), NOW).map((o) => [o.id, o.amountCents, o.label]),
      [
        ["maintenance_due", 2000, "Amount due now"],
        ["maintenance_through_next_year", 15000, "Pay ahead through 2027"],
      ]
    );
    assert.deepEqual(
      membershipOptions(snapshot()).map((o) => [o.id, o.amountCents]),
      [
        ["membership_due", 3000],
        ["membership_payoff", 41000],
      ]
    );
  });

  it("hides maintenance for exempt members", () => {
    assert.equal(maintenanceOptions(snapshot({ showMaintenance: false, maintenanceDue: 6110 }), NOW).length, 0);
  });

  it("only offers pay-ahead when nothing is due now", () => {
    assert.deepEqual(
      maintenanceOptions(snapshot({ maintenanceDue: 0, maintenanceThruNextYear: 130 }), NOW).map((o) => o.id),
      ["maintenance_through_next_year"]
    );
  });

  it("skips payoff when the balance is just what's due", () => {
    assert.deepEqual(membershipOptions(snapshot({ membershipDue: 30, membershipBalance: 30 })).map((o) => o.id), [
      "membership_due",
    ]);
  });
});

describe("priceDuesSelection", () => {
  it("prices from Salesforce balances", () => {
    const p = priceDuesSelection(snapshot(), { maintenance: "maintenance_due", membership: "membership_payoff" }, NOW);
    assert.ok(p.ok);
    assert.equal(p.maintenanceCents, 2000);
    assert.equal(p.membershipCents, 41000);
    assert.equal(p.totalCents, 43000);
  });

  it("rejects unknown or unavailable choices and empty selections", () => {
    assert.equal(priceDuesSelection(snapshot(), { membership: "membership_lifetime" }, NOW).ok, false);
    assert.equal(
      priceDuesSelection(snapshot({ showMaintenance: false }), { maintenance: "maintenance_due" }, NOW).ok,
      false
    );
    assert.equal(priceDuesSelection(snapshot(), {}, NOW).ok, false);
  });
});

describe("buildDuesStaffNotice", () => {
  it("lists the Salesforce payment split and flags AutoPay", () => {
    const text = buildDuesStaffNotice({
      memberName: "Pat Prospector",
      memberNumber: "2893444",
      memberEmail: "pat@example.com",
      pricing: {
        maintenanceCents: 2000,
        membershipCents: 3000,
        totalCents: 5000,
        maintenanceLabel: "Amount due now",
        membershipLabel: "Amount due now",
      },
      balancesBefore: snapshot({ onAutoPay: true, autoPayNextTotal: 40, autoPayNextDate: "2026-12-01" }),
      paidAtIso: NOW.toISOString(),
      stripePaymentIntentId: "pi_123",
    });
    assert.match(text, /Membership Payment Amount: \$30\.00/);
    assert.match(text, /Maintenance Fee Amount: \$20\.00/);
    assert.match(text, /Transaction Id: pi_123/);
    assert.match(text, /AUTOPAY: .*\$40\.00 on Dec 1, 2026/);
  });
});
