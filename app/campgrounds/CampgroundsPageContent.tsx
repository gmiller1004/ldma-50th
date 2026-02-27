"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { MapPin, ArrowRight, Mountain } from "lucide-react";
import { Breadcrumbs } from "@/components/Breadcrumbs";

type MainCamp = {
  name: string;
  state: string;
  tagline: string;
  desc: string;
  address: string;
  image: string;
  slug: string;
};

type AdditionalCamp = {
  name: string;
  state: string;
  highlight: string;
};

export function CampgroundsPageContent({
  mainCamps,
  additionalCamps,
}: {
  mainCamps: MainCamp[];
  additionalCamps: AdditionalCamp[];
}) {
  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Campgrounds" },
          ]}
        />
      </div>
      {/* Hero */}
      <section className="relative py-20 md:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f3d1e]/40 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(212,175,55,0.06)_0%,transparent_70%)]" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <motion.h1
            className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-[#f0d48f] tracking-tight mb-4"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            Our 12 Campgrounds
          </motion.h1>
          <motion.p
            className="text-[#e8e0d5]/90 text-lg md:text-xl max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            Private gold-bearing properties across 8 states • Membership required
            outside of{" "}
            <Link
              href="/events"
              className="text-[#d4af37] hover:text-[#f0d48f] underline underline-offset-2 transition-colors"
            >
              public events
            </Link>
          </motion.p>
        </div>
      </section>

      {/* Main grid */}
      <section className="pb-16 md:pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {mainCamps.map((camp, i) => (
              <CampCard key={camp.slug} camp={camp} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* Additional Properties */}
      <section className="py-16 md:py-24 bg-[#0f3d1e]/30 border-t border-[#d4af37]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.h2
            className="font-serif text-2xl md:text-3xl font-bold text-[#f0d48f] text-center mb-3"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Additional Primitive Properties
          </motion.h2>
          <motion.p
            className="text-center text-[#e8e0d5]/80 mb-12 max-w-2xl mx-auto"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            Self-contained camping on patented claims — perfect for true
            wilderness adventures
          </motion.p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {additionalCamps.map((camp, i) => (
              <motion.div
                key={`${camp.name}-${camp.state}`}
                className="p-5 rounded-xl bg-[#1a120b]/80 border border-[#d4af37]/20 hover:border-[#d4af37]/40 transition-colors"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <span className="inline-block px-2.5 py-0.5 rounded bg-[#d4af37]/15 text-[#d4af37] text-xs font-medium mb-2">
                  {camp.state}
                </span>
                <h3 className="font-serif text-lg font-semibold text-[#f0d48f] mb-2">
                  {camp.name}
                </h3>
                <p className="text-[#e8e0d5]/75 text-sm leading-relaxed">
                  {camp.highlight}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function CampCard({ camp, index }: { camp: MainCamp; index: number }) {
  const [imgError, setImgError] = useState(false);

  return (
    <motion.article
      className="group bg-[#1a120b] rounded-2xl overflow-hidden border border-[#d4af37]/25 hover:border-[#d4af37]/50 transition-all duration-300 shadow-lg hover:shadow-[0_8px_30px_rgba(212,175,55,0.12)]"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
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
            <Mountain
              className="w-16 h-16 text-[#d4af37]/40"
              strokeWidth={1}
            />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a120b] via-transparent/40 to-transparent" />
        <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-[#d4af37]/90 text-[#1a120b] text-xs font-semibold">
          {camp.state}
        </span>
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

        <Link
          href={`/campgrounds/${camp.slug}`}
          className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-all shadow-[0_0_12px_rgba(212,175,55,0.2)] group-hover:shadow-[0_0_20px_rgba(212,175,55,0.35)]"
        >
          Learn More
          <ArrowRight className="w-4 h-4" strokeWidth={2} />
        </Link>
      </div>
    </motion.article>
  );
}
