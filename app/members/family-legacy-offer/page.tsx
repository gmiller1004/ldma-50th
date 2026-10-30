import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { MembersNav } from "../MembersNav";
import { FAMILY_LEGACY_OFFER_PATH } from "@/lib/family-legacy-offer";
import { getFamilyLegacyMemberContext } from "@/lib/family-legacy-orders";
import { FamilyLegacyOfferContent } from "./FamilyLegacyOfferContent";

export const metadata: Metadata = {
  title: "Complete Family Legacy Offer | LDMA Members",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FamilyLegacyOfferPage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string; cancelled?: string }>;
}) {
  const ctx = await getFamilyLegacyMemberContext();
  if (!ctx) redirect(`/members/login?redirect=${encodeURIComponent(FAMILY_LEGACY_OFFER_PATH)}`);

  const params = await searchParams;
  const firstName = ctx.member.firstName?.trim() || "";

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Members", href: "/members" },
          { label: "Family Legacy Offer" },
        ]}
      />
      <MembersNav />
      <FamilyLegacyOfferContent
        firstName={firstName}
        eligibility={ctx.eligibility}
        justPaid={params.paid === "1"}
        cancelled={params.cancelled === "1"}
      />
    </>
  );
}
