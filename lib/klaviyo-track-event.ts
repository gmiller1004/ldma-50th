/**
 * Fire a Klaviyo Events API metric (creates/updates the profile and can trigger flows).
 */

const KLAVIYO_BASE = "https://a.klaviyo.com/api";
const KLAVIYO_REVISION = "2024-05-15";

export async function trackKlaviyoEvent(input: {
  email: string;
  metricName: string;
  properties?: Record<string, unknown>;
  firstName?: string;
  lastName?: string;
  uniqueId?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.KLAVIYO_PRIVATE_API_KEY?.trim();
  if (!apiKey) {
    console.error("[Klaviyo] KLAVIYO_PRIVATE_API_KEY not set");
    return { ok: false, error: "Klaviyo is not configured" };
  }

  const email = input.email.trim().toLowerCase();
  if (!email) return { ok: false, error: "Email required" };

  try {
    const res = await fetch(`${KLAVIYO_BASE}/events/`, {
      method: "POST",
      headers: {
        Authorization: `Klaviyo-API-Key ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        revision: KLAVIYO_REVISION,
      },
      body: JSON.stringify({
        data: {
          type: "event",
          attributes: {
            properties: input.properties ?? {},
            ...(input.uniqueId ? { unique_id: input.uniqueId } : {}),
            metric: {
              data: {
                type: "metric",
                attributes: { name: input.metricName },
              },
            },
            profile: {
              data: {
                type: "profile",
                attributes: {
                  email,
                  ...(input.firstName ? { first_name: input.firstName } : {}),
                  ...(input.lastName ? { last_name: input.lastName } : {}),
                },
              },
            },
          },
        },
      }),
    });

    if (!res.ok && res.status !== 202) {
      const text = await res.text();
      console.error("[Klaviyo] track event error:", res.status, text);
      return { ok: false, error: `Klaviyo ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error("[Klaviyo] trackKlaviyoEvent:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Klaviyo request failed" };
  }
}
