/**
 * Klaviyo sync for camp stays (reservations + check-ins).
 * Creates or updates profile with custom properties for remarketing:
 * - Most Recent Camp, Most Recent Stay Status, Most Recent Check Out, Camps Stayed.
 * Uses POST /api/profile-import and GET /api/profiles (filter by email) for merge.
 */

import { lookupMember } from "@/lib/salesforce";

const KLAVIYO_BASE = "https://a.klaviyo.com/api";
const KLAVIYO_REVISION = "2024-02-15";

export type StayStatus = "reserved" | "in_progress" | "cancelled" | "completed";

export type StayAs = "member" | "guest";

export type CampStayProfilePayload = {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  campSlug: string;
  checkOutDate: string; // YYYY-MM-DD
  status: StayStatus;
  /** Whether they were a member or guest at the time of this stay. */
  lastStayAs?: StayAs | null;
};

function getApiKey(): string | null {
  const key = process.env.KLAVIYO_PRIVATE_API_KEY;
  return key?.trim() || null;
}

/**
 * Fetch existing profile by email to read current custom properties (e.g. Camps Stayed).
 */
async function getProfileByEmail(email: string): Promise<{ properties?: Record<string, unknown> } | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const filter = `equals(email,"${email.replace(/"/g, '\\"')}")`;
  const url = `${KLAVIYO_BASE}/profiles?filter=${encodeURIComponent(filter)}`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Klaviyo-API-Key ${apiKey}`,
        revision: KLAVIYO_REVISION,
        accept: "application/json",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: Array<{ attributes?: { properties?: Record<string, unknown> } }> };
    const profile = data.data?.[0];
    if (!profile?.attributes) return null;
    return { properties: profile.attributes.properties as Record<string, unknown> | undefined };
  } catch {
    return null;
  }
}

/**
 * Merge this camp into Camps Stayed. Current value can be comma-separated string or undefined.
 */
function mergeCampsStayed(currentValue: unknown, campSlug: string): string {
  const current = typeof currentValue === "string" ? currentValue.trim() : "";
  const camps = current ? current.split(/\s*,\s*/).filter(Boolean) : [];
  const slug = campSlug.trim();
  if (slug && !camps.includes(slug)) camps.push(slug);
  return camps.join(", ");
}

/**
 * Map reservation DB status to Klaviyo stay status.
 */
export function reservationStatusToStayStatus(dbStatus: string): StayStatus {
  switch (dbStatus) {
    case "reserved":
      return "reserved";
    case "checked_in":
      return "in_progress";
    case "completed":
      return "completed";
    case "cancelled":
      return "cancelled";
    default:
      return "reserved";
  }
}

/**
 * Create or update Klaviyo profile with camp stay fields.
 * Klaviyo profile-import creates a new profile when no profile matches the email (we do not send id).
 * New profiles get email, first_name, last_name (from payload: Salesforce for members, registration/check-in for guests)
 * plus custom properties: Most Recent Camp, Most Recent Stay Status, Most Recent Check Out, Camps Stayed.
 * If profile exists, merges Camps Stayed (appends this camp if not already present).
 * Does nothing if KLAVIYO_PRIVATE_API_KEY is not set.
 */
export async function upsertCampStayProfile(payload: CampStayProfilePayload): Promise<boolean> {
  const apiKey = getApiKey();
  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.log("[DEV] Klaviyo camp stay sync skipped (no key):", payload.email, payload.campSlug);
    }
    return false;
  }

  const email = payload.email.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;

  const existing = await getProfileByEmail(email);
  const currentProperties = (existing?.properties as Record<string, unknown>) || {};
  const campsStayed = mergeCampsStayed(currentProperties["Camps Stayed"], payload.campSlug);

  const properties: Record<string, unknown> = {
    ...currentProperties,
    "Most Recent Camp": payload.campSlug,
    "Most Recent Stay Status": payload.status,
    "Most Recent Check Out": payload.checkOutDate,
    "Camps Stayed": campsStayed,
  };
  if (payload.lastStayAs === "member" || payload.lastStayAs === "guest") {
    properties["Most Recent Stay Type"] = payload.lastStayAs;
  }

  const attributes: Record<string, unknown> = {
    email,
    first_name: payload.firstName?.trim() || undefined,
    last_name: payload.lastName?.trim() || undefined,
    properties,
  };

  // Remove undefined so we don't clear fields
  if (attributes.first_name === undefined) delete attributes.first_name;
  if (attributes.last_name === undefined) delete attributes.last_name;

  try {
    const res = await fetch(`${KLAVIYO_BASE}/profile-import`, {
      method: "POST",
      headers: {
        Authorization: `Klaviyo-API-Key ${apiKey}`,
        revision: KLAVIYO_REVISION,
        accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          type: "profile",
          attributes,
        },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("[Klaviyo] profile-import error:", res.status, text);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[Klaviyo] profile-import exception:", e);
    return false;
  }
}

export type ReservationRowForSync = {
  camp_slug: string;
  check_out_date: string;
  reservation_type: string;
  guest_email: string | null;
  guest_first_name: string | null;
  guest_last_name: string | null;
  member_number: string | null;
  member_display_name: string | null;
  status: string;
};

/**
 * Sync a reservation to Klaviyo (guest uses email from row; member looks up email).
 * Call fire-and-forget from API routes. Status should be reservation status (reserved/checked_in/completed/cancelled).
 */
export async function syncReservationToKlaviyo(row: ReservationRowForSync): Promise<void> {
  const status = reservationStatusToStayStatus(row.status);
  const checkOutDate = String(row.check_out_date).slice(0, 10);

  if (row.reservation_type === "guest") {
    const email = row.guest_email?.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    await upsertCampStayProfile({
      email,
      firstName: row.guest_first_name,
      lastName: row.guest_last_name,
      campSlug: row.camp_slug,
      checkOutDate,
      status,
      lastStayAs: "guest",
    });
    return;
  }

  const memberNumber = row.member_number?.trim();
  if (!memberNumber) return;
  const member = await lookupMember(memberNumber);
  if (!member.valid || !member.email?.trim()) return;
  await upsertCampStayProfile({
    email: member.email.trim(),
    firstName: member.firstName,
    lastName: member.lastName ?? undefined,
    campSlug: row.camp_slug,
    checkOutDate,
    status,
    lastStayAs: "member",
  });
}
