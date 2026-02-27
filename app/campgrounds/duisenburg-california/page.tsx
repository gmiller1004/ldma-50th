import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CampPageTemplate } from "@/components/CampPageTemplate";
import { duisenburgData } from "@/lib/camp-page-data";

export const metadata: Metadata = {
  title: "Duisenburg Camp | LDMA California",
  description:
    "LDMA's high desert camp: 160 acres near Randsburg in the Mojave. Metal detecting, dry washing, RV & tent camping, clubhouse, showers. Membership required.",
};

export default function DuisenburgCampPage() {
  return (
    <>
      <Navbar />
      <main className="pt-16 md:pt-20 min-h-screen bg-[#1a120b]">
        <CampPageTemplate camp={duisenburgData} />
      </main>
      <Footer />
    </>
  );
}
