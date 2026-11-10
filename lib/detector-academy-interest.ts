/**
 * LDMA Detector Academy interest questionnaire: answers, validation, and the follow-up summary
 * sent to Member Services. Client-safe: no server imports.
 */

export type ContactMethod = "email" | "phone";
export type DetectorBrand = "garrett" | "other";
export type GarrettModel = "axiom" | "goldmaster_24k" | "other_garrett";

export type AcademyInterestInput = {
  firstName: string;
  lastName: string;
  contactMethod: ContactMethod;
  email: string;
  phone: string;
  ownsDetector: boolean;
  detectorBrand: DetectorBrand | null;
  garrettModel: GarrettModel | null;
};

export const CONTACT_METHOD_LABELS: Record<ContactMethod, string> = { email: "Email", phone: "Phone" };
export const DETECTOR_BRAND_LABELS: Record<DetectorBrand, string> = { garrett: "Garrett", other: "Another brand" };
export const GARRETT_MODEL_LABELS: Record<GarrettModel, string> = {
  axiom: "Axiom or Axiom Lite",
  goldmaster_24k: "GoldMaster 24k",
  other_garrett: "Another Garrett detector",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(raw: unknown, max: number): string {
  return typeof raw === "string" ? raw.trim().slice(0, max) : "";
}

export function phoneDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function isValidPhone(raw: string): boolean {
  const d = phoneDigits(raw);
  return d.length === 10 || (d.length === 11 && d.startsWith("1"));
}

export function isValidEmail(raw: string): boolean {
  return EMAIL_RE.test(raw.trim());
}

/** Normalize and validate a submission. Detector follow-ups are cleared when they don't apply. */
export function parseAcademyInterest(
  body: unknown
): { ok: true; value: AcademyInterestInput } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const firstName = text(b.firstName, 60);
  const lastName = text(b.lastName, 60);
  const contactMethod = b.contactMethod === "email" || b.contactMethod === "phone" ? b.contactMethod : null;
  const email = text(b.email, 200).toLowerCase();
  const phone = text(b.phone, 40);
  const ownsDetector = b.ownsDetector === true;
  const detectorBrand: DetectorBrand | null =
    ownsDetector && (b.detectorBrand === "garrett" || b.detectorBrand === "other") ? b.detectorBrand : null;
  const garrettModel: GarrettModel | null =
    detectorBrand === "garrett" &&
    (b.garrettModel === "axiom" || b.garrettModel === "goldmaster_24k" || b.garrettModel === "other_garrett")
      ? b.garrettModel
      : null;

  if (!firstName) return { ok: false, error: "Please enter your first name." };
  if (!contactMethod) return { ok: false, error: "Choose how you'd like to be contacted." };
  if (contactMethod === "email" && !isValidEmail(email)) return { ok: false, error: "Please enter a valid email address." };
  if (contactMethod === "phone" && !isValidPhone(phone)) return { ok: false, error: "Please enter a 10-digit phone number." };
  if (email && !isValidEmail(email)) return { ok: false, error: "Please check your email address." };
  if (typeof b.ownsDetector !== "boolean") return { ok: false, error: "Let us know whether you own a detector." };
  if (ownsDetector && !detectorBrand) return { ok: false, error: "Let us know which brand of detector you own." };
  if (detectorBrand === "garrett" && !garrettModel) return { ok: false, error: "Let us know which Garrett detector you own." };

  return {
    ok: true,
    value: {
      firstName,
      lastName,
      contactMethod,
      email,
      phone: contactMethod === "phone" || phone ? phone : "",
      ownsDetector,
      detectorBrand,
      garrettModel,
    },
  };
}

export function formatPhone(raw: string): string {
  const d = phoneDigits(raw).replace(/^1(?=\d{10}$)/, "");
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : raw;
}

export function detectorSummary(i: AcademyInterestInput): string {
  if (!i.ownsDetector) return "Doesn't own a detector yet";
  if (i.detectorBrand === "other") return "Owns a non-Garrett detector";
  return `Owns a Garrett: ${i.garrettModel ? GARRETT_MODEL_LABELS[i.garrettModel] : "model not given"}`;
}

/** "by email at pat@example.com" / "by phone at (555) 123-4567" */
export function preferredContactPhrase(i: AcademyInterestInput): string {
  return i.contactMethod === "email" ? `by email at ${i.email}` : `by phone at ${formatPhone(i.phone)}`;
}

export function buildAcademyLeadSummary(i: AcademyInterestInput): string {
  const name = [i.firstName, i.lastName].filter(Boolean).join(" ");
  const lines = [
    `Name: ${name}`,
    `Preferred contact: ${CONTACT_METHOD_LABELS[i.contactMethod]}`,
    i.phone ? `Phone: ${formatPhone(i.phone)}` : null,
    i.email ? `Email: ${i.email}` : null,
    `Detector: ${detectorSummary(i)}`,
  ];
  return lines.filter(Boolean).join("\n");
}
