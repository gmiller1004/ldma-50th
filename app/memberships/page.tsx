import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MembershipsPageContent as LegacyMembershipsPageContent } from "./MembershipsPageContent";
import { BundleMembershipsPageContent } from "./BundleMembershipsPageContent";

export const metadata: Metadata = {
  title: "Lifetime Membership Bundle | LDMA 50th Anniversary",
  description:
    "Join LDMA and GPAA for life, bring a companion, keep it in the family, and take home a Garrett Axiom Lite. Through September 30, The Founder Bag is included free with new membership."
};

export default function MembershipsPage() {
  const membershipExperience = process.env.NEXT_PUBLIC_MEMBERSHIP_EXPERIENCE ?? "bundle";
  const showBundleExperience = membershipExperience !== "legacy";

  return (
    <>
      <Navbar />
      <main className="pt-16 md:pt-20 min-h-screen bg-[#1a120b]">
        {showBundleExperience ? <BundleMembershipsPageContent /> : <LegacyMembershipsPageContent />}
      </main>
      <Footer />
    </>
  );
}
