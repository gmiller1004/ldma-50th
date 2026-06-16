import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  pilotSiteNameToCode,
  clearPilotSiteOverrideCache,
  loadPilotSiteOverrides,
} from "./pilot-site-remap.ts";

describe("pilotSiteNameToCode vein mountain", () => {
  const camp = "vein-mountain-north-carolina";

  it("maps Lower and Upper camps", () => {
    assert.equal(pilotSiteNameToCode(camp, "Lower 2"), "LC-02");
    assert.equal(pilotSiteNameToCode(camp, "Lower 14"), "LC-14");
    assert.equal(pilotSiteNameToCode(camp, "Upper 1"), "UC-01");
    assert.equal(pilotSiteNameToCode(camp, "Upper 10"), "UC-10");
  });

  it("maps Overflow to LC-21+", () => {
    assert.equal(pilotSiteNameToCode(camp, "Overflow 1"), "LC-21");
    assert.equal(pilotSiteNameToCode(camp, "Overflow 4"), "LC-24");
  });
});

describe("pilotSiteNameToCode burnt river", () => {
  const camp = "burnt-river-oregon";

  it("maps Hookup Site and Dry Site names", () => {
    assert.equal(pilotSiteNameToCode(camp, "Hookup Site 1"), "1");
    assert.equal(pilotSiteNameToCode(camp, "Hookup Site 4"), "4");
    assert.equal(pilotSiteNameToCode(camp, "Dry Site 1"), "D1");
    assert.equal(pilotSiteNameToCode(camp, "Dry Site 30"), "D30");
    assert.equal(pilotSiteNameToCode(camp, "Dry Site 31"), null);
  });
});

describe("pilot site overrides", () => {
  it("loads override csv", () => {
    clearPilotSiteOverrideCache();
    const map = loadPilotSiteOverrides();
    assert.ok(map instanceof Map);
  });
});
