import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { MembersNav } from "../MembersNav";
import { verifySessionToken } from "@/lib/session";
import { lookupMember } from "@/lib/salesforce";
import { getEventProductByHandle } from "@/lib/shopify";
import {
  DETECTOR_ACADEMY_DEPOSIT_VARIANT_GID,
  DETECTOR_ACADEMY_PRODUCT_HANDLE,
  DETECTOR_ACADEMY_RESERVATION_PATH,
} from "@/lib/detector-academy";
import { academyReservationStatusForEmail } from "@/lib/detector-academy-orders";
import { DetectorReservationContent, type ReservationView } from "./DetectorReservationContent";

export const metadata: Metadata = {
  title: "Reserve Your LDMA Detector Academy Spot | LDMA Members",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function DetectorAcademyReservationPage() {
  const token = (await cookies()).get("member_session")?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) redirect(`/members/login?redirect=${encodeURIComponent(DETECTOR_ACADEMY_RESERVATION_PATH)}`);

  const member = await lookupMember(session.memberNumber);
  let view: ReservationView;
  if (!member.valid || !member.email) {
    view = { state: "no_email" };
  } else {
    const [status, event] = await Promise.all([
      academyReservationStatusForEmail(member.email),
      getEventProductByHandle(DETECTOR_ACADEMY_PRODUCT_HANDLE).catch(() => null),
    ]);
    const deposit = (event?.variants?.edges ?? [])
      .map((e) => e.node)
      .find((v) => v.id === DETECTOR_ACADEMY_DEPOSIT_VARIANT_GID);
    if (!status) view = { state: "lookup_failed" };
    else if (status.state === "eligible") {
      view = !deposit
        ? { state: "not_open_yet" }
        : deposit.availableForSale === false
          ? { state: "sold_out" }
          : { state: "eligible", variantId: deposit.id };
    } else view = { state: status.state };
  }

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Members", href: "/members" },
          { label: "LDMA Detector Academy" },
        ]}
      />
      <MembersNav />
      <DetectorReservationContent firstName={member.firstName?.trim() || ""} view={view} />
    </>
  );
}
