import { NextRequest, NextResponse } from "next/server";
import { getCaretakerContext } from "@/lib/caretaker-auth";
import { lookupMember } from "@/lib/salesforce";

/**
 * POST /api/members/caretaker/lookup
 * Body: { memberNumber: string }
 * Returns member info for caretaker to verify: name, number, isLdmaMember, maintenanceFeesDue, membershipDuesOwed, membershipBalance, contactId.
 */
export async function POST(request: NextRequest) {
  const caretaker = await getCaretakerContext();
  if (!caretaker) {
    return NextResponse.json({ error: "Caretaker access required" }, { status: 403 });
  }

  let body: { memberNumber?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const memberNumber = typeof body.memberNumber === "string" ? body.memberNumber.trim() : "";
  if (!memberNumber) {
    return NextResponse.json({ error: "memberNumber required" }, { status: 400 });
  }

  const member = await lookupMember(memberNumber);
  if (!member.valid) {
    return NextResponse.json(
      { error: member.error ?? "Member not found" },
      { status: 404 }
    );
  }

  const displayName = [member.firstName, member.lastName].filter(Boolean).join(" ").trim() || "LDMA Member";

  return NextResponse.json({
    contactId: member.contactId,
    memberNumber,
    displayName,
    isLdmaMember: member.active === true,
    maintenanceFeesDue: member.duesOwed ?? null,
    membershipDuesOwed: member.membershipDuesOwed ?? null,
    membershipBalance: member.membershipBalance ?? null,
  });
}
