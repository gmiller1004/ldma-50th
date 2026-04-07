/**
 * Subscribe an email to the marketing list and set profile signup_source in Klaviyo.
 * Shared by newsletter API and chat transcript flow.
 */

const KLAVIYO_BASE = "https://a.klaviyo.com/api";
const KLAVIYO_SUBSCRIBE_URL = `${KLAVIYO_BASE}/profile-subscription-bulk-create-jobs/`;
const KLAVIYO_PROFILE_IMPORT_URL = `${KLAVIYO_BASE}/profile-import`;
const KLAVIYO_REVISION = "2024-05-15";

export type KlaviyoMarketingSignupSource = "home" | "events" | "chat";

async function setKlaviyoSignupSource(
  apiKey: string,
  email: string,
  signupSource: string
): Promise<void> {
  const res = await fetch(KLAVIYO_PROFILE_IMPORT_URL, {
    method: "POST",
    headers: {
      Authorization: `Klaviyo-API-Key ${apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      revision: KLAVIYO_REVISION,
    },
    body: JSON.stringify({
      data: {
        type: "profile",
        attributes: {
          email,
          properties: {
            signup_source: signupSource,
          },
        },
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(
      "[Klaviyo] profile-import (signup_source) error:",
      res.status,
      text
    );
  }
}

/** Marketing subscribe + signup_source. Returns false if Klaviyo is not configured or subscribe fails. */
export async function subscribeEmailToKlaviyoMarketing(
  email: string,
  signupSource: KlaviyoMarketingSignupSource
): Promise<{ ok: boolean; error?: string; status?: number }> {
  const apiKey = process.env.KLAVIYO_PRIVATE_API_KEY;
  const listId = process.env.KLAVIYO_LIST_ID;

  if (!apiKey) {
    console.error("[Klaviyo] KLAVIYO_PRIVATE_API_KEY not set");
    return { ok: false, error: "Newsletter is not configured", status: 503 };
  }

  try {
  const payload: {
    data: {
      type: string;
      attributes: {
        profiles: { data: unknown[] };
        custom_source?: string;
      };
      relationships?: { list: { data: { type: string; id: string } } };
    };
  } = {
    data: {
      type: "profile-subscription-bulk-create-job",
      attributes: {
        profiles: {
          data: [
            {
              type: "profile",
              attributes: {
                email,
                subscriptions: {
                  email: {
                    marketing: {
                      consent: "SUBSCRIBED",
                    },
                  },
                },
              },
            },
          ],
        },
        custom_source: "LDMA 50th Website",
      },
    },
  };

  if (listId) {
    payload.data.relationships = {
      list: {
        data: {
          type: "list",
          id: listId,
        },
      },
    };
  }

  const res = await fetch(KLAVIYO_SUBSCRIBE_URL, {
    method: "POST",
    headers: {
      Authorization: `Klaviyo-API-Key ${apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      revision: KLAVIYO_REVISION,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error("[Klaviyo] subscribe error:", res.status, errBody);
    if (res.status === 429) {
      return { ok: false, error: "Too many requests. Please try again in a moment.", status: 429 };
    }
    return { ok: false, error: "Unable to subscribe", status: res.status };
  }

  await setKlaviyoSignupSource(apiKey, email, signupSource);
  return { ok: true };
  } catch (e) {
    console.error("[Klaviyo] subscribeEmailToKlaviyoMarketing:", e);
    return { ok: false, error: "Unable to subscribe" };
  }
}

