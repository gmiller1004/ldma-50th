/**
 * Read-only: Salesforce counts for legacy add-on holders, and the emails of contacts whose
 * Legacy_Offer_Status__c is "Completed Offer" (written to a local file for the Klaviyo exclusion list).
 *
 *   npx tsx --env-file=.env.local scripts/inspect-sf-legacy-completed.ts [outFile.json]
 */
import { writeFileSync } from "node:fs";
import { getSalesforceRestClient } from "@/lib/salesforce";

async function main() {
  const out = process.argv[2];
  const sf = await getSalesforceRestClient();
  if (!sf) throw new Error("Salesforce not configured");
  const headers = { Authorization: `Bearer ${sf.accessToken}` };
  const q = async (soql: string) => {
    const res = await fetch(`${sf.instanceUrl}/services/data/v59.0/query?q=${encodeURIComponent(soql)}`, { headers });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return (await res.json()) as { totalSize: number; records: Record<string, unknown>[]; nextRecordsUrl?: string };
  };
  const queryAll = async (soql: string) => {
    let page = await q(soql);
    const records = [...page.records];
    while (page.nextRecordsUrl) {
      const res = await fetch(`${sf.instanceUrl}${page.nextRecordsUrl}`, { headers });
      page = (await res.json()) as typeof page;
      records.push(...page.records);
    }
    return records;
  };

  const statusCounts = await q(
    `SELECT Legacy_Offer_Status__c s, COUNT(Id) n FROM Contact WHERE Legacy_Offer_Status__c != null GROUP BY Legacy_Offer_Status__c`
  );
  console.log("Legacy Offer Status counts:");
  for (const r of statusCounts.records) console.log(`  ${r.s}: ${r.n}`);

  const allThree = await q(
    `SELECT COUNT() FROM Contact WHERE Is_Transferable__c = true AND Is_Companion__c = true AND Is_PrePay_Transfer__c = true`
  );
  console.log(`Contacts with all three add-on boxes checked: ${allThree.totalSize}`);

  const completed = await queryAll(
    `SELECT Id, Email, Customer_Number__c FROM Contact WHERE Legacy_Offer_Status__c = 'Completed Offer'`
  );
  const emails = [...new Set(completed.map((c) => String(c.Email ?? "").trim().toLowerCase()).filter((e) => e.includes("@")))];
  console.log(`\nCompleted Offer contacts: ${completed.length}, with an email: ${emails.length}`);
  if (out) {
    writeFileSync(out, JSON.stringify(emails));
    console.log(`Emails written to ${out}`);
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
