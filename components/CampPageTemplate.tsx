"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Plug,
  Tent,
  Landmark,
  Home,
  Trophy,
  Shirt,
  ShowerHead,
  Fuel,
  UserRound,
  Sparkles,
  X,
  ChevronRight,
  Navigation,
  type LucideIcon,
} from "lucide-react";
import { ShareButton } from "@/components/ShareButton";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { FacebookGroupCTA } from "@/components/FacebookGroupCTA";
import type { CampPageData, AmenityIcon } from "@/lib/camp-page-data";

const ICON_MAP: Record<AmenityIcon, LucideIcon> = {
  Plug,
  Tent,
  Landmark,
  Home,
  Trophy,
  Shirt,
  ShowerHead,
  Fuel,
  UserRound,
};

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

function SectionDivider() {
  return (
    <div className="flex items-center justify-center gap-4 py-8" aria-hidden>
      <div className="h-px flex-1 max-w-24 bg-[#d4af37]/30" />
      <Sparkles className="w-4 h-4 text-[#d4af37]/50" />
      <div className="h-px flex-1 max-w-24 bg-[#d4af37]/30" />
    </div>
  );
}

export function CampPageTemplate({ camp }: { camp: CampPageData }) {
  const [heroError, setHeroError] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 600], [0, 75]);

  const mapsDirUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(camp.address)}`;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIndex(null);
      if (lightboxIndex !== null) {
        if (e.key === "ArrowRight")
          setLightboxIndex((i) =>
            i === null ? null : Math.min(i + 1, camp.galleryImages.length - 1)
          );
        if (e.key === "ArrowLeft")
          setLightboxIndex((i) =>
            i === null ? null : Math.max(i - 1, 0)
          );
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex, camp.galleryImages.length]);

  return (
    <>
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Campgrounds", href: "/campgrounds" },
            { label: `${camp.name}, ${camp.state}` },
          ]}
        />
      </div>

      {/* Hero */}
      <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden">
        <motion.div className="absolute inset-0" style={{ y: heroY }}>
          <Image
            src={heroError ? camp.heroImageFallback : camp.heroImage}
            alt={`${camp.name} Camp`}
            fill
            className="object-cover scale-105"
            sizes="100vw"
            priority
            onError={() => setHeroError(true)}
          />
          <div className="absolute inset-0 bg-[#1a120b]/70" aria-hidden />
          <div
            className="absolute inset-0 bg-gradient-to-t from-[#1a120b] via-[#1a120b]/40 to-transparent"
            aria-hidden
          />
          <div
            className="absolute inset-0 bg-gradient-to-r from-[#d4af37]/10 via-transparent to-[#d4af37]/10"
            aria-hidden
          />
        </motion.div>

        <motion.div
          className="absolute top-6 right-4 sm:right-8 z-20 flex items-center gap-3"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <ShareButton
            url={`/campgrounds/${camp.slug}`}
            title={`${camp.name}, ${camp.state}`}
            text={camp.tagline}
          />
          <span className="inline-block px-4 py-2 rounded-lg bg-[#d4af37]/90 text-[#1a120b] text-xs font-bold uppercase tracking-wider border border-[#f0d48f]/50 shadow-lg">
            50th Anniversary
          </span>
        </motion.div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center py-20">
          <motion.span
            className="inline-block px-3 py-1 rounded bg-[#d4af37]/20 text-[#d4af37] text-sm font-medium mb-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {camp.state}
          </motion.span>
          <motion.h1
            className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-[#f0d48f] tracking-tight mb-4"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            {camp.name}, {camp.state}
          </motion.h1>
          <motion.p
            className="text-[#e8e0d5]/95 text-lg md:text-xl max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {camp.tagline}
          </motion.p>
        </div>
      </section>

      {/* Stats */}
      <section className="relative z-10 -mt-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            {camp.stats.map((stat) => (
              <div
                key={stat.label}
                className="text-center p-4 rounded-xl bg-[#1a120b] border border-[#d4af37]/25 shadow-xl"
              >
                <p className="font-serif text-2xl md:text-3xl font-bold text-[#d4af37]">
                  {stat.value}
                </p>
                <p className="text-[#e8e0d5]/80 text-xs sm:text-sm mt-1">
                  {stat.label}
                </p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Overview */}
      <section className="py-16 md:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#f0d48f] mb-6">
              Overview
            </h2>
            <p className="text-[#e8e0d5]/90 text-lg leading-relaxed mb-8">
              {camp.overview}
            </p>
            {camp.ldmaConnection && (
              <p className="text-[#d4af37]/90 text-base italic border-l-4 border-[#d4af37]/40 pl-4">
                {camp.ldmaConnection}
              </p>
            )}
          </motion.div>
        </div>
      </section>

      {camp.thenNow && (
        <>
          <SectionDivider />
          <section className="py-8 md:py-12">
            <div className="max-w-4xl mx-auto px-4 sm:px-6">
              <motion.div
                className="grid md:grid-cols-2 gap-8 p-6 md:p-8 rounded-2xl bg-[#0f3d1e]/30 border border-[#d4af37]/15"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <div>
                  <h3 className="font-serif text-lg font-semibold text-[#d4af37] mb-2">
                    Then — {camp.thenNow.then.title}
                  </h3>
                  <p className="text-[#e8e0d5]/85 text-sm leading-relaxed">
                    {camp.thenNow.then.text}
                  </p>
                </div>
                <div>
                  <h3 className="font-serif text-lg font-semibold text-[#d4af37] mb-2">
                    Now — {camp.thenNow.now.title}
                  </h3>
                  <p className="text-[#e8e0d5]/85 text-sm leading-relaxed">
                    {camp.thenNow.now.text}
                  </p>
                </div>
              </motion.div>
            </div>
          </section>
        </>
      )}

      <SectionDivider />

      {/* Amenities */}
      <section className="py-16 md:py-24 bg-[#0f3d1e]/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.h2
            className="font-serif text-2xl md:text-3xl font-bold text-[#f0d48f] text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Amenities
          </motion.h2>
          <motion.ul
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-30px" }}
          >
            {camp.amenities.map(({ icon, text, highlight }) => {
              const Icon = ICON_MAP[icon];
              return (
                <motion.li
                  key={text}
                  variants={item}
                  className={`flex items-start gap-4 p-4 rounded-xl border transition-colors group ${
                    highlight
                      ? "bg-[#1a120b]/80 border-[#d4af37]/30 shadow-[0_0_20px_rgba(212,175,55,0.08)]"
                      : "bg-[#1a120b]/60 border-[#d4af37]/15 hover:border-[#d4af37]/30"
                  }`}
                >
                  <span
                    className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-[#d4af37] transition-colors ${
                      highlight ? "bg-[#d4af37]/25" : "bg-[#d4af37]/15"
                    } group-hover:bg-[#d4af37]/25`}
                  >
                    <Icon className="w-5 h-5" strokeWidth={2} />
                  </span>
                  <span
                    className={`pt-1.5 leading-relaxed ${
                      highlight
                        ? "text-[#e8e0d5] font-medium text-base"
                        : "text-[#e8e0d5]/90 text-sm"
                    }`}
                  >
                    {text}
                  </span>
                </motion.li>
              );
            })}
          </motion.ul>
        </div>
      </section>

      <SectionDivider />

      {/* Gold Prospecting */}
      <section className="py-16 md:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <motion.div
            className="flex gap-4 p-6 md:p-8 rounded-2xl bg-[#0f3d1e]/40 border border-[#d4af37]/20"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Sparkles className="w-10 h-10 text-[#d4af37] flex-shrink-0 mt-1" />
            <div>
              <h2 className="font-serif text-xl md:text-2xl font-bold text-[#f0d48f] mb-3">
                Gold Prospecting
              </h2>
              <p className="text-[#e8e0d5]/90 leading-relaxed mb-4">
                {camp.goldProspecting.text}
              </p>
              <p className="text-[#e8e0d5]/70 text-sm italic">
                {camp.goldProspecting.seasonalNote}
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <SectionDivider />

      {/* Location */}
      <section className="py-16 md:py-24 bg-[#0f3d1e]/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-8"
          >
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#f0d48f] mb-4">
              Location
            </h2>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <a
                href={camp.mapsSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[#e8e0d5]/90 hover:text-[#d4af37] transition-colors"
              >
                <MapPin className="w-5 h-5 flex-shrink-0" />
                <span>{camp.address}</span>
              </a>
              <a
                href={mapsDirUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors w-fit"
              >
                <Navigation className="w-5 h-5" />
                Get Directions
              </a>
            </div>
          </motion.div>

          <motion.div
            className="rounded-xl overflow-hidden border border-[#d4af37]/20 shadow-xl"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <iframe
              src={camp.mapsEmbedUrl}
              width="100%"
              height="400"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title={`${camp.name} Camp Location`}
              className="w-full"
            />
          </motion.div>
        </div>
      </section>

      <SectionDivider />

      {/* Nearby */}
      <section className="py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <motion.h2
            className="font-serif text-xl md:text-2xl font-bold text-[#f0d48f] text-center mb-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Nearby
          </motion.h2>
          <motion.div
            className="grid sm:grid-cols-3 gap-4"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            {camp.nearbyAttractions.map(({ name, desc }) => (
              <div
                key={name}
                className="p-4 rounded-xl bg-[#0f3d1e]/20 border border-[#d4af37]/15 text-center"
              >
                <p className="font-serif font-semibold text-[#d4af37]">{name}</p>
                <p className="text-[#e8e0d5]/70 text-sm mt-1">{desc}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      <SectionDivider />

      {/* Gallery */}
      <section className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.h2
            className="font-serif text-2xl md:text-3xl font-bold text-[#f0d48f] text-center mb-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            {camp.galleryTitle}
          </motion.h2>
          <motion.p
            className="text-center text-[#e8e0d5]/70 text-sm mb-12 max-w-xl mx-auto"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            Click any image to view full size
          </motion.p>
          <motion.div
            className="grid grid-cols-2 md:grid-cols-3 gap-4"
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
          >
            {camp.galleryImages.map(({ src, caption }, i) => (
              <GalleryImage
                key={src}
                src={src}
                index={i}
                fallback={camp.heroImageFallback}
                caption={caption}
                campName={camp.name}
                onClick={() => setLightboxIndex(i)}
              />
            ))}
          </motion.div>
          {camp.facebookGroupUrl && (
            <>
              <SectionDivider />
              <FacebookGroupCTA url={camp.facebookGroupUrl} campName={camp.name} />
            </>
          )}
        </div>
      </section>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIndex !== null && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxIndex(null)}
          >
            <button
              onClick={() => setLightboxIndex(null)}
              className="absolute top-4 right-4 p-2 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors z-10"
              aria-label="Close lightbox"
            >
              <X className="w-8 h-8" />
            </button>
            <div
              className="relative max-w-5xl w-full max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <motion.div
                key={lightboxIndex}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative aspect-video w-full"
              >
                <Image
                  src={
                    camp.galleryImages[lightboxIndex]?.src ||
                    camp.heroImageFallback
                  }
                  alt={
                    camp.galleryImages[lightboxIndex]?.caption ||
                    `${camp.name} camp`
                  }
                  fill
                  className="object-contain"
                  sizes="90vw"
                  unoptimized
                />
              </motion.div>
              {camp.galleryImages[lightboxIndex]?.caption && (
                <p className="text-center text-white/90 mt-4 font-serif">
                  {camp.galleryImages[lightboxIndex].caption}
                </p>
              )}
              <div className="flex justify-center gap-4 mt-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxIndex((i) =>
                      i === null ? null : Math.max(i - 1, 0)
                    );
                  }}
                  disabled={lightboxIndex === 0}
                  className="p-2 text-white/80 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Previous image"
                >
                  <ChevronRight className="w-8 h-8 rotate-180" />
                </button>
                <span className="text-white/70 text-sm self-center">
                  {lightboxIndex + 1} / {camp.galleryImages.length}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxIndex((i) =>
                      i === null
                        ? null
                        : Math.min(i + 1, camp.galleryImages.length - 1)
                    );
                  }}
                  disabled={lightboxIndex === camp.galleryImages.length - 1}
                  className="p-2 text-white/80 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-8 h-8" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <SectionDivider />

      {/* CTA */}
      <section className="py-20 md:py-28 bg-gradient-to-b from-[#0f3d1e]/50 to-[#1a120b]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <motion.h2
            className="font-serif text-3xl md:text-4xl font-bold text-[#f0d48f] mb-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            {camp.ctaTitle}
          </motion.h2>
          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <Link
              href="/memberships"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-all shadow-[0_0_20px_rgba(212,175,55,0.25)] hover:shadow-[0_0_30px_rgba(212,175,55,0.35)]"
            >
              Become a Member
            </Link>
            <Link
              href="/events"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 border-2 border-[#d4af37] text-[#d4af37] font-semibold rounded-lg hover:bg-[#d4af37]/10 transition-all"
            >
              Plan Your Trip
            </Link>
          </motion.div>
        </div>
      </section>
    </>
  );
}

function GalleryImage({
  src,
  index,
  fallback,
  caption,
  campName,
  onClick,
}: {
  src: string;
  index: number;
  fallback: string;
  caption?: string;
  campName: string;
  onClick: () => void;
}) {
  const [error, setError] = useState(false);

  return (
    <motion.button
      type="button"
      variants={item}
      className="relative aspect-[4/3] rounded-xl overflow-hidden group cursor-pointer text-left w-full"
      onClick={onClick}
    >
      {!error ? (
        <Image
          src={src}
          alt={caption || `${campName} camp photo ${index + 1}`}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          sizes="(max-width: 768px) 50vw, 33vw"
          onError={() => setError(true)}
          unoptimized
        />
      ) : (
        <Image
          src={fallback}
          alt={caption || `${campName} camp photo ${index + 1}`}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          sizes="(max-width: 768px) 50vw, 33vw"
          unoptimized
        />
      )}
      <div
        className="absolute inset-0 bg-[#d4af37]/0 group-hover:bg-[#d4af37]/15 transition-colors duration-300"
        aria-hidden
      />
      {caption && (
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
          <p className="text-white text-sm font-medium">{caption}</p>
        </div>
      )}
    </motion.button>
  );
}
