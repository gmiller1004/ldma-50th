/**
 * Parse caretaker member lookup input (member #, email, or phone).
 */

export type CaretakerLookupFields = {
  memberNumber?: string;
  email?: string;
  phone?: string;
};

/** Strip phone to digits only (keeps leading country code digits if present). */
export function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Detect lookup field from a single search box value.
 * Email if contains @; phone if 10+ digits or formatted like a phone number; else member number.
 */
export function parseCaretakerLookupInput(raw: string): CaretakerLookupFields {
  const trimmed = raw.trim();
  if (!trimmed) return {};

  if (trimmed.includes("@")) {
    return { email: trimmed.toLowerCase() };
  }

  const digits = normalizePhoneDigits(trimmed);
  const looksLikePhone =
    /[()+\-.\s]/.test(trimmed) || digits.length >= 10;

  if (looksLikePhone && digits.length >= 7) {
    return { phone: trimmed };
  }

  return { memberNumber: trimmed };
}

export function caretakerLookupFieldsFromBody(body: {
  memberNumber?: unknown;
  email?: unknown;
  phone?: unknown;
  contactId?: unknown;
}): CaretakerLookupFields & { contactId?: string } {
  const contactId = typeof body.contactId === "string" ? body.contactId.trim() : "";
  if (contactId) return { contactId };

  const memberNumber = typeof body.memberNumber === "string" ? body.memberNumber.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";

  const provided = [memberNumber, email, phone].filter(Boolean).length;
  if (provided > 1) return {};
  if (memberNumber) return { memberNumber };
  if (email) return { email };
  if (phone) return { phone };
  return {};
}
