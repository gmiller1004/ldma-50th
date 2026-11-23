/**
 * Detector Academy discount applications: persist, subscribe in Klaviyo, and fire the
 * "Academy Discount Applied" metric that drives the thank-you + delayed code flow.
 */

import { sql, hasDb } from "@/lib/db";
import { subscribeEmailToKlaviyoMarketing } from "@/lib/klaviyo-marketing-subscribe";
import { trackKlaviyoEvent } from "@/lib/klaviyo-track-event";
import {
  ACADEMY_DISCOUNT_APPLIED_METRIC,
  academyDiscountKlaviyoProperties,
  buildAcademyDiscountSummary,
  qualifiesForAcademyDiscount,
  type AcademyDiscountInput,
} from "@/lib/detector-academy-discount";

export async function submitAcademyDiscount(
  i: AcademyDiscountInput
): Promise<{ ok: boolean; qualifies: boolean; errors: string[] }> {
  const errors: string[] = [];
  let leadId: string | null = null;
  const qualifies = qualifiesForAcademyDiscount(i);

  if (hasDb() && sql) {
    try {
      const rows = (await sql`
        INSERT INTO detector_academy_discount (
          first_name, last_name, email, membership, qualifier, bring_detector,
          experience, heard_about, camping, qualifies
        ) VALUES (
          ${i.firstName}, ${i.lastName || null}, ${i.email}, ${i.membership}, ${i.qualifier},
          ${i.bringDetector}, ${i.experience}, ${i.heardAbout}, ${i.camping}, ${qualifies}
        )
        RETURNING id
      `) as { id: string }[];
      leadId = rows[0]?.id ?? null;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "Database insert failed");
    }
  }

  const props = academyDiscountKlaviyoProperties(i);
  const stringProps: Record<string, string> = {};
  for (const [k, v] of Object.entries(props)) {
    stringProps[k] = typeof v === "boolean" ? (v ? "true" : "false") : String(v);
  }

  const sub = await subscribeEmailToKlaviyoMarketing(
    i.email,
    "events",
    stringProps,
    i.firstName
  );
  if (!sub.ok) errors.push(`Klaviyo subscribe: ${sub.error ?? "failed"}`);

  const tracked = await trackKlaviyoEvent({
    email: i.email,
    firstName: i.firstName,
    lastName: i.lastName || undefined,
    metricName: ACADEMY_DISCOUNT_APPLIED_METRIC,
    properties: {
      ...props,
      summary: buildAcademyDiscountSummary(i),
    },
    uniqueId: leadId ? `academy-discount-${leadId}` : undefined,
  });
  if (!tracked.ok) errors.push(`Klaviyo event: ${tracked.error ?? "failed"}`);

  if (leadId && sql) {
    await sql`
      UPDATE detector_academy_discount
      SET klaviyo_synced_at = ${tracked.ok || sub.ok ? new Date().toISOString() : null},
          last_error = ${errors.length ? errors.join(" | ") : null}
      WHERE id = ${leadId}
    `.catch(() => undefined);
  }

  if (errors.length) console.error("[detector-academy-discount]", errors.join(" | "));

  // Form succeeds if we at least stored the lead or reached Klaviyo — don't block on staff tooling.
  const ok = Boolean(leadId) || tracked.ok || sub.ok;
  return { ok, qualifies, errors };
}
