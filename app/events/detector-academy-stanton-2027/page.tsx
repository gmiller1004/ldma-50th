import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { DETECTOR_ACADEMY_DATES_LABEL, DETECTOR_ACADEMY_NAME } from "@/lib/detector-academy";
import { DetectorAcademyContent } from "./DetectorAcademyContent";

const description =
  "Four days of hands-on detector training at LDMA's Stanton, Arizona camp, built around the Garrett Axiom, Axiom Lite, and GoldMaster 24k: test gardens, guided hunts on real gold claims, and one-on-one tuning.";

export const metadata: Metadata = {
  title: `${DETECTOR_ACADEMY_NAME} at Stanton, AZ | ${DETECTOR_ACADEMY_DATES_LABEL}`,
  description,
  openGraph: {
    title: `${DETECTOR_ACADEMY_NAME} · Stanton, AZ`,
    description,
    images: [{ url: "/images/about-events/detector-events.jpg" }],
  },
};

export default function DetectorAcademyPage() {
  return (
    <>
      <Navbar />
      <main className="pt-16 md:pt-20 min-h-screen bg-[#1a120b]">
        <DetectorAcademyContent />
      </main>
      <Footer />
    </>
  );
}
