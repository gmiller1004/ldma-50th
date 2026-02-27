"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const milestones = [
  {
    year: "1976",
    title: "The Founding",
    description:
      "LDMA is founded by a group of passionate prospectors, united by a shared love for gold hunting and the great outdoors.",
  },
  {
    year: "1982",
    title: "First Claims",
    description:
      "The association secures its first mining claims, establishing a foothold in the rich gold-bearing regions of the Southwest.",
  },
  {
    year: "1995",
    title: "Club Growth",
    description:
      "Membership grows significantly as word spreads about the camaraderie, expertise, and prime mining opportunities LDMA offers.",
  },
  {
    year: "2008",
    title: "Major Finds",
    description:
      "Several members report substantial discoveries, solidifying LDMA's reputation as a premier prospecting organization.",
  },
  {
    year: "2018",
    title: "Stanton Camp Expansions",
    description:
      "Major improvements and expansions at Stanton campground enhance facilities for members and their families.",
  },
  {
    year: "2026",
    title: "50th Anniversary",
    description:
      "Five decades of gold, grit, and brotherhood. The legacy continues as we celebrate our past and look to the future.",
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
            <TimelineCard key={m.year} {...m} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
