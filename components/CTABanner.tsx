"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export function CTABanner() {
  return (
    <section className="py-20 md:py-28 bg-gradient-to-b from-[#0f3d1e]/40 to-[#1a120b]">
      <motion.div
        className="max-w-4xl mx-auto px-4 sm:px-6 text-center"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#f0d48f] mb-4">
          Join 50 Years of Adventure
        </h2>
        <p className="text-[#e8e0d5]/80 mb-8 max-w-2xl mx-auto">
          Whether you&apos;re a seasoned prospector or new to the gold fields,
          LDMA welcomes you. Become part of a legacy built on friendship,
          discovery, and the thrill of the hunt.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/memberships"
            className="px-8 py-4 bg-[#d4af37] text-[#1a120b] font-bold text-lg rounded-lg hover:bg-[#f0d48f] transition-colors"
          >
            Become a Member Today
          </Link>
          <Link
            href="/events"
            className="px-8 py-4 border-2 border-[#d4af37] text-[#f0d48f] font-bold text-lg rounded-lg hover:bg-[#d4af37]/20 transition-colors"
          >
            2026 DirtFest
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
