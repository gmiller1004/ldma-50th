import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizePhoneDigits,
  parseCaretakerLookupInput,
  caretakerLookupFieldsFromBody,
} from "./member-contact-search.ts";

describe("normalizePhoneDigits", () => {
  it("strips formatting", () => {
    assert.equal(normalizePhoneDigits("(555) 123-4567"), "5551234567");
    assert.equal(normalizePhoneDigits("+1 555-123-4567"), "15551234567");
  });
});

describe("parseCaretakerLookupInput", () => {
  it("detects email", () => {
    assert.deepEqual(parseCaretakerLookupInput("Member@Example.com"), {
      email: "member@example.com",
    });
  });

  it("detects phone with enough digits", () => {
    assert.deepEqual(parseCaretakerLookupInput("555-123-4567"), {
      phone: "555-123-4567",
    });
  });

  it("treats 7-digit member numbers as member number not phone", () => {
    assert.deepEqual(parseCaretakerLookupInput("2954589"), { memberNumber: "2954589" });
  });

  it("treats 10+ digit strings as phone", () => {
    assert.deepEqual(parseCaretakerLookupInput("8884653717"), { phone: "8884653717" });
  });

  it("treats short numeric strings as member numbers", () => {
    assert.deepEqual(parseCaretakerLookupInput("12345"), { memberNumber: "12345" });
  });

  it("treats alphanumeric as member number", () => {
    assert.deepEqual(parseCaretakerLookupInput("LDMA-100"), { memberNumber: "LDMA-100" });
  });
});

describe("caretakerLookupFieldsFromBody", () => {
  it("prefers contactId when set", () => {
    assert.deepEqual(
      caretakerLookupFieldsFromBody({
        contactId: "003xx",
        memberNumber: "1",
      }),
      { contactId: "003xx" }
    );
  });

  it("rejects multiple lookup fields", () => {
    assert.deepEqual(
      caretakerLookupFieldsFromBody({ memberNumber: "1", email: "a@b.com" }),
      {}
    );
  });
});
