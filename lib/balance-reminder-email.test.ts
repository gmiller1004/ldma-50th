import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BALANCE_REMINDER_DAYS_BEFORE,
  buildBalanceReminderEmail,
  formatReminderLongDate,
  formatReminderShortDate,
} from "./balance-reminder-email.ts";

const base = {
  campName: "Stanton",
  guestOrMemberName: "Pat Sample",
  payBalanceUrl: "https://myldma.com/reservations/pay?token=t",
};

describe("balance reminder cadence", () => {
  it("sends 5 days before and on the due date", () => {
    assert.deepEqual(BALANCE_REMINDER_DAYS_BEFORE, { five_days: 5, due_date: 0 });
  });
});

describe("formatReminderDates", () => {
  it("formats dates for people, not systems", () => {
    assert.equal(formatReminderLongDate("2026-11-14"), "Saturday, November 14, 2026");
    assert.equal(formatReminderShortDate("2026-12-01"), "Dec 1");
  });
});

describe("buildBalanceReminderEmail", () => {
  it("asks for payment ahead of arrival with office hours as a fallback", () => {
    const email = buildBalanceReminderEmail({
      ...base,
      checkInDate: "2026-11-14",
      checkOutDate: "2026-11-21",
      balanceDueCents: 13300,
      stage: "five_days",
      reminderKind: "before_arrival",
    });
    assert.equal(email.subject, "Friendly reminder: your Stanton stay begins Nov 14");
    assert.match(email.text, /Remaining balance: \$133\.00/);
    assert.match(email.text, /reserved and waiting for you/);
    assert.match(email.text, /Paying ahead online/);
    assert.match(email.text, /camp office when you arrive, if you arrive during office hours \(typically 8 a\.m\. to 5 p\.m\.\)/);
    assert.doesNotMatch(email.text, /due at camp/i);
    assert.doesNotMatch(email.text, /2026-11-14/);
  });

  it("sends a welcome-style note on arrival day", () => {
    const email = buildBalanceReminderEmail({
      ...base,
      checkInDate: "2026-11-14",
      checkOutDate: "2026-11-21",
      balanceDueCents: 13300,
      stage: "due_date",
      reminderKind: "before_arrival",
    });
    assert.equal(email.subject, "Your Stanton stay begins today");
    assert.match(email.text, /begins today, Saturday, November 14, 2026/);
  });

  it("words monthly payments around the due date", () => {
    const five = buildBalanceReminderEmail({
      ...base,
      checkInDate: "2026-11-01",
      checkOutDate: "2027-04-01",
      balanceDueCents: 51000,
      stage: "five_days",
      reminderKind: "billing_period",
      paymentDueDate: "2026-12-01",
    });
    assert.equal(five.subject, "Friendly reminder: your Stanton site payment is due Dec 1");
    assert.match(five.text, /Amount due Dec 1: \$510\.00/);

    const due = buildBalanceReminderEmail({
      ...base,
      checkInDate: "2026-11-01",
      checkOutDate: "2027-04-01",
      balanceDueCents: 51000,
      stage: "due_date",
      reminderKind: "billing_period",
      paymentDueDate: "2026-12-01",
    });
    assert.equal(due.subject, "Your Stanton site payment is due today");
    assert.match(due.html, /Already taken care of this\? Thank you/);
  });
});
