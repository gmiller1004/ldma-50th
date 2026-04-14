/**
 * Onsite Klaviyo custom metrics — associates with the profile when the visitor
 * was identified from a Klaviyo email (link tracking + klaviyo.js).
 * No email field required on the client.
 */

import { MEMBERSHIP_METRICS } from "@/lib/klaviyo-membership-constants";

export { MEMBERSHIP_METRICS };

type KlaviyoPush = {
  push: (args: unknown[]) => void;
};

function pushTrack(metricName: string, properties: Record<string, unknown>): void {
  const w = window as unknown as {
    klaviyo?: KlaviyoPush;
    _klOnsite?: unknown[][];
  };
  const payload = ["track", metricName, properties] as unknown[];
  if (w.klaviyo?.push) {
    w.klaviyo.push(payload as unknown[]);
    return;
  }
  // Queue before klaviyo.js finishes loading (same pattern as Klaviyo embed)
  if (!w._klOnsite) w._klOnsite = [];
  w._klOnsite.push(payload);
}

/**
 * Fire a custom metric on the active Klaviyo session (campaign / identified visitors).
 */
export function trackMembershipMetricOnsite(
  metricName: (typeof MEMBERSHIP_METRICS)[keyof typeof MEMBERSHIP_METRICS],
  properties: Record<string, unknown>
): void {
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_KLAVIYO_COMPANY_ID?.trim()) return;
  try {
    pushTrack(metricName, properties);
  } catch (e) {
    console.error("[Klaviyo] onsite track failed:", e);
  }
}
