import { NextResponse } from "next/server";
import { lookupMember } from "@/lib/salesforce";
import { storeAuthCode } from "@/lib/redis";
import { sendLoginCode } from "@/lib/sendgrid";

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

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

    if (!result.valid || !result.active || !result.email) {
      return NextResponse.json(
        {
          error:
            result.error ||
            "Member not found or inactive. Please call to verify your membership.",
          action: "call",
        },
        { status: 404 }
      );
    }

    const code = generateCode();
    const stored = await storeAuthCode(memberNumber, code, {
      email: result.email,
      contactId: result.contactId,
    });

    if (!stored) {
      return NextResponse.json(
        {
          error: "Unable to send code. Please try again later.",
          action: "retry",
        },
        { status: 503 }
      );
    }

    const sent = await sendLoginCode(result.email, code);

    if (!sent) {
      // Code was stored but email failed - in prod you might want to delete the code
      return NextResponse.json(
        {
          error: "Code was generated but we could not send the email. Please check your email configuration or try again.",
          action: "retry",
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Check your email for the 6-digit code",
    });
  } catch (e) {
    console.error("Send code error:", e);
    return NextResponse.json(
      { error: "Something went wrong", action: "retry" },
      { status: 500 }
    );
  }
}
