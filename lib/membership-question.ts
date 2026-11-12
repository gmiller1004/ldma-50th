/**
 * "Questions about LDMA Membership?" form on the memberships page: validation and the follow-up
 * summary sent to Member Services. Client-safe: no server imports.
 */

import { formatPhone, isValidEmail, isValidPhone, text } from "./lead-contact";

export type MembershipContactMethod = "email" | "phone" | "text";

export type MembershipQuestionInput = {
  firstName: string;
  lastName: string;
  contactMethod: MembershipContactMethod;
  email: string;
  phone: string;
  questions: string;
};

export const MEMBERSHIP_CONTACT_LABELS: Record<MembershipContactMethod, string> = {
  email: "Email",
  phone: "Phone call",
  text: "Text message",
};

export const MEMBERSHIP_QUESTIONS_MAX = 2000;

export function contactNeedsPhone(method: MembershipContactMethod): boolean {
  return method === "phone" || method === "text";
}

export function parseMembershipQuestion(
  body: unknown
): { ok: true; value: MembershipQuestionInput } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const firstName = text(b.firstName, 60);
  const lastName = text(b.lastName, 60);
  const contactMethod =
    b.contactMethod === "email" || b.contactMethod === "phone" || b.contactMethod === "text" ? b.contactMethod : null;
  const email = text(b.email, 200).toLowerCase();
  const phone = text(b.phone, 40);
  const questions = text(b.questions, MEMBERSHIP_QUESTIONS_MAX);

  if (!firstName) return { ok: false, error: "Please enter your first name." };
  if (!contactMethod) return { ok: false, error: "Choose how you'd like to be contacted." };
  if (contactMethod === "email" && !isValidEmail(email)) return { ok: false, error: "Please enter a valid email address." };
  if (contactNeedsPhone(contactMethod) && !isValidPhone(phone)) {
    return { ok: false, error: "Please enter a 10-digit phone number." };
  }
  if (email && !isValidEmail(email)) return { ok: false, error: "Please check your email address." };

  return {
    ok: true,
    value: {
      firstName,
      lastName,
      contactMethod,
      email,
      phone: contactNeedsPhone(contactMethod) || phone ? phone : "",
      questions,
    },
  };
}

/** "by email at pat@example.com" / "by phone at (555) 123-4567" / "by text at (555) 123-4567" */
export function membershipContactPhrase(i: MembershipQuestionInput): string {
  if (i.contactMethod === "email") return `by email at ${i.email}`;
  return `by ${i.contactMethod === "text" ? "text" : "phone"} at ${formatPhone(i.phone)}`;
}

export function buildMembershipQuestionSummary(i: MembershipQuestionInput): string {
  const name = [i.firstName, i.lastName].filter(Boolean).join(" ");
  const lines = [
    `Name: ${name}`,
    `Preferred contact: ${MEMBERSHIP_CONTACT_LABELS[i.contactMethod]}`,
    i.phone ? `Phone: ${formatPhone(i.phone)}` : null,
    i.email ? `Email: ${i.email}` : null,
    `Questions: ${i.questions || "None entered"}`,
  ];
  return lines.filter(Boolean).join("\n");
}
