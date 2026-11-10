/**
 * Detector Academy interest leads: save the submission, find the person in Salesforce, add a
 * follow-up Task for Member Services, email Gen and Nannette, and add email leads to Klaviyo.
 */

import { sql, hasDb } from "@/lib/db";
import { getSalesforceRestClient, searchMembersForCaretaker } from "@/lib/salesforce";
import { salesforceContactUrl } from "@/lib/salesforce-family-legacy";
import { subscribeEmailToKlaviyoMarketing } from "@/lib/klaviyo-marketing-subscribe";
import { sendDetectorAcademyLeadEmail } from "@/lib/sendgrid";
import { DETECTOR_ACADEMY_INTEREST_TAG } from "@/lib/detector-academy";
import {
  buildAcademyLeadSummary,
  preferredContactPhrase,
  type AcademyInterestInput,
} from "@/lib/detector-academy-interest";

const SF_VERSION = "v59.0";
/** Member Services user who owns the Salesforce follow-up Task. */
const TASK_OWNER_EMAIL = "gricci@goldprospectors.org";
const LEAD_NOTIFY_EMAILS = ["gricci@goldprospectors.org", "nmathis@lostdutchmans.com"];

async function findContactId(i: AcademyInterestInput): Promise<string | null> {
  const lookups = [i.email ? { email: i.email } : null, i.phone ? { phone: i.phone } : null].filter(
    (l): l is { email: string } | { phone: string } => l !== null
  );
  for (const lookup of lookups) {
    const r = await searchMembersForCaretaker(lookup).catch(() => null);
    if (r?.status === "found" && r.member.contactId) return r.member.contactId;
  }
  return null;
}

async function createFollowUpTask(input: {
  contactId: string | null;
  subject: string;
  description: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const client = await getSalesforceRestClient();
  if (!client) return { ok: false, error: "Salesforce not configured" };
  const base = `${client.instanceUrl}/services/data/${SF_VERSION}`;
  const headers = { Authorization: `Bearer ${client.accessToken}`, "Content-Type": "application/json" };

  const q = `SELECT Id FROM User WHERE Email = '${TASK_OWNER_EMAIL}' AND IsActive = true LIMIT 1`;
  const userRes = await fetch(`${base}/query?q=${encodeURIComponent(q)}`, { headers });
  const ownerId = userRes.ok ? ((await userRes.json()) as { records?: { Id: string }[] }).records?.[0]?.Id : undefined;
  if (!ownerId) return { ok: false, error: `No active Salesforce user ${TASK_OWNER_EMAIL}` };

  const due = new Date();
  due.setUTCDate(due.getUTCDate() + 2);
  const res = await fetch(`${base}/sobjects/Task`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ...(input.contactId ? { WhoId: input.contactId } : {}),
      OwnerId: ownerId,
      Subject: input.subject.slice(0, 255),
      Description: input.description.slice(0, 32000),
      Status: "Not Started",
      Priority: "Normal",
      ActivityDate: due.toISOString().slice(0, 10),
    }),
  });
  if (!res.ok) return { ok: false, error: `Task create failed (${res.status}): ${(await res.text()).slice(0, 300)}` };
  const id = ((await res.json()) as { id?: string }).id;
  if (!id) return { ok: false, error: "Task create returned no id" };

  // Org automation overwrites Subject on insert; set ours afterwards.
  await fetch(`${base}/sobjects/Task/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ Subject: input.subject.slice(0, 255) }),
  }).catch(() => null);
  return { ok: true, id };
}

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

  const contactId = await findContactId(i);
  const task = await createFollowUpTask({
    contactId,
    subject: `Detector Academy lead: contact ${name} ${contactPhrase}`,
    description: `Interested in the LDMA Detector Academy (Stanton, early March 2027).\n\n${summary}`,
  }).catch((e) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) }));
  if (!task.ok) errors.push(task.error);

  const emailed = await sendDetectorAcademyLeadEmail({
    to: LEAD_NOTIFY_EMAILS,
    name,
    contactPhrase,
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
