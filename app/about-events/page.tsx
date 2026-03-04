import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { AboutEventsContent } from "./AboutEventsContent";

export const metadata: Metadata = {
  title: "About LDMA Events | 50th Anniversary",
  description:
    "What are LDMA events? Dirt Fest, detector days, Gold N BBQ, and more — gold prospecting gatherings across our 12 campgrounds. Learn what to expect and how to join.",
};

export default function AboutEventsPage() {
  return (
    <>
      <Navbar />
      <main className="pt-16 md:pt-20 min-h-screen bg-[#1a120b]">
        <AboutEventsContent />
      </main>
      <Footer />
    </>
  );
}
