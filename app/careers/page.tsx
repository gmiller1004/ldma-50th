import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Careers | LDMA 50th Anniversary",
  description:
    "Career opportunities with the Lost Dutchman's Mining Association. Join our team.",
};

export default function CareersPage() {
  return (
    <>
      <Navbar />
      <main className="pt-16 md:pt-20 min-h-screen bg-[#1a120b]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 md:py-24 text-center">
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-[#f0d48f] mb-4">
            Careers
          </h1>
          <p className="text-[#e8e0d5]/90 text-lg leading-relaxed mb-8">
            We have no current openings at this time.
          </p>
          <p className="text-[#e8e0d5]/70 mb-8">
            Check back soon or contact us at{" "}
            <a
              href="mailto:lostdutchman@myldma.com"
              className="text-[#d4af37] hover:text-[#f0d48f] underline"
            >
              lostdutchman@myldma.com
            </a>{" "}
            to inquire about future opportunities.
          </p>
          <Link
            href="/"
            className="inline-flex px-6 py-3 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
