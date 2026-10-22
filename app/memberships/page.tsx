import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MembershipsPageContent as LegacyMembershipsPageContent } from "./MembershipsPageContent";
import { BundleMembershipsPageContent } from "./BundleMembershipsPageContent";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Lifetime Membership + Garrett Axiom Lite | LDMA 50th Anniversary",
    description:
      "Lifetime membership in the Lost Dutchman's Mining Association and the Gold Prospectors Association of America. Includes a Companion membership to share with anyone, the right to pass yours on to a person of your choice, a Garrett Axiom Lite gold detector, and PayDirt. Member camping from $6/night.",
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
          <BundleMembershipsPageContent />
        ) : (
          <LegacyMembershipsPageContent />
        )}
      </main>
      <Footer />
    </>
  );
}
