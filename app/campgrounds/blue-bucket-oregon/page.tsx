import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CampPageTemplate } from "@/components/CampPageTemplate";
import { blueBucketData } from "@/lib/camp-page-data";

export const metadata: Metadata = {
  title: "Blue Bucket Camp | LDMA Oregon",
  description:
    "LDMA Blue Bucket: 118 acres near Huntington, OR. Gold in stream and bench gravel. RV hookups, clubhouse, wildlife. Elk, deer, chukar. Membership required.",
};

export default function BlueBucketCampPage() {
  return (
    <>
      <Navbar />
      <main className="pt-16 md:pt-20 min-h-screen bg-[#1a120b]">
        <CampPageTemplate camp={blueBucketData} />
      </main>
      <Footer />
    </>
  );
}
