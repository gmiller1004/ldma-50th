import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { isSeptMemberActive } from "@/lib/membership-bundle-config";
import { MembershipsPageContent as LegacyMembershipsPageContent } from "./MembershipsPageContent";
import { BundleMembershipsPageContent } from "./BundleMembershipsPageContent";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Lifetime Membership Bundle | LDMA 50th Anniversary",
    description: isSeptMemberActive()
      ? "Join LDMA and GPAA for life, bring a companion, keep it in the family, and take home a Garrett Axiom Lite. Through September 30, The Founder Bag is included free with new membership."
      : "Join LDMA and GPAA for life, bring a companion, keep it in the family, and take home a Garrett Axiom Lite.",
  };
}

export default function MembershipsPage() {
  const membershipExperience = process.env.NEXT_PUBLIC_MEMBERSHIP_EXPERIENCE ?? "bundle";
  const showBundleExperience = membershipExperience !== "legacy";

  return (
    <>
      <Navbar />
      <main className="pt-16 md:pt-20 min-h-screen bg-[#1a120b]">
        {showBundleExperience ? (
          <BundleMembershipsPageContent septMemberActiveAtRender={isSeptMemberActive()} />
        ) : (
          <LegacyMembershipsPageContent />
        )}
      </main>
      <Footer />
    </>
  );
}
