import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Mail, Phone, MapPin } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact Us | LDMA 50th Anniversary",
  description:
    "Get in touch with the Lost Dutchman's Mining Association. Questions about membership, campgrounds, or gold prospecting? We're here to help.",
};

export default function ContactPage() {
  return (
    <>
      <Navbar />
      <main className="pt-16 md:pt-20 min-h-screen bg-[#1a120b]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 md:py-24">
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-[#f0d48f] text-center mb-4">
            Contact Us
          </h1>
          <p className="text-center text-[#e8e0d5]/80 text-lg mb-16">
            Have questions about membership, campgrounds, or your next gold
            prospecting adventure? We&apos;d love to hear from you.
          </p>

          <div className="space-y-8">
            <a
              href="tel:888-465-3717"
              className="flex items-start gap-4 p-6 rounded-xl bg-[#0f3d1e]/30 border border-[#d4af37]/20 hover:border-[#d4af37]/40 transition-colors group"
            >
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#d4af37]/15 flex items-center justify-center group-hover:bg-[#d4af37]/25 transition-colors">
                <Phone className="w-6 h-6 text-[#d4af37]" />
              </div>
              <div>
                <h2 className="font-serif text-xl font-semibold text-[#f0d48f] mb-1">
                  Call Us
                </h2>
                <p className="text-[#e8e0d5]/90">(888) 465-3717</p>
                <p className="text-[#e8e0d5]/60 text-sm mt-1">
                  Membership, campground reservations, and general inquiries
                </p>
              </div>
            </a>

            <a
              href="mailto:lostdutchman@myldma.com"
              className="flex items-start gap-4 p-6 rounded-xl bg-[#0f3d1e]/30 border border-[#d4af37]/20 hover:border-[#d4af37]/40 transition-colors group"
            >
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#d4af37]/15 flex items-center justify-center group-hover:bg-[#d4af37]/25 transition-colors">
                <Mail className="w-6 h-6 text-[#d4af37]" />
              </div>
              <div>
                <h2 className="font-serif text-xl font-semibold text-[#f0d48f] mb-1">
                  Email Us
                </h2>
                <p className="text-[#e8e0d5]/90">lostdutchman@myldma.com</p>
                <p className="text-[#e8e0d5]/60 text-sm mt-1">
                  We typically respond within 1–2 business days
                </p>
              </div>
            </a>

            <div className="flex items-start gap-4 p-6 rounded-xl bg-[#0f3d1e]/30 border border-[#d4af37]/20">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#d4af37]/15 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-[#d4af37]" />
              </div>
              <div>
                <h2 className="font-serif text-xl font-semibold text-[#f0d48f] mb-1">
                  Main Website
                </h2>
                <a
                  href="https://myldma.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#d4af37] hover:text-[#f0d48f] underline transition-colors"
                >
                  myldma.com
                </a>
                <p className="text-[#e8e0d5]/60 text-sm mt-1">
                  Membership, campground bookings, shop, and event info
                </p>
              </div>
            </div>
          </div>

          <div className="mt-16 text-center">
            <Link
              href="/memberships"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors"
            >
              Join LDMA
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
