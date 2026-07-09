/**
 * Klaviyo sync for camp stays (reservations + check-ins).
 * Creates or updates profile with custom properties for remarketing.
 * Subscribes email marketing when not already subscribed.
 */

import { lookupMember } from "@/lib/salesforce";
import { getCampBySlug } from "@/lib/directory-camps";
import { countNights, toDateOnlyStr } from "@/lib/reservation-dates";
import { ensureKlaviyoEmailSubscribed } from "@/lib/klaviyo-marketing-subscribe";

const KLAVIYO_BASE = "https://a.klaviyo.com/api";
const KLAVIYO_REVISION = "2024-02-15";

export type StayStatus = "reserved" | "in_progress" | "cancelled" | "completed";

export type StayAs = "member" | "guest";

export type CampStayProfilePayload = {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  campSlug: string;
  checkInDate: string;
  checkOutDate: string;
  status: StayStatus;
  /** Whether they were a member or guest at the time of this stay. */
  lastStayAs?: StayAs | null;
  nights?: number | null;
  campName?: string | null;
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

function resolveCampName(campSlug: string, campName?: string | null): string | null {
  const explicit = campName?.trim();
  if (explicit) return explicit;
  return getCampBySlug(campSlug)?.name ?? null;
}

/**
 * Build Klaviyo custom properties for a camp stay sync.
 */
export function buildCampStayProfileProperties(
  payload: CampStayProfilePayload,
  currentProperties: Record<string, unknown>,
  todayIso = new Date().toISOString().slice(0, 10)
): Record<string, unknown> {
  const checkIn = payload.checkInDate.slice(0, 10);
  const checkOut = payload.checkOutDate.slice(0, 10);
  const campSlug = payload.campSlug.trim();
  const campName = resolveCampName(campSlug, payload.campName);
  const nights =
    payload.nights != null && payload.nights > 0
      ? payload.nights
      : countNights(checkIn, checkOut);

  const isUpcomingReservation = payload.status === "reserved" && checkOut >= todayIso;

  const properties: Record<string, unknown> = {
    ...currentProperties,
    "Most Recent Camp": campSlug,
    "Most Recent Stay Status": payload.status,
    "Most Recent Check In": checkIn,
    "Most Recent Check Out": checkOut,
    "Reservation Start Date": checkIn,
    "Reservation End Date": checkOut,
    "Camps Stayed": mergeCampsStayed(currentProperties["Camps Stayed"], campSlug),
  };

  if (campName) {
    properties["Most Recent Camp Name"] = campName;
  }
  if (nights > 0) {
    properties["Reservation Nights"] = nights;
  }
  if (payload.lastStayAs === "member" || payload.lastStayAs === "guest") {
    properties["Most Recent Stay Type"] = payload.lastStayAs;
  }

  if (isUpcomingReservation) {
    properties["Next Camp Booked"] = campSlug;
    if (campName) properties["Next Camp Booked Name"] = campName;
  } else if (
    currentProperties["Next Camp Booked"] === campSlug ||
    currentProperties["Reservation Start Date"] === checkIn
  ) {
    properties["Next Camp Booked"] = "";
    properties["Next Camp Booked Name"] = "";
  }

  return properties;
}

/**
 * Create or update Klaviyo profile with camp stay fields and ensure email marketing consent.
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

  await ensureKlaviyoEmailSubscribed(email, "camp_reservation");

  const existing = await getProfileByEmail(email);
  const currentProperties = (existing?.properties as Record<string, unknown>) || {};
  const properties = buildCampStayProfileProperties(payload, currentProperties);

  const attributes: Record<string, unknown> = {
    email,
    first_name: payload.firstName?.trim() || undefined,
    last_name: payload.lastName?.trim() || undefined,
    properties,
  };

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
  check_in_date: string;
  check_out_date: string;
  nights?: number | null;
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
 * Call fire-and-forget from API routes on create, update, cancel, and payment.
 */
export async function syncReservationToKlaviyo(row: ReservationRowForSync): Promise<void> {
  const status = reservationStatusToStayStatus(row.status);
  const checkInDate = toDateOnlyStr(row.check_in_date);
  const checkOutDate = toDateOnlyStr(row.check_out_date);
  const campName = getCampBySlug(row.camp_slug)?.name ?? null;
  const nights = row.nights ?? countNights(checkInDate, checkOutDate);

  if (row.reservation_type === "guest") {
    const email = row.guest_email?.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    await upsertCampStayProfile({
      email,
      firstName: row.guest_first_name,
      lastName: row.guest_last_name,
      campSlug: row.camp_slug,
      checkInDate,
      checkOutDate,
      status,
      lastStayAs: "guest",
      nights,
      campName,
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
    checkInDate,
    checkOutDate,
    status,
    lastStayAs: "member",
    nights,
    campName,
  });
}
