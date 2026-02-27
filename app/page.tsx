import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { Timeline } from "@/components/Timeline";
import { MemberStories } from "@/components/MemberStories";
import { Campgrounds } from "@/components/Campgrounds";
import { MerchSpotlight } from "@/components/MerchSpotlight";
import { CTABanner } from "@/components/CTABanner";
import { Footer } from "@/components/Footer";

// Revalidate every 5 min — merch section stays fresh when you add products
export const revalidate = 300;

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="pt-16 md:pt-20">
        <Hero />
        <Timeline />
        <MemberStories />
        <Campgrounds />
        <MerchSpotlight />
        <CTABanner />
        <Footer />
      </main>
    </>
  );
}
