import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CampPageTemplate } from "@/components/CampPageTemplate";
import { loudMineData } from "@/lib/camp-page-data";

export const metadata: Metadata = {
  title: "Loud Mine Camp | LDMA Georgia",
  description:
    "LDMA Loud Mine: 37 acres in Dahlonega gold belt, 5 miles from Cleveland, GA. Stream gold, RV hookups, pavilion. Swim, fish, kayak. Membership required.",
};

export default function LoudMineCampPage() {
  return (
    <>
      <Navbar />
      <main className="pt-16 md:pt-20 min-h-screen bg-[#1a120b]">
        <CampPageTemplate camp={loudMineData} />
      </main>
      <Footer />
    </>
  );
}
