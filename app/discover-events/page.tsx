import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { getEventProducts } from "@/lib/shopify";
import { DiscoverEventsContent } from "./DiscoverEventsContent";

export const revalidate = 300;
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Discover LDMA Events | Gold Diggin's, Dirt Party & More",
  description:
    "New to LDMA? Weekends of gold panning, metal detecting, and camp adventure on private claims across 8 states. See upcoming Gold Diggin's, Dirt Party, and detector events.",
  openGraph: {
    title: "Discover LDMA Events",
    description:
      "Gold, adventure, and community at America's camps. Find your first LDMA weekend — no experience required.",
  },
};

export default async function DiscoverEventsPage() {
  let events: Awaited<ReturnType<typeof getEventProducts>> = [];
  try {
    events = await getEventProducts();
  } catch {
    events = [];
  }

  return (
    <>
      <Navbar />
      <main className="pt-16 md:pt-20 min-h-screen bg-[#1a120b]">
        <DiscoverEventsContent events={events} />
      </main>
      <Footer />
    </>
  );
}
