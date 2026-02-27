import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CampPageTemplate } from "@/components/CampPageTemplate";
import { burntRiverData } from "@/lib/camp-page-data";

export const metadata: Metadata = {
  title: "Burnt River Camp | LDMA Oregon",
  description:
    "LDMA Burnt River: 136 acres along Burnt River & Deer Creek near Durkee, OR. Rose gold, highbanking, primitive camping. Wildlife, camp digs. Membership required.",
};

export default function BurntRiverCampPage() {
  return (
    <>
      <Navbar />
      <main className="pt-16 md:pt-20 min-h-screen bg-[#1a120b]">
        <CampPageTemplate camp={burntRiverData} />
      </main>
      <Footer />
    </>
  );
}
