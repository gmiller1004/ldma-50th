import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Site Maintenance | LDMA 50th Anniversary",
  description:
    "The LDMA 50th Anniversary site is temporarily undergoing maintenance. Please check back soon.",
};

export default function MaintenancePage() {
  return (
    <>
      <Navbar />
      <main className="pt-16 md:pt-20 min-h-screen bg-[#1a120b]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 md:py-24 text-center">
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-[#f0d48f] mb-4">
            Site Maintenance
          </h1>
          <p className="text-[#e8e0d5]/90 text-lg leading-relaxed mb-8">
            We&apos;re making some improvements. Please check back soon.
          </p>
          <p className="text-[#e8e0d5]/70">
            For immediate assistance, call (888) 465-3717 or email{" "}
            <a
              href="mailto:lostdutchman@myldma.com"
              className="text-[#d4af37] hover:text-[#f0d48f] underline"
            >
              lostdutchman@myldma.com
            </a>
            .
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
