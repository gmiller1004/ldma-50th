"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { MapPin, ArrowRight, Mountain, MessageCircle } from "lucide-react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import type { DirectoryCamp } from "@/lib/directory-camps";

export function DirectoryPageContent({
  camps,
}: {
  camps: DirectoryCamp[];
}) {
  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Directory & Community" },
          ]}
        />
      </div>

      {/* Hero */}
      <section className="relative py-16 md:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f3d1e]/40 via-transparent to-transparent" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <motion.h1
            className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-[#f0d48f] tracking-tight mb-4"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            Camp Directory & Community
          </motion.h1>
          <motion.p
            className="text-[#e8e0d5]/90 text-lg md:text-xl max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            Explore camps, share trip reports, and join the conversation with
            fellow members
          </motion.p>
        </div>
      </section>

      {/* Camp grid */}
      <section className="pb-16 md:pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {camps.map((camp, i) => (
              <CampCard key={camp.slug} camp={camp} index={i} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function CampCard({
  camp,
  index,
}: {
  camp: DirectoryCamp;
  index: number;
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <motion.article
      className="group bg-[#1a120b] rounded-2xl overflow-hidden border border-[#d4af37]/25 hover:border-[#d4af37]/50 transition-all duration-300 shadow-lg"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.5 }}
      whileHover={{ y: -8, transition: { duration: 0.25 } }}
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        {!imgError ? (
          <Image
            src={camp.image}
            alt={camp.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="absolute inset-0 bg-[#0f3d1e]/50 flex items-center justify-center">
            <Mountain className="w-16 h-16 text-[#d4af37]/40" strokeWidth={1} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a120b] via-transparent/40 to-transparent" />
        <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-[#d4af37]/90 text-[#1a120b] text-xs font-semibold">
          {camp.state}
        </span>
        <div className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#1a120b]/80 text-[#d4af37] text-xs font-medium">
          <MessageCircle className="w-4 h-4" />
          Community
        </div>
      </div>

      <div className="p-5">
        <p className="text-[#d4af37]/90 text-xs font-medium uppercase tracking-wider mb-1">
          {camp.tagline}
        </p>
        <h3 className="font-serif text-xl font-bold text-[#f0d48f] mb-2">
          {camp.name}
        </h3>
        <p className="text-[#e8e0d5]/85 text-sm leading-relaxed mb-4 line-clamp-3">
          {camp.desc}
        </p>

        <div className="flex items-start gap-2 text-[#e8e0d5]/60 text-xs mb-5">
          <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span className="line-clamp-2">{camp.address}</span>
        </div>

        <div className="flex gap-3">
          <Link
            href={`/directory/${camp.slug}`}
            className="inline-flex items-center justify-center gap-2 flex-1 px-5 py-3 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-all"
          >
            Community
            <MessageCircle className="w-4 h-4" strokeWidth={2} />
          </Link>
          <Link
            href={`/campgrounds/${camp.slug}`}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 border border-[#d4af37]/50 text-[#d4af37] font-semibold rounded-lg hover:bg-[#d4af37]/10 transition-all"
          >
            Details
            <ArrowRight className="w-4 h-4" strokeWidth={2} />
          </Link>
        </div>
      </div>
    </motion.article>
  );
}
