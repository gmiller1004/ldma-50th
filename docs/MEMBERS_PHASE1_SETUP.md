# Members Phase 1 — What You Need to Provide

Phase 1 implements **auth + Salesforce lookup + basic profile**. The UI, routes, and flow are in place; these pieces require your credentials and configuration.

---

## 1. Salesforce

### Auth: Client Credentials flow (recommended for External Client Apps)

Uses only Client ID and Client Secret — no username or password. Works with External Client Apps.

**In Salesforce (External Client App):**

1. **App Manager** → your app (e.g. MyLDMA Member Auth) → **Manage**
2. **Edit** → **API (OAuth)** → enable **Client Credentials Flow**
3. **Policies** → under **OAuth Flows** find **Client Credentials Flow** → set **Run As** to a Salesforce user (integration user) that has API access and can read/update Contacts
4. Save

The **Run As** user runs all API calls on behalf of the app. Create a dedicated integration user if needed (with API Enabled and access to Contact records).

**Env vars:** `SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET`, `SALESFORCE_DOMAIN`, `SALESFORCE_AUTH_METHOD=client_credentials`

### API access (legacy: Password flow)

- **Classic Connected App** with:
  - Client ID
  - Client Secret
  - Grant type: Password (or OAuth 2.0 Resource Owner Password)
- Or a **Username/Password flow** with:
  - Username (Salesforce login)
  - Password (password + security token concatenated)
  - Consumer Key + Consumer Secret from the Connected App

### Field mapping (configured)

| Purpose | Field | Notes |
|--------|-------|-------|
| Member number | `Customer_Number__c` | Matches what member enters |
| Active membership | `Active_Membership_Type__c` or `Is_New_LDMA_Member__c` | Logic for “is active” |
| Dues owed | `Maintenance_Min_0_Email__c` | Shown on profile |
| Maintenance paid thru | `Maintenance_Paid_Thru_Date__c` | Shown on profile |
| Shipping address | `OtherStreet`, `OtherCity`, `OtherState`, `OtherPostalCode` | Editable; updates set `Shipping_Same_As_Billing__c` = false |
| Phone | `Phone` | Editable |
| Maintenance exempt | `Maintenance_Exempt__c` | When 'Yes', hide dues |
| AutoPay | `Is_On_Auto_Pay__c`, `LDMA_Auto_Pay_Shopify__c` | Either true → show AutoPay note |

---

## 2. SendGrid

- **API key** with send permissions
- **Verified sender/domain** for sending login codes
- Optionally, a template ID for the code email (or we use a simple text body)

---

## 3. Upstash Redis (for 6‑digit codes)

- Create a database at [Upstash Console](https://console.upstash.com)
- Or use the **Upstash Redis** integration in the Vercel marketplace
- Env vars:
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`

---

## 4. Environment variables

Add to `.env.local` (and to Vercel env vars for production):

```env
# Salesforce - Client Credentials flow (for External Client Apps)
SALESFORCE_CLIENT_ID=
SALESFORCE_CLIENT_SECRET=
SALESFORCE_DOMAIN=gpaa.my.salesforce.com
SALESFORCE_AUTH_METHOD=client_credentials

# Only for password flow (classic Connected Apps, deprecated):
# SALESFORCE_AUTH_METHOD=password
# SALESFORCE_USERNAME=
# SALESFORCE_PASSWORD=
# SALESFORCE_SECURITY_TOKEN=

# SendGrid
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
SENDGRID_FROM_NAME=LDMA

# Upstash Redis (auth codes)
# Upstash Redis - either set of names works:
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
# Or (Vercel KV / Upstash integration):
# KV_REST_API_URL=
# KV_REST_API_TOKEN=

# Session secret (generate a random string, e.g. openssl rand -hex 32)
MEMBER_SESSION_SECRET=

# Optional: URL for "make a payment" link. Append ?amount=X when member has dues.
# See docs/MEMBERS_MAINTENANCE_PAYMENT.md for setup.
# MEMBER_MAINTENANCE_PAYMENT_URL=
```

---

## What’s already built

- Auth UI: member number input, code entry, error states
- API routes: `/api/members/lookup`, `/api/members/send-code`, `/api/members/verify-code`, `/api/members/logout`, `/api/members/me`
- Protected member area: `/members` (redirects to login if not authenticated)
- Profile page: `/members/profile` with Salesforce contact fields
- Session handling via signed HTTP-only cookies
- Redis integration for 6-digit codes with 10-minute TTL
- Members link added to main navbar

## Local dev without credentials

For local testing without full credentials:

- **Salesforce**: If not configured, a mock lookup accepts any 3+ character member number and returns fake data
- **Redis**: If not configured, an in-memory store is used (codes work within the same dev server instance)
- **SendGrid**: If not configured, the 6-digit code is logged to the console
- **MEMBER_SESSION_SECRET**: If not set, a dev default is used (change for production)

Once credentials and field names are set, the live integrations will be used automatically.
