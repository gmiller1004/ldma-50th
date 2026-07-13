import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { uniqueCaretakerEmailsForCamp } from "./caretaker-admin-summary.ts";

describe("uniqueCaretakerEmailsForCamp", () => {
  const roster = [
    { campSlug: "italian-bar-california", email: "alice@example.com" },
    { campSlug: "italian-bar-california", email: "bob@example.com" },
    { campSlug: "stanton-arizona", email: "carol@example.com" },
    { campSlug: "italian-bar-california", email: "alice@example.com" },
    { campSlug: "italian-bar-california", email: null },
  ];

  it("returns deduped emails for the camp only", () => {
    assert.deepEqual(uniqueCaretakerEmailsForCamp(roster, "italian-bar-california"), [
      "alice@example.com",
      "bob@example.com",
    ]);
  });

  it("excludes the guest recipient email", () => {
    assert.deepEqual(
      uniqueCaretakerEmailsForCamp(roster, "italian-bar-california", "alice@example.com"),
      ["bob@example.com"]
    );
  });

  it("returns empty when no caretakers match", () => {
    assert.deepEqual(uniqueCaretakerEmailsForCamp(roster, "burnt-river-oregon"), []);
  });
});
