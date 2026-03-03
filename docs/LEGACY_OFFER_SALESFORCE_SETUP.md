# Legacy Offer — Salesforce Setup (Step by Step)

When a rep sets `Legacy_Offer_Status__c` to **"Reviewed - Email Sent"** on a Contact, Salesforce calls our app to send the offer email. The three checkboxes indicate **what the member already has**. Based on that, we send the appropriate offer.

---

## Sandbox vs Production

**If you can't create Apex directly in Production** (e.g. no "New" button in Apex Classes), do the setup in a **Developer Sandbox** first, then deploy to Production with a Change Set.

- **Part A** — Do all steps in your sandbox (once it's active).
- **Part B** — Deploy to Production and finish configuration there.

---

## Before You Start

1. Ensure these Contact fields exist: `Legacy_Offer_Request_Date__c`, `Legacy_Offer_Status__c`, `Is_Transferable__c`, `Is_Companion__c`, `Is_PrePay_Transfer__c`.
2. Generate your webhook secret: run `openssl rand -hex 32` in a terminal. Save the output.
3. Add `SALESFORCE_WEBHOOK_SECRET` to Vercel (Environment Variables) using that same value.
4. If using a sandbox: wait until the sandbox shows **Active**, then open it and do the following steps there.

---

## Step 1: Create Remote Site Setting

1. In Salesforce, click the **gear icon** (Setup).
2. In Quick Find, type **Remote Site Settings**.
3. Click **Remote Site Settings**.
4. Click **New Remote Site**.
5. Fill in:
   - **Remote Site Name:** `LDMA_Webhook`
   - **Remote Site URL:** `https://ldma-50th.vercel.app` (or your production domain)
6. Click **Save**.

---

## Step 2: Create Custom Setting for the Webhook Secret

1. Setup → Quick Find: **Custom Settings**.
2. Click **Custom Settings**.
3. Click **New**.
4. Fill in:
   - **Label:** `LDMA Webhook Setting`
   - **Object Name:** `LDMA_Webhook_Setting` (auto-fills)
   - **Setting Type:** Hierarchical
   - **Visibility:** Public (use Public if Protected is greyed out)
5. Click **Save**.
6. Click **New** next to Custom Fields.
7. Create field:
   - **Field Label:** `Secret`
   - **Field Name:** `Secret`
   - **Data Type:** Text
   - **Length:** 64
8. Click **Save**.
9. Go to **Setup → Custom Settings → LDMA Webhook Setting**.
10. Click **Manage**.
11. Click **New** (or edit the default org-level record).
12. Set **Secret** to the value from `openssl rand -hex 32` (the same value as `SALESFORCE_WEBHOOK_SECRET` in Vercel).
13. Click **Save**.

---

## Step 3: Create the Apex Class

1. Setup → Quick Find: **Apex Classes**.
2. Click **Apex Classes** → **New**.
3. Name: `LegacyOfferEmailCallout`.
4. Paste the code below (replace any default content).
5. Click **Save**.

*(If "New" is not available, use Developer Console: File → New → Apex Class.)*

```apex
public with sharing class LegacyOfferEmailCallout {
    private static final String WEBHOOK_URL = 'https://ldma-50th.vercel.app/api/salesforce/legacy-offer-email';

    @future(callout=true)
    public static void sendLegacyOfferEmail(Id contactId) {
        Contact c = [
            SELECT Id, Email, FirstName, Is_Transferable__c, Is_Companion__c, Is_PrePay_Transfer__c
            FROM Contact
            WHERE Id = :contactId
            LIMIT 1
        ];
        if (c.Email == null || c.Email == '') {
            return;
        }

        LDMA_Webhook_Setting__c setting = LDMA_Webhook_Setting__c.getInstance();
        String secret = setting != null ? setting.Secret__c : null;
        if (secret == null || secret == '') {
            throw new CalloutException('LDMA Webhook Secret is not configured. Set it in LDMA Webhook Setting.');
        }

        HttpRequest req = new HttpRequest();
        req.setEndpoint(WEBHOOK_URL);
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setHeader('Authorization', 'Bearer ' + secret);
        req.setBody(JSON.serialize(new Map<String, Object>{
            'email' => c.Email,
            'firstName' => c.FirstName,
            'isTransferable' => c.Is_Transferable__c == true,
            'isCompanion' => c.Is_Companion__c == true,
            'isPrePay' => c.Is_PrePay_Transfer__c == true
        }));
        req.setTimeout(120000);

        Http http = new Http();
        HttpResponse res = http.send(req);
        if (res.getStatusCode() != 200) {
            throw new CalloutException('Legacy offer email failed: ' + res.getStatusCode() + ' ' + res.getStatus());
        }
    }
}
```

**Note:** If your Custom Setting field is named `Secret__c`, the code uses that. If you named it differently, change `Secret__c` in the code to match.

---

## Step 4: Create the Apex Trigger

1. Setup → Quick Find: **Apex Triggers**.
2. Click **Apex Triggers** → **New**.
3. Fill in:
   - **Name:** `ContactLegacyOfferTrigger`
   - **sObject:** Contact
4. Paste the trigger code below (replace any default content).
5. Click **Save**.

*(If "New" is not available, use Developer Console: File → New → Apex Trigger.)*

```apex
trigger ContactLegacyOfferTrigger on Contact (after update) {
    for (Contact c : Trigger.new) {
        Contact old = Trigger.oldMap.get(c.Id);
        if (old.Legacy_Offer_Status__c != 'Reviewed - Email Sent' &&
            c.Legacy_Offer_Status__c == 'Reviewed - Email Sent') {
            LegacyOfferEmailCallout.sendLegacyOfferEmail(c.Id);
        }
    }
}
```

---

## Step 4b: Create the Apex Test Class (Required for Production Deployment)

Salesforce requires test coverage to deploy to Production. Create this test class in your sandbox, then add it to your Change Set.

1. Setup → Quick Find: **Apex Classes** → **New**.
2. Name: `LegacyOfferEmailCalloutTest`.
3. Paste the code below.
4. Click **Save**.
5. Add `LegacyOfferEmailCalloutTest` to your Outbound Change Set (Step B1).

```apex
@isTest
private class LegacyOfferEmailCalloutTest {
    @testSetup
    static void setup() {
        // Create Custom Setting record (required for getInstance)
        LDMA_Webhook_Setting__c setting = new LDMA_Webhook_Setting__c(
            Name = 'Org',
            Secret__c = 'test-secret-for-unit-test'
        );
        insert setting;

        Contact c = new Contact(
            FirstName = 'Test',
            LastName = 'User',
            Email = 'test@example.com'
        );
        insert c;
    }

    @isTest
    static void testSendLegacyOfferEmail() {
        Test.setMock(HttpCalloutMock.class, new LegacyOfferMock());
        Contact c = [SELECT Id FROM Contact WHERE Email = 'test@example.com' LIMIT 1];

        Test.startTest();
        LegacyOfferEmailCallout.sendLegacyOfferEmail(c.Id);
        Test.stopTest();

        // No exception = success
    }

    private class LegacyOfferMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            res.setStatusCode(200);
            res.setBody('{"ok":true}');
            return res;
        }
    }
}
```

---

## Step 5: Add Contact Fields to Page Layout

1. Setup → **Object Manager** → **Contact**.
2. Click **Page Layouts** → your main layout (e.g. Contact Layout).
3. Add the legacy offer fields to a section if they’re not already there:
   - `Legacy Offer Request Date`
   - `Legacy Offer Status`
   - `Is Transferable`
   - `Is Companion`
   - `Is PrePay Transfer`
4. **Save**.

---

## Step 6: Test (in Sandbox)

1. Open a test Contact with a valid email.
2. Set the three checkboxes to match what the member **already has** (see table below).
3. Set **Legacy Offer Status** to **Reviewed - Email Sent**.
4. Save the Contact.
5. Confirm the member receives the email and the profile card shows the offer when they log in.

---

## Part B: Deploy Sandbox to Production

*(Skip this section if you set everything up directly in Production.)*

### Step B1: Create Outbound Change Set in Sandbox

1. In your **sandbox**, go to Setup → Quick Find: **Outbound Change Sets**.
2. Click **Outbound Change Sets** → **New**.
3. Name: `Legacy Offer Integration` (or similar).
4. Click **Save**.
5. Click **Add** next to the appropriate section and add:
   - **Apex Classes:** `LegacyOfferEmailCallout`, `LegacyOfferEmailCalloutTest`
   - **Apex Triggers:** `ContactLegacyOfferTrigger`
   - **Custom Settings:** `LDMA_Webhook_Setting`
   - **Custom Setting Fields:** the Secret field
   - **Remote Site Settings:** `LDMA_Webhook` (if available)
6. Click **Upload**.
7. Select your **Production** org and click **Upload**.
8. Wait for the upload to complete.

### Step B2: Deploy in Production

1. Switch to your **Production** org.
2. Setup → Quick Find: **Inbound Change Sets**.
3. Click **Inbound Change Sets**.
4. Find your change set and click **Deploy**.
5. On the deploy screen, select **Run Specified Tests** (not "Run Local Tests") and add only: `LegacyOfferEmailCalloutTest`.
   - *This avoids failing on unrelated org tests while still validating the new Apex code.*
6. Click **Deploy** again to confirm.
7. Wait for the deployment to finish.

### Step B3: Configure Production (Manual Steps)

Some items don't deploy with change sets. In **Production**:

1. **Remote Site Setting** — If it didn't deploy, create it manually (Step 1).
2. **Custom Setting Secret** — Change Set does not deploy the Secret value. Go to Setup → Custom Settings → LDMA Webhook Setting → **Manage** → edit the org-level record and set **Secret** to your webhook secret (same as `SALESFORCE_WEBHOOK_SECRET` in Vercel).

### Step B4: Test in Production

1. Open a test Contact in Production.
2. Set the checkboxes and **Legacy Offer Status** to **Reviewed - Email Sent**.
3. Save and confirm the email is sent.

---

## Quick Reference: Checkboxes → Offer

The checkboxes indicate **what the member already has**.

| Is Transferable | Is Companion | Is PrePay Transfer | What we send |
|-----------------|--------------|--------------------|--------------|
| ☐ | ☐ | ☐ | Full package — $1,000 |
| ☑ | ☐ | ☐ | Companion + PrePay — $750 |
| ☐ | ☑ | ☐ | Transferability + PrePay — $750 |
| ☑ | ☐ | ☑ | Companion only — $500 |
| ☑ | ☑ | ☐ | PrePay only — $500 |
| ☑ | ☑ | ☑ | No email (has everything) |

**PrePay cannot be checked without Transferable.**

---

## Troubleshooting

- **"Secret is not configured"** — Create a record in LDMA Webhook Setting and set the Secret field.
- **"Legacy offer email failed: 401"** — The secret in Salesforce doesn’t match `SALESFORCE_WEBHOOK_SECRET` in Vercel.
- **No email received** — Check SendGrid, spam, and that the Contact has a valid email.
