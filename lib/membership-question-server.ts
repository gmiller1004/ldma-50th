/**
 * Membership question leads: save the submission, find the person in Salesforce, add a follow-up
 * Task for Member Services, email Gen and Nannette, and add email leads to Klaviyo.
 */

import { sql, hasDb } from "@/lib/db";
import { salesforceContactUrl } from "@/lib/salesforce-family-legacy";
import { subscribeEmailToKlaviyoMarketing } from "@/lib/klaviyo-marketing-subscribe";
import { sendMemberServicesLeadEmail } from "@/lib/sendgrid";
import { createMemberServicesTask, findLeadContactId, MEMBER_SERVICES_LEAD_EMAILS } from "@/lib/member-services-leads";
import {
  buildMembershipQuestionSummary,
  membershipContactPhrase,
  type MembershipQuestionInput,
} from "@/lib/membership-question";

/** `notified` is false only when neither the Salesforce Task nor the Member Services email went out. */
export async function submitMembershipQuestion(
  i: MembershipQuestionInput
): Promise<{ notified: boolean; errors: string[] }> {
  const errors: string[] = [];
  let leadId: string | null = null;
  if (hasDb() && sql) {
    const rows = (await sql`
      INSERT INTO membership_questions (first_name, last_name, contact_method, email, phone, questions)
      VALUES (
        ${i.firstName}, ${i.lastName || null}, ${i.contactMethod}, ${i.email || null}, ${i.phone || null},
        ${i.questions || null}
      )
      RETURNING id
    `) as { id: string }[];
    leadId = rows[0]?.id ?? null;
  }

  const name = [i.firstName, i.lastName].filter(Boolean).join(" ");
  const summary = buildMembershipQuestionSummary(i);
  const contactPhrase = membershipContactPhrase(i);

  const contactId = await findLeadContactId(i);
  const task = await createMemberServicesTask({
    contactId,
    subject: `Membership question: contact ${name} ${contactPhrase}`,
    description: `Has questions about LDMA membership (memberships page).\n\n${summary}`,
  }).catch((e) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) }));
  if (!task.ok) errors.push(task.error);

  const emailed = await sendMemberServicesLeadEmail({
    to: MEMBER_SERVICES_LEAD_EMAILS,
    heading: "New membership question",
    subject: `Membership question: ${name}, contact ${contactPhrase}`,
    intro: `${name} has questions about LDMA membership and would like to be contacted ${contactPhrase}.`,
    summary,
    salesforceUrl: contactId ? await salesforceContactUrl(contactId) : null,
    taskCreated: task.ok,
  });
  if (!emailed) errors.push("Member Services email failed");

  let klaviyoSynced = false;
  if (i.email) {
    const sub = await subscribeEmailToKlaviyoMarketing(
      i.email,
      "membership_questions",
      {
        interest_path: "memberships",
        referrer_cta: "membership_questions_modal",
        preferred_contact: i.contactMethod,
        membership_questions_submitted: "true",
      },
      i.firstName
    );
    klaviyoSynced = sub.ok;
    if (!sub.ok) errors.push(`Klaviyo: ${sub.error ?? "subscribe failed"}`);
  }

  if (leadId && sql) {
    await sql`
      UPDATE membership_questions
      SET sf_contact_id = ${contactId}, sf_task_id = ${task.ok ? task.id : null},
          staff_notified_at = ${emailed ? new Date().toISOString() : null},
          klaviyo_synced_at = ${klaviyoSynced ? new Date().toISOString() : null},
          last_error = ${errors.length ? errors.join(" | ") : null}
      WHERE id = ${leadId}
    `;
  }
  if (errors.length) console.error("[membership-question]", errors.join(" | "));
  return { notified: task.ok || emailed, errors };
}
