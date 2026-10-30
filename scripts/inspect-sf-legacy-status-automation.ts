/**
 * Read-only by default: find Salesforce automation that depends on Contact.Legacy_Offer_Status__c,
 * show the picklist definition, and summarize who owns active LDMA contacts.
 *
 *   npx tsx --env-file=.env.local scripts/inspect-sf-legacy-status-automation.ts
 *   npx tsx --env-file=.env.local scripts/inspect-sf-legacy-status-automation.ts --test-task <contactId>
 *     (creates one Task owned by the contact's owner, reads it back, then deletes it)
 */
import { getSalesforceRestClient } from "@/lib/salesforce";

const API = "v60.0";
const FIELD = "Legacy_Offer_Status__c";

async function main() {
  const client = await getSalesforceRestClient();
  if (!client) throw new Error("Salesforce not configured");
  const base = `${client.instanceUrl}/services/data/${API}`;
  const headers = { Authorization: `Bearer ${client.accessToken}`, "Content-Type": "application/json" };

  const get = async (path: string) => {
    const res = await fetch(`${base}${path}`, { headers });
    const body = await res.json().catch(() => null);
    if (!res.ok) return { error: `${res.status} ${JSON.stringify(body).slice(0, 300)}` } as Record<string, unknown>;
    return body as Record<string, unknown>;
  };
  const query = (soql: string, tooling = false) =>
    get(`${tooling ? "/tooling" : ""}/query?q=${encodeURIComponent(soql)}`);

  const whoami = await get("/chatter/users/me");
  console.log(`Integration user: ${whoami.name ?? "?"} (${whoami.id ?? whoami.error})`);

  const describe = await get("/sobjects/Contact/describe");
  const field = ((describe.fields as Record<string, unknown>[] | undefined) ?? []).find((f) => f.name === FIELD);
  if (field) {
    const values = (field.picklistValues as { value: string; active: boolean }[]).map(
      (v) => `${v.value}${v.active ? "" : " (inactive)"}`
    );
    console.log(`\n${FIELD}: type ${field.type}, restricted ${field.restrictedPicklist}, updateable ${field.updateable}`);
    console.log(`  values: ${values.join(" | ")}`);
  } else {
    console.log(`\n${FIELD}: not found in describe (${describe.error ?? "no access"})`);
  }

  const deps = await query(
    `SELECT MetadataComponentType, MetadataComponentName FROM MetadataComponentDependency WHERE RefMetadataComponentName = '${FIELD}' OR RefMetadataComponentName = 'Contact.${FIELD}'`,
    true
  );
  console.log(`\nMetadata that references the field (dependency API):`);
  if (deps.error) console.log(`  unavailable: ${deps.error}`);
  for (const d of (deps.records as Record<string, string>[] | undefined) ?? []) {
    console.log(`  ${d.MetadataComponentType}: ${d.MetadataComponentName}`);
  }

  const triggers = await query(`SELECT Name, TableEnumOrId, Status, Body FROM ApexTrigger WHERE TableEnumOrId = 'Contact'`, true);
  console.log(`\nContact Apex triggers:`);
  if (triggers.error) console.log(`  unavailable: ${triggers.error}`);
  for (const t of (triggers.records as Record<string, string>[] | undefined) ?? []) {
    const hits = (t.Body ?? "").split("\n").filter((l) => l.includes(FIELD)).map((l) => l.trim());
    console.log(`  ${t.Name} (${t.Status})${hits.length ? "" : " — does not reference the field"}`);
    for (const h of hits) console.log(`      ${h}`);
  }

  const classes = await query(`SELECT Name, Status, Body FROM ApexClass WHERE NamespacePrefix = null`, true);
  console.log(`\nApex classes referencing the field:`);
  if (classes.error) console.log(`  unavailable: ${classes.error}`);
  for (const c of (classes.records as Record<string, string>[] | undefined) ?? []) {
    if ((c.Body ?? "").includes(FIELD)) console.log(`  ${c.Name} (${c.Status})`);
  }

  const vrs = await query(
    `SELECT Id, ValidationName, Active FROM ValidationRule WHERE EntityDefinition.QualifiedApiName = 'Contact'`,
    true
  );
  console.log(`\nContact validation rules referencing the field:`);
  if (vrs.error) console.log(`  unavailable: ${vrs.error}`);
  for (const v of (vrs.records as Record<string, string>[] | undefined) ?? []) {
    const full = await get(`/tooling/sobjects/ValidationRule/${v.Id}`);
    const formula = String((full.Metadata as Record<string, unknown> | undefined)?.errorConditionFormula ?? "");
    if (formula.includes(FIELD)) console.log(`  ${v.ValidationName} (active ${v.Active}): ${formula.replace(/\s+/g, " ")}`);
  }

  const flows = await query(
    `SELECT Id, MasterLabel, ProcessType, Status, Definition.DeveloperName FROM Flow WHERE Status = 'Active'`,
    true
  );
  console.log(`\nActive flows / processes referencing the field:`);
  if (flows.error) console.log(`  unavailable: ${flows.error}`);
  const flowRecords = (flows.records as Record<string, string>[] | undefined) ?? [];
  let checked = 0;
  for (const f of flowRecords) {
    const full = await get(`/tooling/sobjects/Flow/${f.Id}`);
    checked++;
    const text = JSON.stringify(full.Metadata ?? {});
    if (text.includes(FIELD)) {
      const meta = full.Metadata as Record<string, unknown>;
      const start = meta.start as Record<string, unknown> | undefined;
      console.log(`  ${f.MasterLabel} [${f.ProcessType}] object=${start?.object ?? "?"} trigger=${start?.recordTriggerType ?? "?"}`);
    }
  }
  console.log(`  (scanned ${checked} active flows)`);

  const wf = await query(`SELECT Id, Name, TableEnumOrId FROM WorkflowRule WHERE TableEnumOrId = 'Contact'`, true);
  console.log(`\nContact workflow rules referencing the field:`);
  if (wf.error) console.log(`  unavailable: ${wf.error}`);
  for (const w of (wf.records as Record<string, string>[] | undefined) ?? []) {
    const full = await get(`/tooling/sobjects/WorkflowRule/${w.Id}`);
    if (JSON.stringify(full.Metadata ?? {}).includes(FIELD)) console.log(`  ${w.Name}`);
  }

  const owners = await query(
    `SELECT Owner.Name, Owner.Email, Owner.IsActive, COUNT(Id) n FROM Contact
     WHERE (Active_Membership_Type__c = 'LDMA' OR Active_Membership_Type_Text_Copy__c = 'LDMA' OR Is_New_LDMA_Member__c = true)
     GROUP BY Owner.Name, Owner.Email, Owner.IsActive ORDER BY COUNT(Id) DESC`
  );
  console.log(`\nOwners of active LDMA contacts:`);
  if (owners.error) console.log(`  unavailable: ${owners.error}`);
  for (const o of (owners.records as Record<string, unknown>[] | undefined) ?? []) {
    console.log(`  ${o.Name} <${o.Email}> active=${o.IsActive} · ${o.n}`);
  }

  const testIdx = process.argv.indexOf("--test-task");
  if (testIdx > 0) {
    const contactId = process.argv[testIdx + 1];
    const contact = (await get(`/sobjects/Contact/${contactId}?fields=Id,Name,OwnerId,Owner.Name,Owner.Email`)) as Record<string, unknown>;
    if (contact.error) throw new Error(`contact lookup failed: ${contact.error}`);
    const owner = contact.Owner as Record<string, string>;
    console.log(`\nTest Task on ${contact.Name}, owner ${owner?.Name} <${owner?.Email}>`);
    const created = await fetch(`${base}/sobjects/Task`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        WhoId: contactId,
        OwnerId: contact.OwnerId,
        Subject: "TEST — myldma.com integration check (auto-deleted)",
        Description: "Automated permission test from the website integration. Safe to ignore.",
        Status: "Not Started",
        Priority: "Normal",
        ActivityDate: new Date().toISOString().slice(0, 10),
      }),
    });
    const createdBody = (await created.json()) as Record<string, unknown> | Record<string, unknown>[];
    if (!created.ok) {
      console.log(`  CREATE FAILED ${created.status}: ${JSON.stringify(createdBody)}`);
      return;
    }
    const taskId = (createdBody as Record<string, string>).id;
    const readBack = await get(`/sobjects/Task/${taskId}?fields=Id,Subject,OwnerId,WhoId,Status`);
    console.log(`  created ${taskId}: owner ${readBack.OwnerId} who ${readBack.WhoId} status ${readBack.Status}`);
    // The integration user can only delete Tasks it owns.
    await fetch(`${base}/sobjects/Task/${taskId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ OwnerId: whoami.id }),
    });
    const del = await fetch(`${base}/sobjects/Task/${taskId}`, { method: "DELETE", headers });
    console.log(`  deleted: ${del.ok ? "yes" : `NO (${del.status} ${await del.text()})`}`);
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
