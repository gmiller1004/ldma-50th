import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getMembershipBundleKeyFromHandle,
  getMembershipBundleKeyFromTitle,
  isMembershipBundleTitle,
} from "./membership-bundle-config.ts";

describe("getMembershipBundleKeyFromTitle", () => {
  it("maps the Axiom Lite lifetime bundle", () => {
    assert.equal(
      getMembershipBundleKeyFromTitle("LDMA Lifetime Bundle — Garrett Axiom Lite"),
      "axiom-lite"
    );
  });

  it("still maps prior detector bundles", () => {
    assert.equal(
      getMembershipBundleKeyFromTitle("LDMA Lifetime Bundle — Garrett GoldMaster 24k"),
      "gm24k"
    );
    assert.equal(
      getMembershipBundleKeyFromTitle("LDMA Lifetime Bundle Minelab GM1000"),
      "gm1000"
    );
    assert.equal(
      getMembershipBundleKeyFromTitle("LDMA Lifetime Bundle Minelab GM2000"),
      "gm2000"
    );
  });
});

describe("getMembershipBundleKeyFromHandle", () => {
  it("does not treat Garrett Axiom as the 24k bundle", () => {
    assert.equal(
      getMembershipBundleKeyFromHandle("ldma-lifetime-bundle-garrett-axiom-lite"),
      "axiom-lite"
    );
  });
});

describe("isMembershipBundleTitle", () => {
  it("recognizes the Axiom Lite product title", () => {
    assert.equal(
      isMembershipBundleTitle("LDMA Lifetime Bundle — Garrett Axiom Lite"),
      true
    );
  });
});
