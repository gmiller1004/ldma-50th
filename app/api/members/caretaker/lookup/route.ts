import { NextRequest, NextResponse } from "next/server";
import { getCaretakerAccess } from "@/lib/caretaker-auth";
import {
  lookupMemberByContactId,
  searchMembersForCaretaker,
  type MemberLookupResult,
} from "@/lib/salesforce";
import { caretakerLookupFieldsFromBody } from "@/lib/member-contact-search";

function memberToCaretakerJson(member: MemberLookupResult, memberNumber: string | null) {
  const displayName =
    [member.firstName, member.lastName].filter(Boolean).join(" ").trim() || "LDMA Member";

  return {
    contactId: member.contactId,
    memberNumber: memberNumber ?? "",
    displayName,
    email: member.email?.trim() || null,
    isLdmaMember: member.active === true,
    maintenanceFeesDue: member.duesOwed ?? null,
    membershipDuesOwed: member.membershipDuesOwed ?? null,
    membershipBalance: member.membershipBalance ?? null,
  };
}

/**
 * POST /api/members/caretaker/lookup
 * Body: { memberNumber } | { email } | { phone } | { contactId } (one at a time)
 * Returns member info, or { multiple: true, matches } when email/phone matches several contacts.
 */
export async function POST(request: NextRequest) {
  const access = await getCaretakerAccess();
  if (!access) {
    return NextResponse.json({ error: "Caretaker access required" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const fields = caretakerLookupFieldsFromBody(body);
  if ("contactId" in fields && fields.contactId) {
    const result = await lookupMemberByContactId(fields.contactId);
    if (result.status === "not_found") {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    if (result.status === "multiple") {
      return NextResponse.json({
        multiple: true,
        matches: result.matches,
        warning: "Multiple members matched. Select the correct contact.",
      });
    }
    return NextResponse.json(memberToCaretakerJson(result.member, result.memberNumber));
  }

  const { memberNumber, email, phone } = fields;
  if (!memberNumber && !email && !phone) {
    return NextResponse.json(
      { error: "Provide memberNumber, email, or phone (one at a time)" },
      { status: 400 }
    );
  }

  const result = await searchMembersForCaretaker({ memberNumber, email, phone });
  if (result.status === "not_found") {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  if (result.status === "multiple") {
    return NextResponse.json({
      multiple: true,
      matches: result.matches,
      warning: "Multiple members matched. Select the correct contact.",
    });
  }

  return NextResponse.json(memberToCaretakerJson(result.member, result.memberNumber));
}
