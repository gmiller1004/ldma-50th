import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Membership Terms & Conditions | LDMA 50th Anniversary",
  description:
    "Terms and conditions for LDMA membership. Review the rules and policies governing your membership in the Lost Dutchman's Mining Association.",
};

export default function MembershipTermsPage() {
  return (
    <>
      <Navbar />
      <main className="pt-16 md:pt-20 min-h-screen bg-[#1a120b]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 md:py-24">
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-[#f0d48f] mb-4">
            Membership Terms & Conditions
          </h1>
          <p className="text-[#e8e0d5]/60 text-sm mb-12">
            Last updated: February 2025
          </p>

          <div className="prose prose-invert prose-sm max-w-none space-y-8 text-[#e8e0d5]/90">
            <p className="leading-relaxed">
              Please contact LDMA for the current membership terms and conditions.
              Call (888) 465-3717 or email{" "}
              <a
                href="mailto:lostdutchman@myldma.com"
                className="text-[#d4af37] hover:text-[#f0d48f] underline"
              >
                lostdutchman@myldma.com
              </a>
              .
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
