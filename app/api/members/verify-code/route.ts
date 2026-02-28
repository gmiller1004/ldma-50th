import { NextResponse } from "next/server";
import { verifyAuthCode } from "@/lib/redis";
import { createSessionToken, sessionCookieOptions } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const code = body.code?.trim();
    if (!code || !/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: "Please enter a valid 6-digit code" },
        { status: 400 }
      );
    }

    const payload = await verifyAuthCode(code);

    if (!payload) {
      return NextResponse.json(
        { error: "Invalid or expired code. Please request a new one." },
        { status: 401 }
      );
    }

    const token = await createSessionToken({
      memberNumber: payload.memberNumber,
      email: payload.email,
      contactId: payload.contactId,
    });

    const options = sessionCookieOptions(token);
    const response = NextResponse.json({
      ok: true,
      redirect: "/members",
    });

    response.cookies.set(options.name, options.value, {
      httpOnly: options.httpOnly,
      secure: options.secure,
      sameSite: options.sameSite,
      maxAge: options.maxAge,
      path: options.path,
    });

    return response;
  } catch (e) {
    console.error("Verify code error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
