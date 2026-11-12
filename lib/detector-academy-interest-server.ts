/**
 * Detector Academy interest leads: save the submission, find the person in Salesforce, add a
 * follow-up Task for Member Services, email Gen and Nannette, and add email leads to Klaviyo.
 */

import { sql, hasDb } from "@/lib/db";
import { salesforceContactUrl } from "@/lib/salesforce-family-legacy";
import { subscribeEmailToKlaviyoMarketing } from "@/lib/klaviyo-marketing-subscribe";
import { sendMemberServicesLeadEmail } from "@/lib/sendgrid";
import { DETECTOR_ACADEMY_INTEREST_TAG } from "@/lib/detector-academy";
import { createMemberServicesTask, findLeadContactId, MEMBER_SERVICES_LEAD_EMAILS } from "@/lib/member-services-leads";
import {
  buildAcademyLeadSummary,
  preferredContactPhrase,
  type AcademyInterestInput,
} from "@/lib/detector-academy-interest";

/** `notified` is false only when neither the Salesforce Task nor the Member Services email went out. */
export async function submitAcademyInterest(i: AcademyInterestInput): Promise<{ notified: boolean; errors: string[] }> {
  const errors: string[] = [];
  let leadId: string | null = null;
  if (hasDb() && sql) {
    const rows = (await sql`
      INSERT INTO detector_academy_interest (
        first_name, last_name, contact_method, email, phone, owns_detector, detector_brand, garrett_model
      ) VALUES (
        ${i.firstName}, ${i.lastName || null}, ${i.contactMethod}, ${i.email || null}, ${i.phone || null},
        ${i.ownsDetector}, ${i.detectorBrand}, ${i.garrettModel}
      )
      RETURNING id
    `) as { id: string }[];
    leadId = rows[0]?.id ?? null;
  }

  const name = [i.firstName, i.lastName].filter(Boolean).join(" ");
  const summary = buildAcademyLeadSummary(i);
  const contactPhrase = preferredContactPhrase(i);

  const contactId = await findLeadContactId(i);
  const task = await createMemberServicesTask({
    contactId,
    subject: `Detector Academy lead: contact ${name} ${contactPhrase}`,
    description: `Interested in the LDMA Detector Academy (Stanton, early March 2027).\n\n${summary}`,
  }).catch((e) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) }));
  if (!task.ok) errors.push(task.error);

  const emailed = await sendMemberServicesLeadEmail({
    to: MEMBER_SERVICES_LEAD_EMAILS,
    heading: "New Detector Academy lead",
    subject: `Detector Academy lead: ${name}, contact ${contactPhrase}`,
    intro: `${name} is interested in the LDMA Detector Academy and would like to be contacted ${contactPhrase}.`,
    summary,
    salesforceUrl: contactId ? await salesforceContactUrl(contactId) : null,
    taskCreated: task.ok,
  });
  if (!emailed) errors.push("Member Services email failed");

  let klaviyoSynced = false;
  if (i.email) {
    const sub = await subscribeEmailToKlaviyoMarketing(
      i.email,
      "events",
      {
        event_type_interest: DETECTOR_ACADEMY_INTEREST_TAG,
        interest_path: "detector-academy",
        referrer_cta: "detector_academy_questionnaire",
        preferred_contact: i.contactMethod,
        detector_owned: i.ownsDetector ? (i.detectorBrand === "garrett" ? i.garrettModel ?? "garrett" : "other_brand") : "none",
      },
      i.firstName
    );
    klaviyoSynced = sub.ok;
    if (!sub.ok) errors.push(`Klaviyo: ${sub.error ?? "subscribe failed"}`);
  }

  if (leadId && sql) {
    await sql`
      UPDATE detector_academy_interest
      SET sf_contact_id = ${contactId}, sf_task_id = ${task.ok ? task.id : null},
          staff_notified_at = ${emailed ? new Date().toISOString() : null},
          klaviyo_synced_at = ${klaviyoSynced ? new Date().toISOString() : null},
          last_error = ${errors.length ? errors.join(" | ") : null}
      WHERE id = ${leadId}
    `;
  }
  if (errors.length) console.error("[detector-academy-interest]", errors.join(" | "));
  return { notified: task.ok || emailed, errors };
}
