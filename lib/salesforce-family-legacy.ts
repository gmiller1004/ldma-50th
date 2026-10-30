/**
 * Salesforce writes for the Family Legacy offer: resolve the contact owner, create the follow-up Task,
 * and set Legacy_Offer_Status__c.
 */

import { getSalesforceRestClient } from "@/lib/salesforce";
import { FAMILY_LEGACY_FALLBACK_OWNER_EMAIL } from "@/lib/family-legacy-offer";

const SF_VERSION = "v59.0";

export type SalesforceAssignee = {
  userId: string;
  name: string;
  email: string;
  isFallback: boolean;
};

type SfResult<T> = { ok: true; value: T } | { ok: false; error: string };

async function sfFetch(path: string, init?: RequestInit): Promise<Response | null> {
  const client = await getSalesforceRestClient();
  if (!client) return null;
  return fetch(`${client.instanceUrl}/services/data/${SF_VERSION}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${client.accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

function soqlEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export async function salesforceContactUrl(contactId: string): Promise<string | null> {
  const client = await getSalesforceRestClient();
  return client ? `${client.instanceUrl}/lightning/r/Contact/${contactId}/view` : null;
}

/** Contact owner when active; otherwise the fallback user (Gen). */
export async function resolveFamilyLegacyAssignee(contactId: string): Promise<SfResult<SalesforceAssignee>> {
  const res = await sfFetch(
    `/sobjects/Contact/${encodeURIComponent(contactId)}?fields=OwnerId,Owner.Name,Owner.Email,Owner.IsActive`
  );
  if (!res) return { ok: false, error: "Salesforce not configured" };
  if (res.ok) {
    const c = (await res.json()) as {
      OwnerId?: string;
      Owner?: { Name?: string; Email?: string; IsActive?: boolean } | null;
    };
    if (c.OwnerId && c.Owner?.IsActive && c.Owner.Email) {
      return {
        ok: true,
        value: { userId: c.OwnerId, name: c.Owner.Name ?? "Contact owner", email: c.Owner.Email, isFallback: false },
      };
    }
  } else {
    console.error("[family-legacy] contact owner lookup failed:", res.status, await res.text());
  }

  const q = `SELECT Id, Name, Email FROM User WHERE Email = '${soqlEscape(FAMILY_LEGACY_FALLBACK_OWNER_EMAIL)}' AND IsActive = true LIMIT 1`;
  const fallback = await sfFetch(`/query?q=${encodeURIComponent(q)}`);
  if (!fallback?.ok) return { ok: false, error: `Fallback owner lookup failed (${fallback?.status ?? "no client"})` };
  const user = ((await fallback.json()) as { records?: { Id: string; Name: string; Email: string }[] }).records?.[0];
  if (!user) return { ok: false, error: `No active Salesforce user with email ${FAMILY_LEGACY_FALLBACK_OWNER_EMAIL}` };
  return { ok: true, value: { userId: user.Id, name: user.Name, email: user.Email, isFallback: true } };
}

export async function createFamilyLegacyTask(input: {
  contactId: string;
  ownerId: string;
  subject: string;
  description: string;
  dueDate: string;
}): Promise<SfResult<string>> {
  const res = await sfFetch("/sobjects/Task", {
    method: "POST",
    body: JSON.stringify({
      WhoId: input.contactId,
      OwnerId: input.ownerId,
      Subject: input.subject.slice(0, 255),
      Description: input.description.slice(0, 32000),
      Status: "Not Started",
      Priority: "High",
      ActivityDate: input.dueDate,
    }),
  });
  if (!res) return { ok: false, error: "Salesforce not configured" };
  if (!res.ok) return { ok: false, error: `Task create failed (${res.status}): ${(await res.text()).slice(0, 300)}` };
  const body = (await res.json()) as { id?: string };
  if (!body.id) return { ok: false, error: "Task create returned no id" };

  // Org automation overwrites Subject on insert with "<contact name> <reason>"; set ours afterwards.
  const rename = await sfFetch(`/sobjects/Task/${body.id}`, {
    method: "PATCH",
    body: JSON.stringify({ Subject: input.subject.slice(0, 255) }),
  });
  if (!rename?.ok) console.error("[family-legacy] task subject update failed:", rename?.status);
  return { ok: true, value: body.id };
}

export async function setLegacyOfferStatus(contactId: string, status: string): Promise<SfResult<true>> {
  const res = await sfFetch(`/sobjects/Contact/${encodeURIComponent(contactId)}`, {
    method: "PATCH",
    body: JSON.stringify({ Legacy_Offer_Status__c: status }),
  });
  if (!res) return { ok: false, error: "Salesforce not configured" };
  if (!res.ok) return { ok: false, error: `Status update failed (${res.status}): ${(await res.text()).slice(0, 300)}` };
  return { ok: true, value: true };
}
