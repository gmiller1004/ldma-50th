import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { FiftyYearsPageContent } from "./FiftyYearsPageContent";

export const metadata: Metadata = {
  title: "50 Years | LDMA 50th Anniversary",
  description:
    "Five decades of gold, grit, and brotherhood. Explore LDMA's journey from the first outing at Italian Bar to 12 camps across America.",
};

export default function FiftyYearsPage() {
  return (
    <>
      <Navbar />
      <main className="pt-16 md:pt-20 min-h-screen bg-[#1a120b]">
        <FiftyYearsPageContent />
      </main>
      <Footer />
    </>
  );
}
