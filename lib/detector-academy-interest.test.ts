import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildAcademyLeadSummary, parseAcademyInterest, preferredContactPhrase } from "./detector-academy-interest.ts";

const base = { firstName: "Pat", lastName: "Prospector", contactMethod: "email", email: "Pat@Example.com", ownsDetector: false };

describe("parseAcademyInterest", () => {
  it("accepts an email lead with no detector", () => {
    const r = parseAcademyInterest(base);
    assert.ok(r.ok);
    assert.equal(r.value.email, "pat@example.com");
    assert.equal(r.value.detectorBrand, null);
  });

  it("requires a valid phone when phone is preferred", () => {
    assert.equal(parseAcademyInterest({ ...base, contactMethod: "phone", phone: "555-1234" }).ok, false);
    const r = parseAcademyInterest({ ...base, contactMethod: "phone", email: "", phone: "(928) 555-0142" });
    assert.ok(r.ok);
    assert.equal(preferredContactPhrase(r.value), "by phone at (928) 555-0142");
  });

  it("requires brand and Garrett model follow-ups, and drops ones that don't apply", () => {
    assert.equal(parseAcademyInterest({ ...base, ownsDetector: true }).ok, false);
    assert.equal(parseAcademyInterest({ ...base, ownsDetector: true, detectorBrand: "garrett" }).ok, false);
    const other = parseAcademyInterest({ ...base, ownsDetector: true, detectorBrand: "other", garrettModel: "axiom" });
    assert.ok(other.ok);
    assert.equal(other.value.garrettModel, null);
    const g = parseAcademyInterest({ ...base, ownsDetector: true, detectorBrand: "garrett", garrettModel: "goldmaster_24k" });
    assert.ok(g.ok);
    assert.match(buildAcademyLeadSummary(g.value), /Detector: Owns a Garrett: GoldMaster 24k/);
  });

  it("rejects missing name or contact method", () => {
    assert.equal(parseAcademyInterest({ ...base, firstName: " " }).ok, false);
    assert.equal(parseAcademyInterest({ ...base, contactMethod: "text" }).ok, false);
  });
});
