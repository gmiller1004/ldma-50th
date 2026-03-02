"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useInView } from "framer-motion";

const BUZZARD_VIDEO_ID = "crebSQsGM3o";

const milestones = [
  {
    year: "1976",
    title: "LDMA Founded",
    description:
      'George "Buzzard" Massie establishes the Lost Dutchman\'s Mining Association with a vision of gold, grit, and brotherhood.',
  },
  {
    year: "1976",
    title: "First Outing – Italian Bar",
    description:
      "Thanksgiving at Italian Bar, CA — the very first LDMA adventure on the historic South Fork Stanislaus River gravel bar.",
  },
  {
    year: "1977",
    title: "Italian Bar Acquired",
    description:
      "First official camp purchased — 160 acres of patented mining claims rebuilt from the ground up on 1850s gold rush grounds.",
  },
  {
    year: "Early 1980s",
    title: "Stanton, AZ – Camp #2",
    description:
      "Iconic ghost town purchased and lovingly restored by members into one of America's best-preserved gold camps.",
  },
  {
    year: "1980s–1990s",
    title: "Nationwide Expansion",
    description:
      "Camps added across CA, AZ, OR, GA, NC, SC and beyond — thousands of acres of private gold-bearing claims.",
  },
  {
    year: "2000s",
    title: "Membership Boom",
    description:
      "Grows to thousands of families enjoying year-round access, hook-ups, and legendary finds.",
  },
  {
    year: "2010s",
    title: "Modern Era",
    description:
      "12 premier RV campgrounds, caretaker program, and the birth of signature events like DirtFest.",
  },
  {
    year: "2026",
    title: "50 Years Strong",
    description:
      "Celebrating half a century of gold prospecting, camaraderie, and living history. The legacy continues with YOU.",
  },
];

const stats = [
  { value: "50", label: "Years" },
  { value: "12", label: "Camps" },
  { value: "8+", label: "States" },
  { value: "6,500+", label: "Members" },
];

const thenNowItems = [
  {
    camp: "Vein Mountain",
    thenTitle: "1990s–2000s",
    thenText: "Early days at the North Carolina camp — quartz veins and alluvial gold in the Blue Ridge.",
    thenVideoId: "4zx-ZobLxh0",
    nowTitle: "Today",
    nowText: "130 acres with RV hookups, clubhouse, and gold-bearing quartz veins. Family weekend getaways in a tranquil wooded setting.",
    nowImage: "/images/50-years/now-vein-mountain.jpg",
  },
  {
    camp: "Finley Camp",
    thenTitle: "1990s–2000s",
    thenText: "Vintage footage from the Northern California camp — North Fork Salmon River and Russian Creek.",
    thenVideoId: "6LieKbr1vO4",
    nowTitle: "Today",
    nowText: "140 acres at 2,600 ft with North Fork Salmon River & Russian Creek. Primitive, shaded, self-contained camping.",
    nowImage: "/images/50-years/now-finley.jpg",
  },
  {
    camp: "Burnt River",
    thenTitle: "1990s–2000s",
    thenText: "Early outings along Burnt River and Deer Creek in Eastern Oregon — where the rose gold runs.",
    thenVideoId: "B2CYXuFrZXg",
    nowTitle: "Today",
    nowText: "136 acres with showers, clubhouse, and dump station. Camp digs, potlucks, and famed rose gold finds.",
    nowImage: "/images/50-years/now-burnt-river.jpg",
  },
  {
    camp: "Loud Mine",
    thenTitle: "1990s–2000s",
    thenText: "Footage from the Dahlonega gold belt — stream gold and family prospecting in Georgia.",
    thenVideoId: "u090tsHfIVI",
    nowTitle: "Today",
    nowText: "37 acres with RV hookups, pavilion, clubhouse, and rich stream gold. Swim, fish, kayak, and hunt for gold.",
    nowImage: "/images/50-years/now-loud-mine.jpg",
  },
  {
    camp: "Stanton",
    thenTitle: "1990s–2000s",
    thenText: "The Arizona ghost town in early LDMA days — before and during member restoration.",
    thenVideoId: "VkhLiYOADJA",
    nowTitle: "Today",
    nowText: "One of America's best-preserved gold camps — historic Hotel Stanton, museum, clubhouse, and 197 RV sites.",
    nowImage: "/images/50-years/now-stanton.jpg",
  },
  {
    camp: "Duisenburg",
    thenTitle: "1990s–2000s",
    thenText: "High desert prospecting in the Mojave — metal detecting and dry washing near Randsburg.",
    thenVideoId: "jZxiqJWkuyo",
    nowTitle: "Today",
    nowText: "160 acres of Mojave gold country. Primitive RV and tent camping, clubhouse, and 40+ years of desert prospecting.",
    nowImage: "/images/50-years/now-duisenburg.jpg",
  },
  {
    camp: "Italian Bar",
    thenTitle: "1990s–2000s",
    thenText: "The Buzzard and early members at the first LDMA camp — the South Fork Stanislaus.",
    thenVideoId: "fA9_x6Wlng8",
    nowTitle: "Today",
    nowText: "160 acres of river access, RV hookups, clubhouse, and gold panning. The first LDMA camp, still going strong.",
    nowImage: "/images/50-years/now-italian-bar.jpg",
  },
  {
    camp: "Oconee",
    thenTitle: "1990s–2000s",
    thenText: "Early days in the Blue Ridge foothills — gold panning and gem hunting in South Carolina.",
    thenVideoId: "3zw1CoD2904",
    nowTitle: "Today",
    nowText: "120 acres with panning station, equipment rentals, and gem hunting — quartz, garnets, and rubies.",
    nowImage: "/images/50-years/now-oconee.jpg",
  },
];

function TimelineCard({
  year,
  title,
  description,
  index,
}: (typeof milestones)[0] & { index: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: index % 2 === 0 ? -40 : 40 }}
      animate={isInView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative flex gap-6 md:gap-10 items-start"
    >
      <div className="flex-shrink-0 flex flex-col items-center">
        <div className="w-4 h-4 rounded-full bg-[#d4af37] ring-4 ring-[#0f3d1e] shadow-lg" />
        {index < milestones.length - 1 && (
          <div className="w-0.5 flex-1 min-h-[50px] bg-gradient-to-b from-[#d4af37] to-[#d4af37]/30 mt-2" />
        )}
      </div>
      <div className="flex-1 pb-10">
        <span className="inline-block text-[#d4af37] font-serif text-xl font-bold mb-1">
          {year}
        </span>
        <h3 className="text-lg font-serif font-semibold text-[#f0d48f] mb-2">
          {title}
        </h3>
        <p className="text-[#e8e0d5]/80 text-sm leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}

function StatCard({
  value,
  label,
  index,
}: {
  value: string;
  label: string;
  index: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="text-center px-6 py-6 rounded-xl bg-[#0f3d1e]/30 border border-[#d4af37]/20"
    >
      <div className="font-serif text-4xl md:text-5xl font-bold text-[#d4af37] mb-1">
        {value}
      </div>
      <div className="text-[#e8e0d5]/70 text-sm font-medium">{label}</div>
    </motion.div>
  );
}

export function FiftyYearsPageContent() {
  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        <nav aria-label="Breadcrumb" className="py-4">
          <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-[#e8e0d5]/70">
            <li>
              <Link href="/" className="hover:text-[#d4af37] transition-colors">
                Home
              </Link>
            </li>
            <li className="flex items-center gap-1.5">
              <span className="text-[#d4af37]/50">/</span>
              <span className="text-[#e8e0d5] font-medium" aria-current="page">
                50 Years
              </span>
            </li>
          </ol>
        </nav>
      </div>

      {/* Hero */}
      <section className="relative py-20 md:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f3d1e]/40 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(212,175,55,0.08)_0%,transparent_70%)]" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <motion.span
            className="inline-block px-3 py-1 rounded bg-[#d4af37]/20 text-[#d4af37] text-sm font-medium mb-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            1976 → 2026
          </motion.span>
          <motion.h1
            className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-[#f0d48f] tracking-tight mb-4"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            50 Years of Gold, Grit & Brotherhood
          </motion.h1>
          <motion.p
            className="text-[#e8e0d5]/90 text-lg md:text-xl max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            From the first Thanksgiving outing at Italian Bar to 12 camps across
            America — the story of the Lost Dutchman&apos;s Mining Association.
          </motion.p>
        </div>
      </section>

      {/* Featured video */}
      <section className="py-16 md:py-24 border-t border-[#d4af37]/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <motion.h2
            className="font-serif text-2xl md:text-3xl font-bold text-[#f0d48f] text-center mb-4"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Way Back When
          </motion.h2>
          <motion.p
            className="text-center text-[#e8e0d5]/70 mb-10 max-w-xl mx-auto"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            The Buzzard at an early LDMA outing at Italian Bar — where it all
            began.
          </motion.p>
          <motion.div
            className="relative aspect-video rounded-xl overflow-hidden border border-[#d4af37]/20 bg-black"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <iframe
              src={`https://www.youtube.com/embed/${BUZZARD_VIDEO_ID}?rel=0`}
              title="The Buzzard at Italian Bar - LDMA早期外出"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          </motion.div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-16 md:py-24 bg-[#0f3d1e]/10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <motion.h2
            className="font-serif text-2xl md:text-3xl font-bold text-[#f0d48f] text-center mb-4"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Our Journey
          </motion.h2>
          <motion.p
            className="text-center text-[#e8e0d5]/70 mb-14"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            Five decades of adventure, discovery, and fellowship
          </motion.p>

          <div className="relative">
            {milestones.map((m, i) => (
              <TimelineCard key={`${m.year}-${m.title}-${i}`} {...m} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* Then & Now */}
      <section className="py-16 md:py-24 border-t border-[#d4af37]/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.h2
            className="font-serif text-2xl md:text-3xl font-bold text-[#f0d48f] text-center mb-4"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Then & Now
          </motion.h2>
          <motion.p
            className="text-center text-[#e8e0d5]/70 mb-14 max-w-xl mx-auto"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            How our flagship camps have evolved over the decades
          </motion.p>

          <div className="space-y-16">
            {thenNowItems.map((item, i) => (
              <motion.div
                key={item.camp}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                className="grid md:grid-cols-2 gap-8 md:gap-12 items-start"
              >
                <div className="space-y-4">
                  <h3 className="font-serif text-xl font-semibold text-[#d4af37]">
                    {item.camp}
                  </h3>
                  <div>
                    <h4 className="text-[#f0d48f] font-medium text-sm mb-1">
                      {item.thenTitle}
                    </h4>
                    <p className="text-[#e8e0d5]/80 text-sm leading-relaxed">
                      {item.thenText}
                    </p>
                  </div>
                  <div className="relative aspect-video rounded-lg overflow-hidden border border-[#d4af37]/20">
                    <iframe
                      src={`https://www.youtube.com/embed/${item.thenVideoId}?rel=0`}
                      title={`${item.camp} - Then`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="absolute inset-0 w-full h-full"
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="h-8" />
                  <div>
                    <h4 className="text-[#f0d48f] font-medium text-sm mb-1">
                      {item.nowTitle}
                    </h4>
                    <p className="text-[#e8e0d5]/80 text-sm leading-relaxed">
                      {item.nowText}
                    </p>
                  </div>
                  <div className="relative aspect-[4/3] rounded-lg overflow-hidden border border-[#d4af37]/20">
                    <Image
                      src={item.nowImage}
                      alt={`${item.camp} - Now`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* By the numbers */}
      <section className="py-16 md:py-24 bg-[#0f3d1e]/10 border-t border-[#d4af37]/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <motion.h2
            className="font-serif text-2xl md:text-3xl font-bold text-[#f0d48f] text-center mb-4"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            50 Years by the Numbers
          </motion.h2>
          <motion.p
            className="text-center text-[#e8e0d5]/70 mb-12"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            A legacy built by members, for members
          </motion.p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {stats.map((s, i) => (
              <StatCard key={s.label} {...s} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f3d1e]/50 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(212,175,55,0.1)_0%,transparent_70%)]" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <motion.h2
            className="font-serif text-3xl md:text-4xl font-bold text-[#f0d48f] mb-4"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Be Part of the Next 50
          </motion.h2>
          <motion.p
            className="text-[#e8e0d5]/90 text-lg mb-10"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            Join thousands of members prospecting across 12 premier camps. Get
            access to exclusive events, claims, and a community built on 50 years
            of gold, grit, and brotherhood.
          </motion.p>
          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Link
              href="/memberships"
              className="inline-flex items-center justify-center px-8 py-4 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors"
            >
              Explore Memberships
            </Link>
            <Link
              href="/events"
              className="inline-flex items-center justify-center px-8 py-4 border border-[#d4af37]/50 text-[#d4af37] font-semibold rounded-lg hover:bg-[#d4af37]/10 transition-colors"
            >
              View 2026 Events
            </Link>
          </motion.div>
        </div>
      </section>
    </>
  );
}
