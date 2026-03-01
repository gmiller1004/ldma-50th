import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/session";
import { lookupMember, updateContact } from "@/lib/salesforce";
import { getAvatarUrl } from "@/lib/avatars";
import { getCommentDigestEnabled, setCommentDigestEnabled } from "@/lib/notification-preferences";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("member_session")?.value;
    if (!token) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const session = await verifySessionToken(token);
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const member = await lookupMember(session.memberNumber);

    if (!member.valid) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const [avatarUrl, commentDigestEnabled] = await Promise.all([
      getAvatarUrl(member.contactId ?? null),
      getCommentDigestEnabled(session.memberNumber),
    ]);

    const paymentBase = process.env.MEMBER_MAINTENANCE_PAYMENT_URL;
    const maintenancePaymentUrl =
      paymentBase && member.duesOwed != null && member.duesOwed > 0
        ? `${paymentBase}${paymentBase.includes("?") ? "&" : "?"}amount=${member.duesOwed.toFixed(2)}`
        : paymentBase || null;

    return NextResponse.json({
      authenticated: true,
      memberNumber: session.memberNumber,
      contactId: member.contactId,
      avatarUrl: avatarUrl ?? null,
      commentDigestEnabled,
      email: member.email,
      firstName: member.firstName,
      lastName: member.lastName,
      phone: member.phone,
      otherStreet: member.otherStreet,
      otherCity: member.otherCity,
      otherState: member.otherState,
      otherPostalCode: member.otherPostalCode,
      duesOwed: member.duesOwed,
      maintenancePaidThru: member.maintenancePaidThru,
      showMaintenance: member.showMaintenance,
      hideMaintenance: member.hideMaintenance,
      isOnAutoPay: member.isOnAutoPay,
      maintenancePaymentUrl,
    });
  } catch (e) {
    console.error("Me route error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("member_session")?.value;
    if (!token) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const session = await verifySessionToken(token);
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const member = await lookupMember(session.memberNumber);
    if (!member.valid || !member.contactId) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const body = await req.json();
    const input: {
      phone?: string;
      otherStreet?: string;
      otherCity?: string;
      otherState?: string;
      otherPostalCode?: string;
    } = {};
    let notificationUpdate: Promise<void> | null = null;

    if (typeof body.phone === "string") input.phone = body.phone.trim();
    if (typeof body.otherStreet === "string") input.otherStreet = body.otherStreet.trim();
    if (typeof body.otherCity === "string") input.otherCity = body.otherCity.trim();
    if (typeof body.otherState === "string") input.otherState = body.otherState.trim();
    if (typeof body.otherPostalCode === "string") input.otherPostalCode = body.otherPostalCode.trim();
    if (typeof body.commentDigestEnabled === "boolean") {
      notificationUpdate = setCommentDigestEnabled(session.memberNumber, body.commentDigestEnabled);
    }

    if (notificationUpdate) await notificationUpdate;

    if (Object.keys(input).length === 0) {
      return NextResponse.json({ ok: true });
    }

    const result = await updateContact(member.contactId, input);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Update failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Me PATCH error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
