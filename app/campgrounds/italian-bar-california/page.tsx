import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CampPageTemplate } from "@/components/CampPageTemplate";
import { italianBarData } from "@/lib/camp-page-data";

export const metadata: Metadata = {
  title: "Italian Bar Camp | LDMA California",
  description:
    "LDMA's first camp: 160 acres on the South Fork Stanislaus River near Columbia, CA. Gold panning, sluicing, RV hookups, clubhouse. Open March–November. Membership required.",
};

export default function ItalianBarCampPage() {
  return (
    <>
      <Navbar />
      <main className="pt-16 md:pt-20 min-h-screen bg-[#1a120b]">
        <CampPageTemplate camp={italianBarData} />
      </main>
      <Footer />
    </>
  );
}
