/**
 * Subscribe an email to the marketing list and set profile signup_source in Klaviyo.
 * Shared by newsletter API and chat transcript flow.
 */

const KLAVIYO_BASE = "https://a.klaviyo.com/api";
const KLAVIYO_SUBSCRIBE_URL = `${KLAVIYO_BASE}/profile-subscription-bulk-create-jobs/`;
const KLAVIYO_PROFILE_IMPORT_URL = `${KLAVIYO_BASE}/profile-import`;
const KLAVIYO_REVISION = "2024-05-15";

export type KlaviyoMarketingSignupSource =
  | "home"
  | "events"
  | "discover_events"
  | "chat"
  | "membership_quote"
  | "camp_reservation";

export function klaviyoListIdForSignupSource(
  signupSource: KlaviyoMarketingSignupSource
): string | undefined {
  if (signupSource === "home") {
    return process.env.KLAVIYO_HOME_LIST_ID?.trim() || process.env.KLAVIYO_LIST_ID?.trim();
  }
  return process.env.KLAVIYO_LIST_ID?.trim() || undefined;
}

async function subscribeEmailToMarketingList(
  apiKey: string,
  email: string,
  signupSource: KlaviyoMarketingSignupSource,
  extraProperties?: Record<string, string>
): Promise<{ ok: boolean; status?: number }> {
  const listId = klaviyoListIdForSignupSource(signupSource);

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
    return { ok: false, status: res.status };
  }

  const properties: Record<string, string> = {
    signup_source: signupSource,
    ...extraProperties,
  };
  await setKlaviyoProfileProperties(apiKey, email, properties);
  return { ok: true };
}

/**
 * Subscribe to email marketing when not already subscribed.
 * No-op if KLAVIYO_PRIVATE_API_KEY is unset or email is already SUBSCRIBED.
 */
export async function ensureKlaviyoEmailSubscribed(
  email: string,
  signupSource: KlaviyoMarketingSignupSource = "camp_reservation"
): Promise<void> {
  const apiKey = process.env.KLAVIYO_PRIVATE_API_KEY?.trim();
  if (!apiKey) return;

  const normalized = email.trim();
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return;

  try {
    const filter = `equals(email,"${normalized.replace(/"/g, '\\"')}")`;
    const profileRes = await fetch(
      `${KLAVIYO_BASE}/profiles?filter=${encodeURIComponent(filter)}`,
      {
        headers: {
          Authorization: `Klaviyo-API-Key ${apiKey}`,
          revision: KLAVIYO_REVISION,
          accept: "application/json",
        },
      }
    );
    if (profileRes.ok) {
      const data = (await profileRes.json()) as {
        data?: Array<{
          attributes?: {
            subscriptions?: {
              email?: { marketing?: { consent?: string } };
            };
          };
        }>;
      };
      const consent = data.data?.[0]?.attributes?.subscriptions?.email?.marketing?.consent;
      if (consent === "SUBSCRIBED") return;
    }

    await subscribeEmailToMarketingList(apiKey, normalized, signupSource);
  } catch (e) {
    console.error("[Klaviyo] ensureKlaviyoEmailSubscribed:", e);
  }
}

async function setKlaviyoProfileProperties(
  apiKey: string,
  email: string,
  properties: Record<string, string>
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
          properties,
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

/** Marketing subscribe + profile properties (signup_source, interest_path, etc.). */
export async function subscribeEmailToKlaviyoMarketing(
  email: string,
  signupSource: KlaviyoMarketingSignupSource,
  extraProperties?: Record<string, string>
): Promise<{ ok: boolean; error?: string; status?: number }> {
  const apiKey = process.env.KLAVIYO_PRIVATE_API_KEY;

  if (!apiKey) {
    console.error("[Klaviyo] KLAVIYO_PRIVATE_API_KEY not set");
    return { ok: false, error: "Newsletter is not configured", status: 503 };
  }

  try {
    const result = await subscribeEmailToMarketingList(apiKey, email, signupSource, extraProperties);
    if (!result.ok) {
      if (result.status === 429) {
        return { ok: false, error: "Too many requests. Please try again in a moment.", status: 429 };
      }
      return { ok: false, error: "Unable to subscribe", status: result.status };
    }
    return { ok: true };
  } catch (e) {
    console.error("[Klaviyo] subscribeEmailToKlaviyoMarketing:", e);
    return { ok: false, error: "Unable to subscribe" };
  }
}

