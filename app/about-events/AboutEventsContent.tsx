"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Calendar,
  MapPin,
  Sparkles,
  Users,
  Radio,
  Trophy,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { Breadcrumbs } from "@/components/Breadcrumbs";

const EVENT_TYPES = [
  {
    icon: Trophy,
    title: "Dirt Fest",
    desc: "Our flagship multi-day gatherings — mining and detector activities, paydirt, prize drawings, LDMA swag, and VIP options. The ultimate LDMA experience at select camps each year.",
    image: "/images/about-events/dirt-fest.jpg",
    imageAlt: "Dirt Fest — LDMA event",
  },
  {
    icon: Radio,
    title: "Detector Events",
    desc: "Focused metal-detecting days and demos, often with manufacturer partners. Perfect for honing your skills and hunting for gold and relics on LDMA claims.",
    image: "/images/about-events/detector-events.jpg",
    imageAlt: "Detector event at an LDMA camp",
  },
  {
    icon: Calendar,
    title: "Other Events",
    desc: "Gold N BBQ, camp-specific gatherings, member work days, and seasonal celebrations. Check the events calendar for what’s coming up at each camp.",
    image: "/images/about-events/other-events.jpg",
    imageAlt: "LDMA camp event",
  },
];

const WHAT_TO_EXPECT = [
  {
    icon: Users,
    title: "Community",
    desc: "Meet fellow members, swap stories, and learn from experienced prospectors. Events are family-friendly and welcoming to beginners.",
    image: "/images/about-events/community.jpg",
    imageAlt: "LDMA community at events",
  },
  {
    icon: Sparkles,
    title: "Gold & Adventure",
    desc: "Structured activities plus plenty of time to prospect on camp claims. Many events include paydirt, demos, and exclusive access.",
    image: "/images/about-events/adventure.jpg",
    imageAlt: "Gold and adventure at LDMA events",
  },
  {
    icon: MapPin,
    title: "At LDMA Camps",
    desc: "Events are held at our 12 private campgrounds across 8 states — from Arizona to the Carolinas. Your ticket typically covers everyone in your campsite.",
    image: "/images/about-events/camps.jpg",
    imageAlt: "LDMA camps host events",
  },
];

/** Camps that host events — for the Where We Host slider. */
const CAMPS_SLIDER = [
  { slug: "stanton-arizona", label: "Stanton, AZ", image: "/images/campgrounds/stanton-arizona/camp-stanton.jpg" },
  { slug: "italian-bar-california", label: "Italian Bar, CA", image: "/images/campgrounds/italian-bar-california/camp-italian-bar.jpg" },
  { slug: "duisenburg-california", label: "Duisenburg, CA", image: "/images/campgrounds/duisenburg-california/camp-duisenburg.jpg" },
  { slug: "blue-bucket-oregon", label: "Blue Bucket, OR", image: "/images/campgrounds/blue-bucket-oregon/camp-blue-bucket.jpg" },
  { slug: "burnt-river-oregon", label: "Burnt River, OR", image: "/images/campgrounds/burnt-river-oregon/camp-burnt-river.jpg" },
  { slug: "oconee-south-carolina", label: "Oconee, SC", image: "/images/campgrounds/oconee-south-carolina/camp-oconee.jpg" },
  { slug: "loud-mine-georgia", label: "Loud Mine, GA", image: "/images/campgrounds/loud-mine-georgia/camp-loud-mine.jpg" },
  { slug: "vein-mountain-north-carolina", label: "Vein Mountain, NC", image: "/images/campgrounds/vein-mountain-north-carolina/camp-vein-mountain.jpg" },
];

/** Optional images for the about-events page. Replace with real photos in public/images/about-events/ — see README there. */
const GALLERY_IMAGES = [
  { src: "/images/about-events/events-1.jpg", alt: "LDMA event — mining activity", fallback: "/images/campgrounds/stanton-arizona/stanton-2.jpg" },
  { src: "/images/about-events/events-2.jpg", alt: "LDMA event — detector day", fallback: "/images/campgrounds/stanton-arizona/stanton-3.jpg" },
  { src: "/images/about-events/events-3.jpg", alt: "LDMA event — camp gathering", fallback: "/images/campgrounds/stanton-arizona/stanton-5.jpg" },
];

function SectionDivider() {
  return (
    <div className="flex items-center justify-center gap-4 py-8" aria-hidden>
      <div className="h-px flex-1 max-w-24 bg-[#d4af37]/30" />
      <Sparkles className="w-4 h-4 text-[#d4af37]/50" />
      <div className="h-px flex-1 max-w-24 bg-[#d4af37]/30" />
    </div>
  );
}

function CampSlider() {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const step = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({ left: dir === "left" ? -step : step, behavior: "smooth" });
  };

  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
    >
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => scroll("left")}
          className="p-2 rounded-lg border border-[#d4af37]/30 text-[#d4af37] hover:bg-[#d4af37]/10 transition-colors"
          aria-label="Previous camps"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-sm text-[#e8e0d5]/70">Swipe or use arrows to explore</span>
        <button
          type="button"
          onClick={() => scroll("right")}
          className="p-2 rounded-lg border border-[#d4af37]/30 text-[#d4af37] hover:bg-[#d4af37]/10 transition-colors"
          aria-label="Next camps"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-4 scroll-smooth snap-x snap-mandatory scrollbar-thin scrollbar-thumb-[#d4af37]/30 scrollbar-track-transparent"
        style={{ scrollbarWidth: "thin" }}
      >
        {CAMPS_SLIDER.map((camp) => (
          <Link
            key={camp.slug}
            href={`/campgrounds/${camp.slug}`}
            className="flex-shrink-0 w-64 sm:w-72 snap-center group rounded-xl overflow-hidden border border-[#d4af37]/20 hover:border-[#d4af37]/50 transition-colors bg-[#1a120b]/50"
          >
            <div className="relative aspect-[4/3] w-full">
              <Image
                src={camp.image}
                alt={camp.label}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
                sizes="288px"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1a120b]/95 via-[#1a120b]/30 to-transparent" />
              <span className="absolute bottom-3 left-3 right-3 font-serif text-lg font-semibold text-[#f0d48f]">
                {camp.label}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </motion.div>
  );
}

export function AboutEventsContent() {
  const [imgErrors, setImgErrors] = useState<Record<number, boolean>>({});

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Events", href: "/events" },
            { label: "About LDMA Events" },
          ]}
        />
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
            50th Anniversary
          </motion.span>
          <motion.h1
            className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-[#f0d48f] tracking-tight mb-4"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            What Are LDMA Events?
          </motion.h1>
          <motion.p
            className="text-[#e8e0d5]/90 text-lg md:text-xl max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Dirt Fest, detector days, Gold N BBQ, and more — gold prospecting
            gatherings at our 12 campgrounds. Here’s what to expect and how to
            join the celebration.
          </motion.p>
        </div>
      </section>

      <SectionDivider />

      {/* What to expect */}
      <section className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.h2
            className="font-serif text-2xl md:text-3xl font-bold text-[#f0d48f] text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            What to Expect
          </motion.h2>
          <div className="grid md:grid-cols-3 gap-8">
            {WHAT_TO_EXPECT.map(({ icon: Icon, title, desc, image, imageAlt }, i) => (
              <motion.div
                key={title}
                className="rounded-2xl overflow-hidden bg-[#0f3d1e]/30 border border-[#d4af37]/15 hover:border-[#d4af37]/30 transition-colors"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="relative aspect-[16/10] w-full">
                  <Image
                    src={image}
                    alt={imageAlt}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1a120b]/90 via-[#1a120b]/20 to-transparent" />
                  <span className="absolute bottom-3 left-4 inline-flex w-10 h-10 rounded-lg bg-[#d4af37]/20 items-center justify-center text-[#d4af37]">
                    <Icon className="w-5 h-5" strokeWidth={2} />
                  </span>
                </div>
                <div className="p-5">
                  <h3 className="font-serif text-xl font-semibold text-[#f0d48f] mb-2">
                    {title}
                  </h3>
                  <p className="text-[#e8e0d5]/85 text-sm leading-relaxed">
                    {desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* Event types */}
      <section className="py-16 md:py-24 bg-[#0f3d1e]/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <motion.h2
            className="font-serif text-2xl md:text-3xl font-bold text-[#f0d48f] text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Types of Events
          </motion.h2>
          <div className="space-y-8">
            {EVENT_TYPES.map(({ icon: Icon, title, desc, image, imageAlt }, i) => (
              <motion.div
                key={title}
                className="flex flex-col sm:flex-row gap-0 sm:gap-6 p-0 rounded-2xl overflow-hidden bg-[#1a120b]/80 border border-[#d4af37]/20"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="relative w-full sm:w-56 flex-shrink-0 aspect-[4/3] sm:aspect-square">
                  <Image
                    src={image}
                    alt={imageAlt}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, 224px"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#1a120b]/60 sm:from-[#1a120b]/80 to-transparent sm:to-transparent" />
                  <span className="absolute top-3 left-3 sm:top-3 sm:left-3 inline-flex w-10 h-10 rounded-lg bg-[#d4af37]/25 items-center justify-center text-[#d4af37]">
                    <Icon className="w-5 h-5" strokeWidth={2} />
                  </span>
                </div>
                <div className="p-5 sm:py-6 flex-1 flex flex-col justify-center">
                  <h3 className="font-serif text-xl font-semibold text-[#f0d48f] mb-2">
                    {title}
                  </h3>
                  <p className="text-[#e8e0d5]/90 leading-relaxed">{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* Where we host — intro + camp slider */}
      <section className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#f0d48f] mb-4">
              Where We Host
            </h2>
            <p className="text-[#e8e0d5]/90 text-lg leading-relaxed max-w-2xl mx-auto mb-6">
              Events take place at LDMA campgrounds across Arizona, California,
              Oregon, Georgia, South Carolina, North Carolina, and more. Each
              camp has its own character and gold-bearing claims.
            </p>
            <Link
              href="/campgrounds"
              className="inline-flex items-center gap-2 px-5 py-2.5 border border-[#d4af37]/40 text-[#e8e0d5] rounded-lg hover:bg-[#d4af37]/10 transition-colors font-medium"
            >
              <MapPin className="w-4 h-4" />
              View all camps
            </Link>
          </motion.div>

          <CampSlider />
        </div>
      </section>

      <SectionDivider />

      {/* Gallery */}
      <section className="py-16 md:py-24 bg-[#0f3d1e]/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.h2
            className="font-serif text-2xl md:text-3xl font-bold text-[#f0d48f] text-center mb-10"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Events in Action
          </motion.h2>
          <div className="grid sm:grid-cols-3 gap-4 md:gap-6">
            {GALLERY_IMAGES.map((item, i) => (
              <motion.div
                key={i}
                className="relative aspect-[4/3] rounded-xl overflow-hidden border border-[#d4af37]/20 bg-[#1a120b]/50"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Image
                  src={imgErrors[i] ? item.fallback : item.src}
                  alt={item.alt}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, 33vw"
                  onError={() => setImgErrors((prev) => ({ ...prev, [i]: true }))}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1a120b]/80 via-transparent to-transparent" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* CTA */}
      <section className="py-16 md:py-24">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <motion.div
            className="p-8 md:p-10 rounded-2xl border border-[#d4af37]/30 bg-[#0f3d1e]/40"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#f0d48f] mb-4">
              Ready to Join an Event?
            </h2>
            <p className="text-[#e8e0d5]/90 mb-8">
              Browse upcoming Dirt Fest, detector events, and more. Member
              pricing is available when you’re logged in.
            </p>
            <Link
              href="/events"
              className="inline-flex items-center gap-2 px-8 py-4 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors"
            >
              Browse events
              <ChevronRight className="w-5 h-5" />
            </Link>
          </motion.div>
        </div>
      </section>
    </>
  );
}
