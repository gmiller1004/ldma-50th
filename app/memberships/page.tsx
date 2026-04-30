import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MembershipsPageContent as LegacyMembershipsPageContent } from "./MembershipsPageContent";
import { BundleMembershipsPageContent } from "./BundleMembershipsPageContent";

export const metadata: Metadata = {
  title: "Membership | LDMA 50th Anniversary",
  description:
    "Join LDMA — 12 private campgrounds across 8 states, gold prospecting, family-friendly camping from $6/night. Customize your membership to fit your adventure.",
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
