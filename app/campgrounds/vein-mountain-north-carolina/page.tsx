import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CampPageTemplate } from "@/components/CampPageTemplate";
import { veinMountainData } from "@/lib/camp-page-data";

export const metadata: Metadata = {
  title: "Vein Mountain Camp | LDMA North Carolina",
  description:
    "LDMA Vein Mountain: 130 acres near Nebo, NC. Gold-bearing quartz veins, alluvial gravels. RV hookups, clubhouse. Family weekend getaways. Membership required.",
};

export default function VeinMountainCampPage() {
  return (
    <>
      <Navbar />
      <main className="pt-16 md:pt-20 min-h-screen bg-[#1a120b]">
        <CampPageTemplate camp={veinMountainData} />
      </main>
      <Footer />
    </>
  );
}
