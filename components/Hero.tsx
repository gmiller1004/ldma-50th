"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";

export function Hero() {
  const [bgError, setBgError] = useState(false);
  const { scrollY } = useScroll();
  const backgroundY = useTransform(scrollY, [0, 500], [0, 80]);

  return (
    <section className="relative min-h-[100vh] flex items-center justify-center overflow-hidden">
      {/* Hero background image - full bleed with overlays */}
      <motion.div
        className="absolute inset-0"
        style={{ y: backgroundY }}
      >
        {!bgError ? (
          <Image
            src="/images/hero-george-italian-bar.jpg"
            alt="George Buzzard Massie with OG LDMA members at Italian Bar, 1976"
            fill
            priority
            className="object-cover object-center"
            sizes="100vw"
            onError={() => setBgError(true)}
          />
        ) : (
          <div
            className="absolute inset-0 bg-gradient-to-b from-[#1a120b] via-[#0f3d1e]/60 to-[#1a120b]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23d4af37' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4z'/%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
        )}
        {/* Sepia/warm tint for vintage B&W feel */}
        <div
          className="absolute inset-0 mix-blend-overlay"
          style={{
            background: "linear-gradient(135deg, rgba(212,175,55,0.08) 0%, rgba(139,90,43,0.12) 50%, transparent 100%)",
          }}
        />
        {/* 70% opacity deep brown overlay */}
        <div
          className="absolute inset-0"
          style={{ backgroundColor: "rgba(26, 18, 11, 0.7)" }}
        />
        {/* Warm gold gradient at bottom */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(to top, rgba(212,175,55,0.4) 0%, rgba(212,175,55,0.1) 25%, transparent 60%)",
          }}
        />
      </motion.div>

      {/* Hero content - centered */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center pt-24 sm:pt-32 pb-20 md:pb-28">
        {/* Top badge */}
        <motion.div
          className="inline-block px-4 py-2 rounded-lg border border-[#d4af37]/50 bg-[#1a120b]/60 backdrop-blur-sm mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <span className="font-serif text-sm sm:text-base font-semibold text-[#d4af37] tracking-widest">
            1976 – 2026
          </span>
        </motion.div>

        {/* Main headline */}
        <motion.h1
          className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-[#f0d48f] leading-tight mb-6 drop-shadow-lg"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          style={{
            textShadow: "0 0 40px rgba(212,175,55,0.2), 0 2px 4px rgba(0,0,0,0.3)",
          }}
        >
          50 YEARS OF GOLD, GRIT & BROTHERHOOD
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          className="text-base sm:text-lg md:text-xl text-[#e8e0d5] font-sans max-w-2xl mx-auto mb-10 leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          Founded by George &quot;Buzzard&quot; Massie at Italian Bar in 1976 —
          the legacy lives on with you.
        </motion.p>

        {/* CTAs */}
        <motion.div
          className="flex flex-col sm:flex-row gap-4 justify-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
        >
          <Link
            href="/memberships"
            className="hero-cta-primary group relative px-8 py-4 bg-[#d4af37] text-[#1a120b] font-bold text-lg rounded-lg overflow-hidden transition-all shadow-[0_0_20px_rgba(212,175,55,0.3)] hover:shadow-[0_0_35px_rgba(212,175,55,0.5)]"
          >
            <span className="relative z-10">Become a Member Today</span>
            <span className="hero-cta-shine absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </Link>
          <Link
            href="/events"
            className="hero-cta-secondary group relative px-8 py-4 border-2 border-[#d4af37] text-[#f0d48f] font-bold text-lg rounded-lg overflow-hidden transition-all hover:bg-[#d4af37]/20 shadow-[0_0_15px_rgba(212,175,55,0.2)] hover:shadow-[0_0_25px_rgba(212,175,55,0.35)]"
          >
            <span className="relative z-10">Get 2026 DirtFest Tickets</span>
            <span className="hero-cta-shine-gold absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
