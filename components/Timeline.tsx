"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const milestones = [
  {
    year: "1976",
    title: "LDMA Founded",
    description:
      'George "Buzzard" Massie establishes the Lost Dutchman\'s Mining Association with a vision of gold, discovery, and adventure.',
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

function TimelineCard({
  year,
  title,
  description,
  index,
}: (typeof milestones)[0] & { index: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
      animate={isInView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="relative flex gap-6 md:gap-12 items-start"
    >
      <div className="flex-shrink-0 flex flex-col items-center">
        <div className="w-4 h-4 rounded-full bg-[#d4af37] ring-4 ring-[#0f3d1e] shadow-lg" />
        {index < milestones.length - 1 && (
          <div className="w-0.5 flex-1 min-h-[60px] bg-gradient-to-b from-[#d4af37] to-[#d4af37]/30 mt-2" />
        )}
      </div>
      <div className="flex-1 pb-12">
        <span className="inline-block text-[#d4af37] font-serif text-2xl font-bold mb-1">
          {year}
        </span>
        <h3 className="text-xl font-serif font-semibold text-[#f0d48f] mb-2">
          {title}
        </h3>
        <p className="text-[#e8e0d5]/80 leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}

export function Timeline() {
  return (
    <section className="py-20 md:py-28 bg-[#0f3d1e]/20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <motion.h2
          className="font-serif text-3xl md:text-4xl font-bold text-[#f0d48f] text-center mb-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          Our Journey
        </motion.h2>
        <motion.p
          className="text-center text-[#e8e0d5]/70 mb-16"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          50 years of adventure, discovery, and fellowship
        </motion.p>

        <div className="relative">
          {milestones.map((m, i) => (
            <TimelineCard key={`${m.year}-${m.title}-${i}`} {...m} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
