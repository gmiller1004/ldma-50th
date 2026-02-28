import { NextResponse } from "next/server";
import { lookupMember } from "@/lib/salesforce";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const memberNumber = body.memberNumber?.trim();
    if (!memberNumber) {
      return NextResponse.json(
        { error: "Member number is required" },
        { status: 400 }
      );
    }

    const result = await lookupMember(memberNumber);

    if (!result.valid) {
      return NextResponse.json(
        {
          error: result.error || "Member number not found",
          action: "call",
        },
        { status: 404 }
      );
    }

    if (!result.active) {
      return NextResponse.json(
        {
          error: result.error || "Membership is not active",
          action: "call",
        },
        { status: 403 }
      );
    }

    if (!result.email) {
      return NextResponse.json(
        {
          error: result.error || "No email on file. Please call to update your contact information.",
          action: "call",
        },
        { status: 400 }
      );
    }

    // Don't expose email to client; we'll use it server-side when sending the code
    return NextResponse.json({
      ok: true,
      message: "Code will be sent to your email",
    });
  } catch (e) {
    console.error("Lookup error:", e);
    return NextResponse.json(
      { error: "Something went wrong", action: "retry" },
      { status: 500 }
    );
  }
}
