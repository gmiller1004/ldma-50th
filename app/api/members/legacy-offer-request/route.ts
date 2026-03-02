import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/session";
import { lookupMember, recordLegacyOfferRequest } from "@/lib/salesforce";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("member_session")?.value;
    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const session = await verifySessionToken(token);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const member = await lookupMember(session.memberNumber);
    if (!member.valid || !member.contactId) {
      return NextResponse.json({ error: "Member not found" }, { status: 401 });
    }

    const result = await recordLegacyOfferRequest(member.contactId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Request failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Legacy offer request error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
