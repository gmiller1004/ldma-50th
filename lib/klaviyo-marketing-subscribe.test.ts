import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { klaviyoListIdForSignupSource } from "./klaviyo-marketing-subscribe.ts";

const originalHomeListId = process.env.KLAVIYO_HOME_LIST_ID;
const originalDefaultListId = process.env.KLAVIYO_LIST_ID;

afterEach(() => {
  if (originalHomeListId === undefined) delete process.env.KLAVIYO_HOME_LIST_ID;
  else process.env.KLAVIYO_HOME_LIST_ID = originalHomeListId;

  if (originalDefaultListId === undefined) delete process.env.KLAVIYO_LIST_ID;
  else process.env.KLAVIYO_LIST_ID = originalDefaultListId;
});

describe("klaviyoListIdForSignupSource", () => {
  it("routes homepage signups to the dedicated home list", () => {
    process.env.KLAVIYO_HOME_LIST_ID = "home-list";
    process.env.KLAVIYO_LIST_ID = "events-list";

    assert.equal(klaviyoListIdForSignupSource("home"), "home-list");
    assert.equal(klaviyoListIdForSignupSource("events"), "events-list");
  });

  it("falls back to the default list when the home list is unset", () => {
    delete process.env.KLAVIYO_HOME_LIST_ID;
    process.env.KLAVIYO_LIST_ID = "events-list";

    assert.equal(klaviyoListIdForSignupSource("home"), "events-list");
  });
});
