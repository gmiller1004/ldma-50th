import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MembershipsPageContent } from "./MembershipsPageContent";

export const metadata: Metadata = {
  title: "Membership | LDMA 50th Anniversary",
  description:
    "Join LDMA — 12 private campgrounds across 8 states, gold prospecting, family-friendly camping from $6/night. Customize your membership to fit your adventure.",
};

export default function MembershipsPage() {
  return (
    <>
      <Navbar />
      <main className="pt-16 md:pt-20 min-h-screen bg-[#1a120b]">
        <MembershipsPageContent />
      </main>
      <Footer />
    </>
  );
}
