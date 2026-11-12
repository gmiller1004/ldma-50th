/**
 * Shared follow-up for website lead forms: find the person in Salesforce and add a follow-up Task
 * for Member Services. Lead emails go to Gen and Nannette.
 */

import { getSalesforceRestClient, searchMembersForCaretaker } from "@/lib/salesforce";

const SF_VERSION = "v59.0";
/** Member Services user who owns the Salesforce follow-up Task. */
const TASK_OWNER_EMAIL = "gricci@goldprospectors.org";
export const MEMBER_SERVICES_LEAD_EMAILS = ["gricci@goldprospectors.org", "nmathis@lostdutchmans.com"];

export async function findLeadContactId(lead: { email?: string; phone?: string }): Promise<string | null> {
  const lookups = [lead.email ? { email: lead.email } : null, lead.phone ? { phone: lead.phone } : null].filter(
    (l): l is { email: string } | { phone: string } => l !== null
  );
  for (const lookup of lookups) {
    const r = await searchMembersForCaretaker(lookup).catch(() => null);
    if (r?.status === "found" && r.member.contactId) return r.member.contactId;
  }
  return null;
}

export async function createMemberServicesTask(input: {
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
