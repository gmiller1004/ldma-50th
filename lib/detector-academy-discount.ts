/**
 * LDMA Detector Academy "Apply for a Discount" questionnaire.
 * Client-safe: no server imports.
 */

import { isValidEmail, text } from "./lead-contact";

export type AcademyMembership = "none" | "gpaa" | "ldma" | "both";
export type AcademyQualifier = "military" | "first_responder" | "teacher" | "none";
export type AcademyBringDetector =
  | "axiom"
  | "axiom_lite"
  | "goldmaster_24k"
  | "other"
  | "undecided";
export type AcademyExperience = "new" | "some" | "experienced";
export type AcademyHeardAbout =
  | "facebook"
  | "email"
  | "friend"
  | "stanton"
  | "garrett"
  | "other";
export type AcademyCamping = "yes" | "no" | "undecided";

export type AcademyDiscountInput = {
  firstName: string;
  lastName: string;
  email: string;
  membership: AcademyMembership;
  qualifier: AcademyQualifier;
  bringDetector: AcademyBringDetector;
  experience: AcademyExperience;
  heardAbout: AcademyHeardAbout;
  camping: AcademyCamping;
};

export const ACADEMY_MEMBERSHIP_LABELS: Record<AcademyMembership, string> = {
  none: "Not a member",
  gpaa: "GPAA",
  ldma: "LDMA",
  both: "Both GPAA and LDMA",
};

export const ACADEMY_QUALIFIER_LABELS: Record<AcademyQualifier, string> = {
  military: "Military (active duty or veteran)",
  first_responder: "First responder",
  teacher: "Teacher",
  none: "None of these",
};

export const ACADEMY_BRING_DETECTOR_LABELS: Record<AcademyBringDetector, string> = {
  axiom: "Garrett Axiom",
  axiom_lite: "Garrett Axiom Lite",
  goldmaster_24k: "Garrett GoldMaster 24k",
  other: "Another detector",
  undecided: "Undecided / shopping",
};

export const ACADEMY_EXPERIENCE_LABELS: Record<AcademyExperience, string> = {
  new: "New to detecting",
  some: "Some experience",
  experienced: "Experienced",
};

export const ACADEMY_HEARD_ABOUT_LABELS: Record<AcademyHeardAbout, string> = {
  facebook: "Facebook",
  email: "Email from LDMA / GPAA",
  friend: "Friend or family",
  stanton: "At Stanton camp",
  garrett: "Garrett",
  other: "Other",
};

export const ACADEMY_CAMPING_LABELS: Record<AcademyCamping, string> = {
  yes: "Yes, planning to camp at Stanton",
  no: "No",
  undecided: "Undecided",
};

/** Klaviyo metric that triggers the thank-you + delayed discount-code flow. */
export const ACADEMY_DISCOUNT_APPLIED_METRIC = "Academy Discount Applied";

/** Shopify discount code emailed to qualified applicants (25% off academy). */
export const ACADEMY_DISCOUNT_CODE = "ACADEMY25";

/** True for GPAA/LDMA members, or military / first responder / teacher. */
export function qualifiesForAcademyDiscount(
  i: Pick<AcademyDiscountInput, "membership" | "qualifier">
): boolean {
  return i.membership !== "none" || i.qualifier !== "none";
}

export function parseAcademyDiscount(
  body: unknown
): { ok: true; value: AcademyDiscountInput } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const firstName = text(b.firstName, 60);
  const lastName = text(b.lastName, 60);
  const email = text(b.email, 200).toLowerCase();

  const membership = asEnum(b.membership, ["none", "gpaa", "ldma", "both"] as const);
  const qualifier = asEnum(b.qualifier, ["military", "first_responder", "teacher", "none"] as const);
  const bringDetector = asEnum(b.bringDetector, [
    "axiom",
    "axiom_lite",
    "goldmaster_24k",
    "other",
    "undecided",
  ] as const);
  const experience = asEnum(b.experience, ["new", "some", "experienced"] as const);
  const heardAbout = asEnum(b.heardAbout, [
    "facebook",
    "email",
    "friend",
    "stanton",
    "garrett",
    "other",
  ] as const);
  const camping = asEnum(b.camping, ["yes", "no", "undecided"] as const);

  if (!firstName) return { ok: false, error: "Please enter your first name." };
  if (!isValidEmail(email)) return { ok: false, error: "Please enter a valid email address." };
  if (!membership) return { ok: false, error: "Please tell us about your membership." };
  if (!qualifier) return { ok: false, error: "Please select a service or profession option." };
  if (!bringDetector) return { ok: false, error: "Please tell us which detector you'll bring." };
  if (!experience) return { ok: false, error: "Please select your experience level." };
  if (!heardAbout) return { ok: false, error: "Please tell us how you heard about the academy." };
  if (!camping) return { ok: false, error: "Please tell us about camping at Stanton." };

  return {
    ok: true,
    value: {
      firstName,
      lastName,
      email,
      membership,
      qualifier,
      bringDetector,
      experience,
      heardAbout,
      camping,
    },
  };
}

function asEnum<T extends string>(raw: unknown, allowed: readonly T[]): T | null {
  return typeof raw === "string" && (allowed as readonly string[]).includes(raw) ? (raw as T) : null;
}

export function buildAcademyDiscountSummary(i: AcademyDiscountInput): string {
  const name = [i.firstName, i.lastName].filter(Boolean).join(" ");
  return [
    `Name: ${name}`,
    `Email: ${i.email}`,
    `Membership: ${ACADEMY_MEMBERSHIP_LABELS[i.membership]}`,
    `Qualifier: ${ACADEMY_QUALIFIER_LABELS[i.qualifier]}`,
    `Bringing: ${ACADEMY_BRING_DETECTOR_LABELS[i.bringDetector]}`,
    `Experience: ${ACADEMY_EXPERIENCE_LABELS[i.experience]}`,
    `Heard about: ${ACADEMY_HEARD_ABOUT_LABELS[i.heardAbout]}`,
    `Camping: ${ACADEMY_CAMPING_LABELS[i.camping]}`,
    `Qualifies for discount: ${qualifiesForAcademyDiscount(i) ? "yes" : "no"}`,
  ].join("\n");
}

/** Profile + event properties for Klaviyo personalization. */
export function academyDiscountKlaviyoProperties(i: AcademyDiscountInput): Record<string, string | boolean> {
  return {
    academy_discount_applied: true,
    academy_discount_qualifies: qualifiesForAcademyDiscount(i),
    academy_discount_code: ACADEMY_DISCOUNT_CODE,
    academy_membership: i.membership,
    academy_membership_label: ACADEMY_MEMBERSHIP_LABELS[i.membership],
    academy_qualifier: i.qualifier,
    academy_qualifier_label: ACADEMY_QUALIFIER_LABELS[i.qualifier],
    academy_bring_detector: i.bringDetector,
    academy_bring_detector_label: ACADEMY_BRING_DETECTOR_LABELS[i.bringDetector],
    academy_experience: i.experience,
    academy_experience_label: ACADEMY_EXPERIENCE_LABELS[i.experience],
    academy_heard_about: i.heardAbout,
    academy_heard_about_label: ACADEMY_HEARD_ABOUT_LABELS[i.heardAbout],
    academy_camping: i.camping,
    academy_camping_label: ACADEMY_CAMPING_LABELS[i.camping],
    interest_path: "detector-academy-discount",
  };
}
