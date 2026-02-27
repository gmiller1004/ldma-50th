import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CampPageTemplate } from "@/components/CampPageTemplate";
import { oconeeData } from "@/lib/camp-page-data";

export const metadata: Metadata = {
  title: "Oconee Camp | LDMA South Carolina",
  description:
    "LDMA Oconee: 120 acres in Blue Ridge foothills near Tamassee, SC. Gold panning, gem hunting (quartz, garnets, rubies). Panning station, equipment rentals. Membership required.",
};

export default function OconeeCampPage() {
  return (
    <>
      <Navbar />
      <main className="pt-16 md:pt-20 min-h-screen bg-[#1a120b]">
        <CampPageTemplate camp={oconeeData} />
      </main>
      <Footer />
    </>
  );
}
