/**
 * Parse caretaker member lookup input (name, member #, email, or phone).
 */

export type CaretakerLookupFields = {
  memberNumber?: string;
  email?: string;
  phone?: string;
  name?: string;
};

/** Strip phone to digits only (keeps leading country code digits if present). */
export function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Detect lookup field from a single search box value.
 * Email if contains @; name if letters and no digits; phone if 10+ digits or formatted like a
 * phone number; else member number.
 */
export function parseCaretakerLookupInput(raw: string): CaretakerLookupFields {
  const trimmed = raw.trim();
  if (!trimmed) return {};

  if (trimmed.includes("@")) {
    return { email: trimmed.toLowerCase() };
  }

  const digits = normalizePhoneDigits(trimmed);
  if (!digits && /[a-z]/i.test(trimmed)) {
    return { name: trimmed.replace(/\s+/g, " ") };
  }

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
  name?: unknown;
  contactId?: unknown;
}): CaretakerLookupFields & { contactId?: string } {
  const contactId = typeof body.contactId === "string" ? body.contactId.trim() : "";
  if (contactId) return { contactId };

  const memberNumber = typeof body.memberNumber === "string" ? body.memberNumber.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";

  const provided = [memberNumber, email, phone, name].filter(Boolean).length;
  if (provided > 1) return {};
  if (memberNumber) return { memberNumber };
  if (email) return { email };
  if (phone) return { phone };
  if (name) return { name };
  return {};
}
