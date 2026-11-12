import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildMembershipQuestionSummary, membershipContactPhrase, parseMembershipQuestion } from "./membership-question.ts";

const base = { firstName: "Pat", lastName: "Prospector", contactMethod: "email", email: "Pat@Example.com" };

describe("parseMembershipQuestion", () => {
  it("accepts an email lead with no questions", () => {
    const r = parseMembershipQuestion(base);
    assert.ok(r.ok);
    assert.equal(r.value.email, "pat@example.com");
    assert.match(buildMembershipQuestionSummary(r.value), /Questions: None entered/);
  });

  it("requires a valid phone for phone and text, and phrases text correctly", () => {
    assert.equal(parseMembershipQuestion({ ...base, contactMethod: "text", phone: "555-1234" }).ok, false);
    const r = parseMembershipQuestion({ ...base, contactMethod: "text", email: "", phone: "928.555.0142" });
    assert.ok(r.ok);
    assert.equal(membershipContactPhrase(r.value), "by text at (928) 555-0142");
    assert.match(buildMembershipQuestionSummary(r.value), /Preferred contact: Text message/);
    const p = parseMembershipQuestion({ ...base, contactMethod: "phone", phone: "19285550142" });
    assert.ok(p.ok);
    assert.equal(membershipContactPhrase(p.value), "by phone at (928) 555-0142");
  });

  it("keeps questions, trimmed and capped", () => {
    const r = parseMembershipQuestion({ ...base, questions: `  Do you offer payment plans?  ${"x".repeat(3000)}` });
    assert.ok(r.ok);
    assert.ok(r.value.questions.startsWith("Do you offer payment plans?"));
    assert.equal(r.value.questions.length, 2000);
  });

  it("rejects a missing name, contact method, or a bad optional email", () => {
    assert.equal(parseMembershipQuestion({ ...base, firstName: "" }).ok, false);
    assert.equal(parseMembershipQuestion({ ...base, contactMethod: "fax" }).ok, false);
    assert.equal(parseMembershipQuestion({ ...base, contactMethod: "phone", phone: "9285550142", email: "nope" }).ok, false);
  });
});
