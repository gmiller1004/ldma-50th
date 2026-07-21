import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  klaviyoListIdForSignupSource,
  subscribeEmailToKlaviyoMarketing,
} from "./klaviyo-marketing-subscribe.ts";

const originalHomeListId = process.env.KLAVIYO_HOME_LIST_ID;
const originalDefaultListId = process.env.KLAVIYO_LIST_ID;
const originalApiKey = process.env.KLAVIYO_PRIVATE_API_KEY;
const originalFetch = global.fetch;

afterEach(() => {
  if (originalHomeListId === undefined) delete process.env.KLAVIYO_HOME_LIST_ID;
  else process.env.KLAVIYO_HOME_LIST_ID = originalHomeListId;

  if (originalDefaultListId === undefined) delete process.env.KLAVIYO_LIST_ID;
  else process.env.KLAVIYO_LIST_ID = originalDefaultListId;

  if (originalApiKey === undefined) delete process.env.KLAVIYO_PRIVATE_API_KEY;
  else process.env.KLAVIYO_PRIVATE_API_KEY = originalApiKey;

  global.fetch = originalFetch;
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

  it("writes first name to Klaviyo's native profile field", async () => {
    process.env.KLAVIYO_PRIVATE_API_KEY = "test-key";
    process.env.KLAVIYO_HOME_LIST_ID = "home-list";
    const requestBodies: unknown[] = [];
    global.fetch = async (_input, init) => {
      requestBodies.push(JSON.parse(String(init?.body)));
      return new Response(null, { status: 202 });
    };

    const result = await subscribeEmailToKlaviyoMarketing(
      "carl@example.com",
      "home",
      undefined,
      "Carl"
    );

    assert.equal(result.ok, true);
    assert.equal(
      (
        requestBodies[0] as {
          data: { attributes: { profiles: { data: Array<{ attributes: { first_name: string } }> } } };
        }
      ).data.attributes.profiles.data[0].attributes.first_name,
      "Carl"
    );
    assert.equal(
      (requestBodies[1] as { data: { attributes: { first_name: string } } }).data.attributes
        .first_name,
      "Carl"
    );
  });
});
