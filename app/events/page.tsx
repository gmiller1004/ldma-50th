import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { getEventProducts } from "@/lib/shopify";
import { verifySessionToken } from "@/lib/session";
import { EventsPageContent } from "./EventsPageContent";

export const revalidate = 300;
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Events | LDMA 50th Anniversary",
  description:
    "Gold Diggin's, Dirt Party, detector days, and more across LDMA campgrounds. Register for gold prospecting events at Stanton, Italian Bar, Oconee, and more.",
};

export default async function EventsPage() {
  try {
    let events: Awaited<ReturnType<typeof getEventProducts>> = [];
    try {
      events = await getEventProducts();
    } catch {
      events = [];
    }

    const cookieStore = await cookies();
    const token = cookieStore.get("member_session")?.value;
    const session = token ? await verifySessionToken(token) : null;
    const isMemberLoggedIn = !!session;

    return (
      <>
        <Navbar />
        <main className="pt-16 md:pt-20 min-h-screen bg-[#1a120b]">
          <Suspense fallback={<div className="py-24 text-center text-[#e8e0d5]/60">Loading events…</div>}>
            <EventsPageContent events={events} isMemberLoggedIn={isMemberLoggedIn} />
          </Suspense>
        </main>
        <Footer />
      </>
    );
  } catch {
    // Defensive: if anything throws during render (e.g. revalidation after add-to-cart cookie), show page without crashing.
    return (
      <>
        <Navbar />
        <main className="pt-16 md:pt-20 min-h-screen bg-[#1a120b]">
          <Suspense fallback={<div className="py-24 text-center text-[#e8e0d5]/60">Loading events…</div>}>
            <EventsPageContent events={[]} isMemberLoggedIn={false} />
          </Suspense>
        </main>
        <Footer />
      </>
    );
  }
}
