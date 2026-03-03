"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  MapPin,
  ArrowRight,
  Pickaxe,
  Tent,
  ShowerHead,
  Flame,
  Mountain,
} from "lucide-react";

const featuredCamps = [
  {
    name: "Italian Bar, California",
    subtitle: "The Original — First LDMA Camp (1977)",
    description:
      "Built on the historic 1850s gold rush site along the South Fork Stanislaus River. Gold panning, sluicing, and river relaxation — many members find their first gold here.",
    amenities: [
      "Showers & Restrooms",
      "Clubhouse & Fire Pit",
      "160 Patented Acres",
      "Trash & Dump Station",
    ],
    address: "24997 Italian Bar Rd, Columbia, CA 95310",
    image: "/images/home/campgrounds/italian-bar.jpg",
    link: "/campgrounds/italian-bar-california",
  },
  {
    name: "Stanton, Arizona",
    subtitle: "The Flagship Ghost-Town Camp",
    description:
      "Former 1800s outlaw hideout turned premier prospecting destination at the base of Rich Hill. History and gold everywhere you look.",
    amenities: [
      "132 Full Hookups",
      "Laundry & Museum",
      "Craft Room",
      "Community Events",
    ],
    address: "15650 Stanton Rd, Congress, AZ 85332",
    image: "/images/home/campgrounds/stanton.jpg",
    link: "/campgrounds/stanton-arizona",
  },
  {
    name: "Burnt River, Oregon",
    subtitle: "Eastern Oregon Wilderness",
    description:
      "Breathtaking river canyon views and peaceful prospecting. Spot deer, turkeys & bighorn sheep while you chase gold in the wild.",
    amenities: [
      "RV + Tent Sites",
      "Showers & Fire Pit",
      "Water & Trash",
      "Dump Station",
    ],
    address: "28089 Burnt River Canyon Ln, Durkee, OR 97905",
    image: "/images/home/campgrounds/burnt-river.jpg",
    link: "/campgrounds/burnt-river-oregon",
  },
  {
    name: "Loud Mine, Georgia",
    subtitle: "Southern Gold Country",
    description:
      "Tranquil wooded hills just 5 miles from Cleveland Town Square. Swim, fish, kayak, hike — and find gold in the streams and benches.",
    amenities: [
      "RV Hookups",
      "Laundry & Craft Room",
      "Game Room & Fire Pit",
      "Family Activities",
    ],
    address: "575 Abb Helton Rd, Cleveland, GA 30528",
    image: "/images/home/campgrounds/loud-mine.jpg",
    link: "/campgrounds/loud-mine-georgia",
  },
];

const amenityIcons = [Pickaxe, Tent, ShowerHead, Flame, Mountain];

export function Campgrounds() {
  return (
    <motion.section
      className="py-20 md:py-28 bg-[#0f3d1e]/30"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6 }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <motion.h2
          className="font-serif text-3xl md:text-4xl font-bold text-[#f0d48f] text-center mb-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          Featured LDMA Campgrounds
        </motion.h2>
        <motion.p
          className="text-center text-[#e8e0d5] mb-16 max-w-2xl mx-auto text-lg"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          50 Years of Private Gold-Bearing Land — Start Your Adventure at These
          Iconic Sites
        </motion.p>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-10">
          {featuredCamps.map((camp, i) => (
            <CampCard key={camp.name} camp={camp} index={i} />
          ))}
        </div>
      </div>
    </motion.section>
  );
}

function CampCard({
  camp,
  index,
}: {
  camp: (typeof featuredCamps)[0];
  index: number;
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <motion.article
      className="group bg-[#1a120b] rounded-2xl overflow-hidden border border-[#d4af37]/25 hover:border-[#d4af37]/50 transition-all duration-300"
      initial={false}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      whileHover={{ y: -6, scale: 1.02, transition: { duration: 0.2 } }}
      style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}
    >
      {/* Image - 4:3 aspect */}
      <div className="relative aspect-[4/3] overflow-hidden">
        {!imgError ? (
          <Image
            src={camp.image}
            alt={camp.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 768px) 100vw, 50vw"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="absolute inset-0 bg-[#0f3d1e]/40 flex items-center justify-center">
            <Mountain className="w-20 h-20 text-[#d4af37]/30" strokeWidth={1} />
          </div>
        )}
        {/* Gold overlay on hover */}
        <div className="absolute inset-0 bg-[#d4af37]/0 group-hover:bg-[#d4af37]/10 transition-colors duration-300" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a120b] via-transparent to-transparent" />
      </div>

      <div className="p-6">
        <h3 className="font-serif text-xl font-bold text-[#f0d48f] mb-1">
          {camp.name}
        </h3>
        <p className="text-[#d4af37]/90 text-sm italic mb-4">{camp.subtitle}</p>
        <p className="text-[#e8e0d5]/85 text-sm leading-relaxed mb-4 line-clamp-2">
          {camp.description}
        </p>

        {/* Amenities - gold pills with icons */}
        <div className="flex flex-wrap gap-2 mb-4">
          {camp.amenities.map((amenity, ai) => {
            const Icon =
              amenityIcons[ai % amenityIcons.length];
            return (
              <span
                key={amenity}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/30 text-[#d4af37] text-xs font-medium"
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} />
                {amenity}
              </span>
            );
          })}
        </div>

        {/* Address */}
        <div className="flex items-start gap-2 text-[#e8e0d5]/60 text-xs mb-6">
          <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{camp.address}</span>
        </div>

        {/* CTA */}
        <Link
          href={camp.link}
          className="inline-flex items-center gap-2 w-full justify-center sm:w-auto px-6 py-3.5 bg-[#d4af37] text-[#1a120b] font-bold rounded-lg hover:bg-[#f0d48f] transition-all shadow-[0_0_15px_rgba(212,175,55,0.2)] group-hover:shadow-[0_0_25px_rgba(212,175,55,0.35)]"
        >
          Explore Camp
          <ArrowRight className="w-5 h-5" strokeWidth={2} />
        </Link>
      </div>
    </motion.article>
  );
}
