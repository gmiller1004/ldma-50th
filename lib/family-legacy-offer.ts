/**
 * $600 Complete Family Legacy offer: adds all three legacy add-ons for any active primary LDMA member.
 * Salesforce add-on checkboxes are not reliable for every contract, so members never see them; they are
 * passed to Member Services (contact owner), who applies the add-ons after the addendum is signed.
 * Paid through Stripe. Client-safe: no server imports.
 */

export const FAMILY_LEGACY_OFFER_PATH = "/members/family-legacy-offer";
export const FAMILY_LEGACY_PAYMENT_TYPE = "family_legacy";
export const FAMILY_LEGACY_PRICE_CENTS = 60000;
export const FAMILY_LEGACY_REGULAR_PRICE_CENTS = 325000;

/** Legacy_Offer_Status__c values (restricted picklist in Salesforce). */
export const LEGACY_STATUS_PAID_PENDING_ADDENDUM = "Paid - Addendum Pending";
export const LEGACY_STATUS_COMPLETED = "Completed Offer";

/** Receives the Task and email when a contact's owner is inactive or missing. */
export const FAMILY_LEGACY_FALLBACK_OWNER_EMAIL = "gricci@goldprospectors.org";

export const FAMILY_LEGACY_ADD_ONS = ["Transferability", "Companion", "Pre-Paid Transfer Fee"] as const;

export type LegacyAddOnHoldings = {
  isTransferable?: boolean;
  isCompanion?: boolean;
  isPrePayTransfer?: boolean;
};

/** Internal note for Member Services only; never shown to members. */
export function describeLegacyCheckboxes(h: LegacyAddOnHoldings): string {
  const mark = (v?: boolean) => (v ? "checked" : "not checked");
  return `Is Transferable ${mark(h.isTransferable)}, Is Companion ${mark(h.isCompanion)}, Is PrePay Transfer ${mark(h.isPrePayTransfer)}`;
}

export function isLegacyPaidPendingAddendum(status: string | null | undefined): boolean {
  return (status ?? "").trim().toLowerCase() === LEGACY_STATUS_PAID_PENDING_ADDENDUM.toLowerCase();
}

export function isLegacyOfferCompleted(status: string | null | undefined): boolean {
  return (status ?? "").trim().toLowerCase() === LEGACY_STATUS_COMPLETED.toLowerCase();
}

export type FamilyLegacyIneligibleReason = "not_active" | "companion_login" | "already_purchased" | "completed_offer";

export type FamilyLegacyEligibility = { eligible: true } | { eligible: false; reason: FamilyLegacyIneligibleReason };

export function familyLegacyEligibility(
  member: {
    active?: boolean;
    accessRole?: "primary" | "companion";
    legacyOfferStatus?: string | null;
  },
  hasPaidOrder = false
): FamilyLegacyEligibility {
  if (member.accessRole === "companion") return { eligible: false, reason: "companion_login" };
  if (member.active !== true) return { eligible: false, reason: "not_active" };
  if (hasPaidOrder || isLegacyPaidPendingAddendum(member.legacyOfferStatus)) {
    return { eligible: false, reason: "already_purchased" };
  }
  if (isLegacyOfferCompleted(member.legacyOfferStatus)) return { eligible: false, reason: "completed_offer" };
  return { eligible: true };
}

export type FamilyLegacyIntake = {
  companionName: string;
  companionRelationship: string;
  heirName: string;
  heirRelationship: string;
  notes: string;
};

const SHORT_FIELD_MAX = 120;
const NOTES_MAX = 1000;

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/** All fields optional; members can name a companion or heir later with Member Services. */
export function parseFamilyLegacyIntake(body: unknown): FamilyLegacyIntake {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  return {
    companionName: clean(b.companionName, SHORT_FIELD_MAX),
    companionRelationship: clean(b.companionRelationship, SHORT_FIELD_MAX),
    heirName: clean(b.heirName, SHORT_FIELD_MAX),
    heirRelationship: clean(b.heirRelationship, SHORT_FIELD_MAX),
    notes: typeof b.notes === "string" ? b.notes.trim().slice(0, NOTES_MAX) : "",
  };
}

function describePerson(name: string, relationship: string): string {
  if (!name && !relationship) return "Not provided yet — collect when sending the addendum";
  if (!name) return `Name not provided (${relationship}) — collect when sending the addendum`;
  return relationship ? `${name} (${relationship})` : name;
}

/** Plain-text body for the Salesforce Task and the owner email. */
export function buildFamilyLegacyTaskDescription(input: {
  memberName: string;
  memberNumber: string | null;
  checkboxesBefore: string | null;
  amountCents: number;
  paidAtIso: string;
  stripePaymentIntentId: string | null;
  intake: FamilyLegacyIntake;
  statusUpdated: boolean;
}): string {
  const lines = [
    `${input.memberName}${input.memberNumber ? ` (#${input.memberNumber})` : ""} purchased the Complete Family Legacy add-on online.`,
    "",
    `Paid: $${(input.amountCents / 100).toFixed(2)} by card (Stripe) on ${input.paidAtIso.slice(0, 10)}`,
    input.stripePaymentIntentId ? `Stripe payment: ${input.stripePaymentIntentId}` : "",
    `Add-ons to apply: all three (${FAMILY_LEGACY_ADD_ONS.join(", ")})`,
    input.checkboxesBefore
      ? `Salesforce before purchase: ${input.checkboxesBefore}. Compare with the member's contract; the member was not shown this.`
      : "",
    "",
    `Companion: ${describePerson(input.intake.companionName, input.intake.companionRelationship)}`,
    `Heir: ${describePerson(input.intake.heirName, input.intake.heirRelationship)}`,
    input.intake.notes ? `Member notes: ${input.intake.notes}` : "",
    "",
    "Next steps:",
    "1. Send the Family Legacy addendum to the member through Adobe Sign.",
    `2. Once signed, check "Is Transferable", "Is Companion", and "Is PrePay Transfer" on the Contact and set Legacy Offer Status to "${LEGACY_STATUS_COMPLETED}".`,
    input.statusUpdated
      ? ""
      : `Note: the website could not set Legacy Offer Status to "${LEGACY_STATUS_PAID_PENDING_ADDENDUM}". Please set it manually.`,
  ];
  return lines.filter((l, i, all) => l !== "" || (i > 0 && all[i - 1] !== "")).join("\n").trim();
}
