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
} from "lucide-react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { FacebookGroupCTA } from "@/components/FacebookGroupCTA";

const amenities = [
  {
    icon: Plug,
    text: "132 full-hookup RV sites (30/50 amp electric, water, sewer)",
    highlight: true,
  },
  { icon: Tent, text: "65 dry camping sites" },
  {
    icon: Landmark,
    text: "Museum with mining artifacts",
    highlight: true,
  },
  { icon: Home, text: "Clubhouse & card room" },
  { icon: Trophy, text: "Horseshoe pits & recreation areas" },
  { icon: Shirt, text: "Laundry facilities" },
  { icon: ShowerHead, text: "Showers & restrooms" },
  { icon: Fuel, text: "Dump station" },
  { icon: UserRound, text: "Caretaker on-site" },
];

const galleryImages: { src: string; caption?: string }[] = [
  { src: "/images/campgrounds/stanton-arizona/stanton-1.jpg", caption: "Holiday gathering at Stanton" },
  { src: "/images/campgrounds/stanton-arizona/stanton-2.jpg", caption: "Mining headframe demonstration" },
  { src: "/images/campgrounds/stanton-arizona/stanton-3.jpg", caption: "Member work day — utility upgrades" },
  { src: "/images/campgrounds/stanton-arizona/stanton-4.jpg", caption: "Gold finds at Hotel Stanton" },
  { src: "/images/campgrounds/stanton-arizona/stanton-5.jpg", caption: "RV campground & historic buildings" },
  { src: "/images/campgrounds/stanton-arizona/stanton-6.jpg", caption: "Gold from Stanton claims" },
];

const nearbyAttractions = [
  { name: "Rich Hill", desc: "Legendary nugget country" },
  { name: "Congress", desc: "Nearby historic mining town" },
  { name: "Wickenburg", desc: "Western heritage & dining" },
];

const stats = [
  { value: "50", label: "Years of LDMA History" },
  { value: "120", label: "Patented Acres" },
  { value: "197", label: "RV & Dry Sites" },
  { value: "Sept–May", label: "Open Season" },
];

const MAPS_URL =
  "https://www.google.com/maps/dir/?api=1&destination=15650+Stanton+Rd,+Congress,+AZ+85332";

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

export function StantonCampContent() {
  const [heroError, setHeroError] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 600], [0, 75]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIndex(null);
      if (lightboxIndex !== null) {
        if (e.key === "ArrowRight")
          setLightboxIndex((i) =>
            i === null ? null : Math.min(i + 1, galleryImages.length - 1)
          );
        if (e.key === "ArrowLeft")
          setLightboxIndex((i) =>
            i === null ? null : Math.max(i - 1, 0)
          );
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex]);

  return (
    <>
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Campgrounds", href: "/campgrounds" },
            { label: "Stanton, Arizona" },
          ]}
        />
      </div>

      {/* Hero with parallax background */}
      <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden">
        <motion.div className="absolute inset-0" style={{ y: heroY }}>
          {!heroError ? (
            <Image
              src="/images/campgrounds/stanton-arizona/camp-stanton-hero.jpg"
              alt="Stanton Camp"
              fill
              className="object-cover scale-105"
              sizes="100vw"
              priority
              onError={() => setHeroError(true)}
            />
          ) : (
            <Image
              src="/images/campgrounds/stanton-arizona/camp-stanton.jpg"
              alt="Stanton Camp"
              fill
              className="object-cover scale-105"
              sizes="100vw"
              priority
            />
          )}
          <div
            className="absolute inset-0 bg-[#1a120b]/70"
            aria-hidden
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-[#1a120b] via-[#1a120b]/40 to-transparent"
            aria-hidden
          />
          <div
            className="absolute inset-0 bg-gradient-to-r from-[#d4af37]/10 via-transparent to-[#d4af37]/10"
            aria-hidden
          />
        </motion.div>

        {/* 50th Anniversary Badge */}
        <motion.div
          className="absolute top-6 right-4 sm:right-8 z-20"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
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
            Arizona
          </motion.span>
          <motion.h1
            className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-[#f0d48f] tracking-tight mb-4"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Stanton, Arizona
          </motion.h1>
          <motion.p
            className="text-[#e8e0d5]/95 text-lg md:text-xl max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Flagship Camp • Restored 1870s Ghost Town & Gold Prospecting Haven
          </motion.p>
        </div>
      </section>

      {/* Quick Stats Bar */}
      <section className="relative z-10 -mt-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            {stats.map((stat) => (
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
              LDMA&apos;s most popular destination on 120 patented acres. Once the
              hideout of outlaw Charlie Stanton, this historic site has been
              lovingly restored into one of America&apos;s best-preserved ghost
              towns. Owned by LDMA (Lost Dutchman&apos;s Mining Association).
              Exclusive access to gold-bearing claims, seasonal camping
              (September–May), and a true sense of mining history.
            </p>
            <p className="text-[#d4af37]/90 text-base italic border-l-4 border-[#d4af37]/40 pl-4">
              One of LDMA&apos;s original camps — a cornerstone of our 50-year legacy
              of gold, grit, and brotherhood.
            </p>
          </motion.div>
        </div>
      </section>

      <SectionDivider />

      {/* Then & Now */}
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
                Then — 1870s
              </h3>
              <p className="text-[#e8e0d5]/85 text-sm leading-relaxed">
                Outlaw hideout in the shadow of Rich Hill. A dusty stop for
                miners, bandits, and dreamers chasing gold in the Arizona desert.
              </p>
            </div>
            <div>
              <h3 className="font-serif text-lg font-semibold text-[#d4af37] mb-2">
                Now — LDMA Era
              </h3>
              <p className="text-[#e8e0d5]/85 text-sm leading-relaxed">
                A thriving LDMA camp with full hookups, museum, clubhouse, and
                exclusive gold-bearing claims — one of America&apos;s best-preserved
                ghost towns.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

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
            {amenities.map(({ icon: Icon, text, highlight }) => (
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
            ))}
          </motion.ul>
        </div>
      </section>

      <SectionDivider />

      {/* Gold Prospecting + Seasonal Note */}
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
                Rich placer gold in the area. Members find nuggets and fines on
                nearby LDMA claims — primarily metal detecting and dry washing,
                with mostly dry terrain.
              </p>
              <p className="text-[#e8e0d5]/70 text-sm italic">
                Open September through May. Closed in summer due to desert heat.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <SectionDivider />

      {/* Location & Map */}
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
                href="https://www.google.com/maps/search/?api=1&query=15650+Stanton+Rd,+Congress,+AZ+85332"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[#e8e0d5]/90 hover:text-[#d4af37] transition-colors"
              >
                <MapPin className="w-5 h-5 flex-shrink-0" />
                <span>15650 Stanton Rd, Congress, AZ 85332</span>
              </a>
              <a
                href={MAPS_URL}
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
              src="https://maps.google.com/maps?q=15650+Stanton+Rd,+Congress,+AZ+85332&t=k&z=15&ie=UTF8&iwloc=&output=embed"
              width="100%"
              height="400"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Stanton Camp Location"
              className="w-full"
            />
          </motion.div>
        </div>
      </section>

      <SectionDivider />

      {/* Nearby Attractions */}
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
            {nearbyAttractions.map(({ name, desc }) => (
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

      {/* Stanton Through the Years - Gallery with Lightbox */}
      <section className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.h2
            className="font-serif text-2xl md:text-3xl font-bold text-[#f0d48f] text-center mb-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Stanton Through the Years
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
            {galleryImages.map(({ src, caption }, i) => (
              <GalleryImage
                key={src}
                src={src}
                index={i}
                fallback="/images/campgrounds/stanton-arizona/camp-stanton.jpg"
                caption={caption}
                onClick={() => setLightboxIndex(i)}
              />
            ))}
          </motion.div>
          <SectionDivider />
          <FacebookGroupCTA
            url="https://www.facebook.com/groups/521036414939133"
            campName="Stanton"
          />
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
                    galleryImages[lightboxIndex]?.src || "/images/campgrounds/stanton-arizona/camp-stanton.jpg"
                  }
                  alt={galleryImages[lightboxIndex]?.caption || "Stanton camp"}
                  fill
                  className="object-contain"
                  sizes="90vw"
                />
              </motion.div>
              {galleryImages[lightboxIndex]?.caption && (
                <p className="text-center text-white/90 mt-4 font-serif">
                  {galleryImages[lightboxIndex].caption}
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
                  {lightboxIndex + 1} / {galleryImages.length}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxIndex((i) =>
                      i === null ? null : Math.min(i + 1, galleryImages.length - 1)
                    );
                  }}
                  disabled={lightboxIndex === galleryImages.length - 1}
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
            Ready to Visit Stanton?
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
  onClick,
}: {
  src: string;
  index: number;
  fallback: string;
  caption?: string;
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
          alt={caption || `Stanton camp photo ${index + 1}`}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          sizes="(max-width: 768px) 50vw, 33vw"
          onError={() => setError(true)}
        />
      ) : (
        <Image
          src={fallback}
          alt={caption || `Stanton camp photo ${index + 1}`}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          sizes="(max-width: 768px) 50vw, 33vw"
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
