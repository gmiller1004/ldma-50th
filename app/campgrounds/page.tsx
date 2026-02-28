import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CampgroundsPageContent } from "./CampgroundsPageContent";

export const metadata: Metadata = {
  title: "Campgrounds | LDMA 50th Anniversary",
  description:
    "Explore our 12 private LDMA campgrounds across 8 states. Gold-bearing patented properties with full hookups, clubhouses, and wilderness adventures. Membership required for access.",
};

const mainCamps = [
  {
    name: "Stanton",
    state: "Arizona",
    tagline: "Flagship Camp • Historic Ghost Town",
    desc: "120 patented acres with full hookups, museum, clubhouse, laundry, and exclusive claims.",
    address: "15650 Stanton Rd, Congress, AZ 85332",
    image: "/images/campgrounds/stanton-arizona/camp-stanton.jpg",
    slug: "stanton-arizona",
  },
  {
    name: "Italian Bar",
    state: "California",
    tagline: "First LDMA Camp • River Gold",
    desc: "160 acres on the South Fork Stanislaus River where many members found their first gold.",
    address: "24997 Italian Bar Rd, Columbia, CA 95310",
    image: "/images/campgrounds/italian-bar-california/camp-italian-bar.jpg",
    slug: "italian-bar-california",
  },
  {
    name: "Duisenburg",
    state: "California",
    tagline: "High Desert Oasis",
    desc: "160 acres Mojave Desert near Randsburg. Showers, clubhouse, primitive RV/tent camping.",
    address: "L.D.M.A. Clubhouse, Ridgecrest, CA 93555",
    image: "/images/campgrounds/duisenburg-california/camp-duisenburg.jpg",
    slug: "duisenburg-california",
  },
  {
    name: "Blue Bucket",
    state: "Oregon",
    tagline: "Scenic Gold & Wildlife",
    desc: "118 acres with hookups, showers, laundry, and gold in stream/bench gravel. Elk, deer & chukar abound.",
    address: "31097 Valentine Lane, Huntington, OR 97907",
    image: "/images/campgrounds/blue-bucket-oregon/camp-blue-bucket.jpg",
    slug: "blue-bucket-oregon",
  },
  {
    name: "Burnt River",
    state: "Oregon",
    tagline: "Wilderness River Camp",
    desc: "136 acres along Burnt River & Deer Creek. Dry camping with showers, clubhouse, dump station.",
    address: "28089 Burnt River Canyon Ln, Durkee, OR 97905",
    image: "/images/campgrounds/burnt-river-oregon/camp-burnt-river.jpg",
    slug: "burnt-river-oregon",
  },
  {
    name: "Oconee",
    state: "South Carolina",
    tagline: "Rustic Blue Ridge Gem & Gold",
    desc: "120 acres with panning station, equipment rentals, fire pit, and gem hunting (quartz, garnets, rubies).",
    address: "475 LDMA Dr, Tamassee, SC 29686",
    image: "/images/campgrounds/oconee-south-carolina/camp-oconee.jpg",
    slug: "oconee-south-carolina",
  },
  {
    name: "Loud Mine",
    state: "Georgia",
    tagline: "Dahlonega Gold Belt",
    desc: "37 acres with hookups, pavilion, and rich stream gold near swimming & kayaking.",
    address: "575 Abb Helton Rd, Cleveland, GA 30528",
    image: "/images/campgrounds/loud-mine-georgia/camp-loud-mine.jpg",
    slug: "loud-mine-georgia",
  },
  {
    name: "Vein Mountain",
    state: "North Carolina",
    tagline: "Mother Lode in the Blue Ridge",
    desc: "130 acres with quartz veins, alluvial gravel, hookups, clubhouse, and family weekend vibes.",
    address: "3216 Vein Mt. Rd, Nebo, NC 28761",
    image: "/images/campgrounds/vein-mountain-north-carolina/camp-vein-mountain.jpg",
    slug: "vein-mountain-north-carolina",
  },
];

const additionalCamps = [
  {
    name: "Scott River",
    state: "California",
    highlight: "28 acres at historic Steelhead town site where Scott River meets Klamath River (Northern CA). Limited hookups.",
  },
  {
    name: "Finley",
    state: "California",
    highlight: "140 acres at 2,600 ft with North Fork Salmon River & Russian Creek running through. Primitive, shaded, self-contained.",
  },
  {
    name: "High Divide",
    state: "Nevada",
    highlight: "20 acres at 6,000+ ft south of Tonopah. Remote primitive placer gold/silver/turquoise. Self-contained only.",
  },
  {
    name: "Leadville",
    state: "Colorado",
    highlight: "60 acres in premier mining district at 10,430 ft. Seasonal creek. Primitive, self-contained.",
  },
];

export default function CampgroundsPage() {
  return (
    <>
      <Navbar />
      <main className="pt-16 md:pt-20 min-h-screen bg-[#1a120b]">
        <CampgroundsPageContent
          mainCamps={mainCamps}
          additionalCamps={additionalCamps}
        />
      </main>
      <Footer />
    </>
  );
}
