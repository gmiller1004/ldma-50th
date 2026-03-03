/**
 * Salesforce member lookup and update.
 * Field mapping:
 * - Member number: Customer_Number__c
 * - Active: Active_Membership_Type__c = 'LDMA' OR Active_Membership_Type_Text_Copy__c = 'LDMA' OR Is_New_LDMA_Member__c = true
 * - Address: OtherStreet, OtherCity, OtherState, OtherPostalCode (Shipping/Other)
 * - Shipping_Same_As_Billing__c: when updating shipping, set false so updates aren't overridden
 */

export type MemberLookupResult = {
  valid: boolean;
  active: boolean;
  contactId?: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  otherStreet?: string;
  otherCity?: string;
  otherState?: string;
  otherPostalCode?: string;
  shippingSameAsBilling?: boolean;
  duesOwed?: number;
  maintenancePaidThru?: string;
  /** Show maintenance dues (LDMA type, not exempt). When false, hide dues line. */
  showMaintenance?: boolean;
  /** Hide entire maintenance block (type not LDMA + is new member). */
  hideMaintenance?: boolean;
  maintenanceExempt?: boolean;
  isOnAutoPay?: boolean;
  /** Companion add-on: true = member has it. When true, Companion__c may hold the name. */
  companionTransferable?: boolean;
  /** Companion name (when companionTransferable is true and set). */
  companion?: string;
  /** When member requested legacy offer; used to show "already requested" state. */
  legacyOfferRequestDate?: string | null;
  /** Legacy offer status (e.g. Pending Review, Reviewed - Email Sent). */
  legacyOfferStatus?: string | null;
  /** What we're offering: Transferability, Companion, PrePay (set by rep when Reviewed). */
  isTransferable?: boolean;
  isCompanion?: boolean;
  isPrePayTransfer?: boolean;
  error?: string;
};

export async function lookupMember(memberNumber: string): Promise<MemberLookupResult> {
  const client = await getSalesforceClient();
  if (!client) {
    if (process.env.NODE_ENV === "development") {
      return mockLookup(memberNumber);
    }
    return {
      valid: false,
      active: false,
      error: "Salesforce not configured",
    };
  }

  try {
    const escaped = String(memberNumber).replace(/'/g, "\\'");
    const query = `SELECT Id, Email, Phone, FirstName, LastName, OtherStreet, OtherCity, OtherState, OtherPostalCode, Shipping_Same_As_Billing__c, Active_Membership_Type__c, Active_Membership_Type_Text_Copy__c, Is_New_LDMA_Member__c, Maintenance_Min_0_Email__c, Maintenance_Paid_Thru_Date__c, Maintenance_Exempt__c, Is_On_Auto_Pay__c, LDMA_Auto_Pay_Shopify__c, Legacy_Offer_Request_Date__c, Legacy_Offer_Status__c, Is_Transferable__c, Is_Companion__c, Is_PrePay_Transfer__c FROM Contact WHERE Customer_Number__c = '${escaped}' LIMIT 1`;
    const queryRes = await fetch(
      `${client.instanceUrl}/services/data/v59.0/query?q=${encodeURIComponent(query)}`,
      {
        headers: {
          Authorization: `Bearer ${client.accessToken}`,
        },
      }
    );

    if (!queryRes.ok) {
      const err = await queryRes.text();
      console.error("Salesforce query error:", err);
      return {
        valid: false,
        active: false,
        error: "Lookup failed",
      };
    }

    const data = (await queryRes.json()) as { records: unknown[] };
    const records = data.records || [];
    if (records.length === 0) {
      return {
        valid: false,
        active: false,
        error: "Member number not found",
      };
    }

    const c = records[0] as Record<string, unknown>;
    const hasEmail = typeof c.Email === "string" && c.Email.length > 0;
    if (!hasEmail) {
      return {
        valid: true,
        active: false,
        contactId: c.Id as string,
        error: "No email on file. Please call to update your contact information.",
      };
    }

    const membershipType = (c.Active_Membership_Type__c as string) || "";
    const membershipTypeText = (c.Active_Membership_Type_Text_Copy__c as string) || "";
    const isNewMember = c.Is_New_LDMA_Member__c === true;
    const active =
      membershipType === "LDMA" ||
      membershipTypeText === "LDMA" ||
      isNewMember;

    const maintenanceExempt =
      String((c.Maintenance_Exempt__c as string) || "").toUpperCase() === "YES";
    const isOnAutoPay =
      c.Is_On_Auto_Pay__c === true || c.LDMA_Auto_Pay_Shopify__c === true;

    const companionTransferable = c.Companion_Transferable__c === true;
    const companion =
      typeof c.Companion__c === "string" && c.Companion__c.trim()
        ? (c.Companion__c as string).trim()
        : undefined;

    // Hide maintenance section: type not LDMA AND is new member
    const hideMaintenance =
      membershipType !== "LDMA" && membershipTypeText !== "LDMA" && isNewMember;
    const showMaintenance =
      !hideMaintenance &&
      (membershipType === "LDMA" || membershipTypeText === "LDMA") &&
      !maintenanceExempt;

    const duesRaw = c.Maintenance_Min_0_Email__c;
    let duesOwed: number | undefined;
    if (typeof duesRaw === "number" && !Number.isNaN(duesRaw)) {
      duesOwed = duesRaw;
    } else if (typeof duesRaw === "string") {
      const parsed = parseFloat(duesRaw.replace(/[^0-9.-]/g, ""));
      if (!Number.isNaN(parsed)) duesOwed = parsed;
    }

    let maintenancePaidThru: string | undefined;
    const paidThru = c.Maintenance_Paid_Thru_Date__c;
    if (paidThru != null) {
      maintenancePaidThru =
        typeof paidThru === "string"
          ? paidThru
          : paidThru instanceof Date
            ? paidThru.toISOString().slice(0, 10)
            : String(paidThru);
    }

    const legacyRequestDate = c.Legacy_Offer_Request_Date__c;
    const legacyOfferRequestDate =
      legacyRequestDate != null
        ? typeof legacyRequestDate === "string"
          ? legacyRequestDate
          : legacyRequestDate instanceof Date
            ? legacyRequestDate.toISOString()
            : String(legacyRequestDate)
        : null;
    const legacyOfferStatus =
      typeof c.Legacy_Offer_Status__c === "string" ? c.Legacy_Offer_Status__c : null;

    return {
      valid: true,
      active,
      contactId: c.Id as string,
      email: c.Email as string,
      phone: (c.Phone as string) || undefined,
      firstName: (c.FirstName as string) || undefined,
      lastName: (c.LastName as string) || undefined,
      otherStreet: (c.OtherStreet as string) || undefined,
      otherCity: (c.OtherCity as string) || undefined,
      otherState: (c.OtherState as string) || undefined,
      otherPostalCode: (c.OtherPostalCode as string) || undefined,
      shippingSameAsBilling: c.Shipping_Same_As_Billing__c === true,
      duesOwed,
      maintenancePaidThru,
      showMaintenance,
      maintenanceExempt,
      isOnAutoPay,
      companionTransferable,
      companion,
      legacyOfferRequestDate: legacyOfferRequestDate ?? undefined,
      legacyOfferStatus: legacyOfferStatus ?? undefined,
      isTransferable: c.Is_Transferable__c === true,
      isCompanion: c.Is_Companion__c === true,
      isPrePayTransfer: c.Is_PrePay_Transfer__c === true,
    };
  } catch (e) {
    console.error("Salesforce lookup error:", e);
    return {
      valid: false,
      active: false,
      error: "Lookup failed",
    };
  }
}

/** Get Salesforce API client. Returns null if not configured. */
async function getSalesforceClient(): Promise<{
  accessToken: string;
  instanceUrl: string;
} | null> {
  const clientId = process.env.SALESFORCE_CLIENT_ID;
  const clientSecret = process.env.SALESFORCE_CLIENT_SECRET;
  const authMethod =
    process.env.SALESFORCE_AUTH_METHOD || "client_credentials";
  const domain = process.env.SALESFORCE_DOMAIN || "login.salesforce.com";

  if (!clientId || !clientSecret) return null;

  const tokenUrl = `https://${domain}/services/oauth2/token`;

  if (authMethod === "client_credentials") {
    // Client Credentials flow - no username/password. Requires External Client App
    // with "Run As" user assigned. Recommended for new integrations.
    const tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenRes.ok) return null;
    const { access_token, instance_url } = (await tokenRes.json()) as {
      access_token: string;
      instance_url: string;
    };
    return { accessToken: access_token, instanceUrl: instance_url };
  }

  // Password (Resource Owner) flow - for classic Connected Apps. Deprecated.
  const username = process.env.SALESFORCE_USERNAME;
  const password = process.env.SALESFORCE_PASSWORD;
  const securityToken = process.env.SALESFORCE_SECURITY_TOKEN;

  if (!username || !password) return null;

  const passwordWithToken = securityToken
    ? `${password}${securityToken}`
    : password;

  const tokenRes = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "password",
      client_id: clientId,
      client_secret: clientSecret,
      username,
      password: passwordWithToken,
    }),
  });

  if (!tokenRes.ok) return null;
  const { access_token, instance_url } = (await tokenRes.json()) as {
    access_token: string;
    instance_url: string;
  };
  return { accessToken: access_token, instanceUrl: instance_url };
}

export type ProfileUpdateInput = {
  phone?: string;
  otherStreet?: string;
  otherCity?: string;
  otherState?: string;
  otherPostalCode?: string;
};

export type UpdateContactResult = {
  success: boolean;
  error?: string;
};

/** Update Contact. When updating shipping address, sets Shipping_Same_As_Billing__c = false. */
export async function updateContact(
  contactId: string,
  input: ProfileUpdateInput
): Promise<UpdateContactResult> {
  if (process.env.NODE_ENV === "development" && contactId === "mock-contact-id") {
    return { success: true }; // Mock for dev without Salesforce
  }

  const client = await getSalesforceClient();
  if (!client) {
    return { success: false, error: "Salesforce not configured" };
  }

  const body: Record<string, unknown> = {};
  if (input.phone !== undefined) body.Phone = input.phone;
  if (input.otherStreet !== undefined) body.OtherStreet = input.otherStreet;
  if (input.otherCity !== undefined) body.OtherCity = input.otherCity;
  if (input.otherState !== undefined) body.OtherState = input.otherState;
  if (input.otherPostalCode !== undefined) body.OtherPostalCode = input.otherPostalCode;

  const hasShippingUpdate =
    input.otherStreet !== undefined ||
    input.otherCity !== undefined ||
    input.otherState !== undefined ||
    input.otherPostalCode !== undefined;

  if (hasShippingUpdate) {
    body.Shipping_Same_As_Billing__c = false;
  }

  try {
    const res = await fetch(
      `${client.instanceUrl}/services/data/v59.0/sobjects/Contact/${contactId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${client.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("Salesforce update error:", err);
      return { success: false, error: "Update failed" };
    }
    return { success: true };
  } catch (e) {
    console.error("Salesforce update error:", e);
    return { success: false, error: "Update failed" };
  }
}

/** Record that the member requested their legacy offer. Sets Legacy_Offer_Request_Date__c and Legacy_Offer_Status__c. */
export async function recordLegacyOfferRequest(
  contactId: string
): Promise<UpdateContactResult> {
  if (process.env.NODE_ENV === "development" && contactId === "mock-contact-id") {
    return { success: true };
  }

  const client = await getSalesforceClient();
  if (!client) {
    return { success: false, error: "Salesforce not configured" };
  }

  const now = new Date().toISOString();
  const body = {
    Legacy_Offer_Request_Date__c: now,
    Legacy_Offer_Status__c: "Pending Review",
  };

  try {
    const res = await fetch(
      `${client.instanceUrl}/services/data/v59.0/sobjects/Contact/${contactId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${client.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("Salesforce legacy offer request error:", err);
      return { success: false, error: "Update failed" };
    }
    return { success: true };
  } catch (e) {
    console.error("Salesforce legacy offer request error:", e);
    return { success: false, error: "Update failed" };
  }
}

/** Dev-only mock for member lookup when Salesforce is not configured. */
function mockLookup(memberNumber: string): MemberLookupResult {
  if (!memberNumber || memberNumber.length < 3) {
    return {
      valid: false,
      active: false,
      error: "Member number not found",
    };
  }
  return {
    valid: true,
    active: true,
    contactId: "mock-contact-id",
    email: `member${memberNumber}@example.com`,
    phone: "555-123-4567",
    firstName: "Dev",
    lastName: "Member",
    otherStreet: "123 Gold St",
    otherCity: "Phoenix",
    otherState: "AZ",
    otherPostalCode: "85001",
    duesOwed: 75,
    maintenancePaidThru: "2025-12-31",
    showMaintenance: true,
    hideMaintenance: false,
    isOnAutoPay: false,
    companionTransferable: false,
    companion: undefined,
  };
}
