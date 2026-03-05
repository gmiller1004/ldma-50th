import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/session";
import { lookupMember, updateContact } from "@/lib/salesforce";
import { getAvatarUrl } from "@/lib/avatars";
import {
  getCommentDigestEnabled,
  setCommentDigestEnabled,
  getExclusiveOffersNotify,
  setExclusiveOffersNotify,
} from "@/lib/notification-preferences";

/** Minimal payload when Salesforce lookup fails so UI still shows logged in (no 500). */
function minimalMePayload(memberNumber: string) {
  return {
    authenticated: true,
    memberNumber,
    contactId: null,
    avatarUrl: null,
    commentDigestEnabled: false,
    exclusiveOffersNotify: false,
    email: null,
    firstName: null,
    lastName: null,
    phone: null,
    otherStreet: null,
    otherCity: null,
    otherState: null,
    otherPostalCode: null,
    duesOwed: null,
    maintenancePaidThru: null,
    showMaintenance: false,
    hideMaintenance: false,
    isOnAutoPay: false,
    maintenancePaymentUrl: null,
    companionTransferable: false,
    companion: null,
    legacyOfferRequestDate: null,
    legacyOfferStatus: null,
    legacyOfferIsTransferable: false,
    legacyOfferIsCompanion: false,
    legacyOfferIsPrePay: false,
    isLdmaAdmin: false,
    isCaretaker: false,
    caretakerAtCamp: null,
  };
}

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("member_session")?.value;
  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const session = await verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  let member;
  try {
    member = await lookupMember(session.memberNumber);
  } catch (e) {
    console.error("Me route: lookupMember failed", e);
    return NextResponse.json(minimalMePayload(session.memberNumber), { status: 200 });
  }

  if (!member.valid) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  try {
    const [avatarUrl, commentDigestEnabled, exclusiveOffersNotify] = await Promise.all([
      getAvatarUrl(member.contactId ?? null),
      getCommentDigestEnabled(session.memberNumber),
      getExclusiveOffersNotify(session.memberNumber),
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
      exclusiveOffersNotify,
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
      companionTransferable: member.companionTransferable,
      companion: member.companion,
      legacyOfferRequestDate: member.legacyOfferRequestDate ?? null,
      legacyOfferStatus: member.legacyOfferStatus ?? null,
      legacyOfferIsTransferable: member.isTransferable ?? false,
      legacyOfferIsCompanion: member.isCompanion ?? false,
      legacyOfferIsPrePay: member.isPrePayTransfer ?? false,
      isLdmaAdmin: member.isLdmaAdmin ?? false,
      isCaretaker: member.isCaretaker ?? false,
      caretakerAtCamp: member.caretakerAtCamp ?? null,
    });
  } catch (e) {
    console.error("Me route: post-lookup failed", e);
    return NextResponse.json(minimalMePayload(session.memberNumber), { status: 200 });
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

    if (typeof body.phone === "string") input.phone = body.phone.trim();
    if (typeof body.otherStreet === "string") input.otherStreet = body.otherStreet.trim();
    if (typeof body.otherCity === "string") input.otherCity = body.otherCity.trim();
    if (typeof body.otherState === "string") input.otherState = body.otherState.trim();
    if (typeof body.otherPostalCode === "string") input.otherPostalCode = body.otherPostalCode.trim();
    if (typeof body.commentDigestEnabled === "boolean") {
      await setCommentDigestEnabled(session.memberNumber, body.commentDigestEnabled);
    }
    if (typeof body.exclusiveOffersNotify === "boolean") {
      await setExclusiveOffersNotify(session.memberNumber, body.exclusiveOffersNotify);
    }

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
