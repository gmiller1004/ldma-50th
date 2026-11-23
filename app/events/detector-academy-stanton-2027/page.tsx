import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import {
  DETECTOR_ACADEMY_DATES_LABEL,
  DETECTOR_ACADEMY_NAME,
  DETECTOR_ACADEMY_PRODUCT_HANDLE,
} from "@/lib/detector-academy";
import { getEventProductByHandle } from "@/lib/shopify";
import { verifySessionToken } from "@/lib/session";
import { DetectorAcademyContent } from "./DetectorAcademyContent";

const description =
  "Four days of hands-on detector training at LDMA's Stanton, Arizona camp, built around the Garrett Axiom / Axiom Lite, GoldMaster 24k, and Pro-Pointer II: test gardens, guided hunts on real gold claims, and one-on-one tuning.";

export const metadata: Metadata = {
  title: `${DETECTOR_ACADEMY_NAME} at Stanton, AZ | ${DETECTOR_ACADEMY_DATES_LABEL}`,
  description,
  openGraph: {
    title: `${DETECTOR_ACADEMY_NAME} · Stanton, AZ`,
    description,
    images: [{ url: "/images/about-events/detector-events.jpg" }],
  },
};

export const dynamic = "force-dynamic";

export default async function DetectorAcademyPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("member_session")?.value;
  const session = token ? await verifySessionToken(token) : null;

  const event = await getEventProductByHandle(DETECTOR_ACADEMY_PRODUCT_HANDLE).catch(() => null);

  return (
    <>
      <Navbar />
      <main className="pt-16 md:pt-20 min-h-screen bg-[#1a120b]">
        <DetectorAcademyContent event={event} isMemberLoggedIn={!!session} />
      </main>
      <Footer />
    </>
  );
}
