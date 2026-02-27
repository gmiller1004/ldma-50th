import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { StantonCampContent } from "./StantonCampContent";

export const metadata: Metadata = {
  title: "Stanton Camp | LDMA Arizona",
  description:
    "LDMA's flagship camp: restored 1870s ghost town on 120 patented acres near Congress, AZ. 132 full-hookup RV sites, museum, clubhouse, gold prospecting. Membership required.",
};

export default function StantonCampPage() {
  return (
    <>
      <Navbar />
      <main className="pt-16 md:pt-20 min-h-screen bg-[#1a120b]">
        <StantonCampContent />
      </main>
      <Footer />
    </>
  );
}
