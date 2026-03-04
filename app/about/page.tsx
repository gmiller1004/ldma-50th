import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import Link from "next/link";
import { Mountain, Users, MapPin, Calendar } from "lucide-react";

export const metadata: Metadata = {
  title: "About LDMA | Lost Dutchman's Mining Association - 50 Years of Gold Prospecting",
  description:
    "The Lost Dutchman's Mining Association has been bringing families together through gold prospecting and RV camping since 1976. 12 private campgrounds, 6,500+ members, and countless memories.",
  openGraph: {
    title: "About LDMA | 50 Years of Gold, Discovery, and Adventure",
    description:
      "Since 1976, LDMA has offered exclusive access to gold-bearing land, family-friendly camping, and a community of adventurers. Learn our story.",
  },
};

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="pt-16 md:pt-20 min-h-screen bg-[#1a120b]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 md:py-24">
          <span className="inline-block px-3 py-1 rounded bg-[#d4af37]/20 text-[#d4af37] text-sm font-medium mb-6">
            50 Years Strong
          </span>
          <h1 className="font-serif text-4xl md:text-6xl font-bold text-[#f0d48f] mb-6">
            About the Lost Dutchman&apos;s Mining Association
          </h1>
          <p className="text-[#e8e0d5]/90 text-xl leading-relaxed mb-12">
            Since 1976, the LDMA has been the premier gold mining and camping
            club in America — combining the thrill of gold prospecting with the
            camaraderie of RV camping on private, gold-bearing land.
          </p>

          <div className="grid sm:grid-cols-2 gap-6 mb-16">
            <div className="flex gap-4 p-6 rounded-xl bg-[#0f3d1e]/30 border border-[#d4af37]/20">
              <Users className="w-10 h-10 text-[#d4af37] flex-shrink-0" />
              <div>
                <h3 className="font-serif text-lg font-semibold text-[#f0d48f] mb-1">
                  6,500+ Members
                </h3>
                <p className="text-[#e8e0d5]/80 text-sm">
                  A thriving community of prospectors and outdoor enthusiasts
                </p>
              </div>
            </div>
            <div className="flex gap-4 p-6 rounded-xl bg-[#0f3d1e]/30 border border-[#d4af37]/20">
              <MapPin className="w-10 h-10 text-[#d4af37] flex-shrink-0" />
              <div>
                <h3 className="font-serif text-lg font-semibold text-[#f0d48f] mb-1">
                  12 Private Campgrounds
                </h3>
                <p className="text-[#e8e0d5]/80 text-sm">
                  Across 8 states — California, Arizona, Oregon, Colorado, and more
                </p>
              </div>
            </div>
            <div className="flex gap-4 p-6 rounded-xl bg-[#0f3d1e]/30 border border-[#d4af37]/20">
              <Mountain className="w-10 h-10 text-[#d4af37] flex-shrink-0" />
              <div>
                <h3 className="font-serif text-lg font-semibold text-[#f0d48f] mb-1">
                  30+ Mining Claims
                </h3>
                <p className="text-[#e8e0d5]/80 text-sm">
                  Exclusive access to gold-bearing dirt — keep what you find
                </p>
              </div>
            </div>
            <div className="flex gap-4 p-6 rounded-xl bg-[#0f3d1e]/30 border border-[#d4af37]/20">
              <Calendar className="w-10 h-10 text-[#d4af37] flex-shrink-0" />
              <div>
                <h3 className="font-serif text-lg font-semibold text-[#f0d48f] mb-1">
                  Since 1976
                </h3>
                <p className="text-[#e8e0d5]/80 text-sm">
                  Nearly 50 years of gold, discovery, and adventure
                </p>
              </div>
            </div>
          </div>

          <div className="prose prose-invert prose-lg max-w-none space-y-8">
            <section>
              <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#f0d48f] mb-4">
                Our Story
              </h2>
              <p className="text-[#e8e0d5]/90 leading-relaxed">
                The Lost Dutchman&apos;s Mining Association was founded in 1976,
                inspired by the legend of the Lost Dutchman&apos;s Gold Mine in
                Arizona&apos;s Superstition Mountains. What began as a small
                group of gold-seeking adventurers has grown into one of
                America&apos;s largest and most beloved mining clubs. Our first
                camp, Italian Bar in California, opened on historic 1850s gold
                rush territory along the South Fork Stanislaus River — and we
                haven&apos;t stopped expanding since.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#f0d48f] mb-4">
                Gold Prospecting & Family Camping
              </h2>
              <p className="text-[#e8e0d5]/90 leading-relaxed mb-4">
                LDMA is built on a simple idea: one membership opens the door to
                countless memories. Whether you&apos;re panning for gold, metal
                detecting, dry washing, high-banking, or simply enjoying the
                outdoors with family and friends, our campgrounds offer something
                for everyone. Members keep 100% of the gold they find. Camping
                rates are member-friendly — from $6/night for dry camping to
                $12/night for full RV hookups — and you can stay up to six
                months at a time at any property.
              </p>
              <p className="text-[#e8e0d5]/90 leading-relaxed">
                Beyond prospecting, members enjoy fishing, kayaking, ATV
                adventures, rock and gem collecting, and co-hosted events with
                industry partners like MineLab and Garrett. Nine of our 12 camps
                are developed with caretakers on site; five offer RV hookups. Our
                flagship camp, Stanton in Arizona, sits at the base of Rich Hill
                — one of the most legendary gold-bearing areas in the American
                West.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#f0d48f] mb-4">
                A Community That Feels Like Family
              </h2>
              <p className="text-[#e8e0d5]/90 leading-relaxed">
                LDMA isn&apos;t just about gold — it&apos;s about the people. Our
                members return year after year for the familiar faces, the shared
                stories, and the sense of belonging. Whether you&apos;re a
                seasoned prospector or brand new to the hobby, you&apos;ll find a
                welcoming community ready to teach, learn, and celebrate together.
              </p>
            </section>
          </div>

          <div className="mt-16 text-center">
            <Link
              href="/memberships"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors"
            >
              Join LDMA
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
