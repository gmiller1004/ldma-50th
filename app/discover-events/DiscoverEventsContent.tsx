"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Play,
  Radio,
  Sparkles,
  Trophy,
  Users,
  X,
} from "lucide-react";
import {
  getCampLabel,
  getCardTitle,
  getEventDates,
  getEventType,
  getEventTypeLabel,
  getNextUpcomingEvent,
  sortUpcomingEvents,
} from "@/lib/event-display";
import { trackDiscoverCtaClick } from "@/lib/analytics";
import type { EventProduct } from "@/lib/shopify";
import { DiscoverLeadModal } from "./DiscoverLeadModal";

const INTRO_VIDEO_ID = "e1hFTZsqStw";

const EVENT_TYPE_CARDS = [
  {
    id: "gold_diggings",
    icon: Trophy,
    title: "Gold Diggin's",
    desc: "Multi-day flagship gatherings — panning, detecting, paydirt, prizes, and the full camp experience. No experience required.",
    image: "/images/about-events/dirt-fest.jpg",
  },
  {
    id: "dirt_party",
    icon: Sparkles,
    title: "Dirt Party",
    desc: "High-energy weekends with activities, community, and adventure on real gold claims. Great for groups and first-timers.",
    image: "/images/about-events/other-events.jpg",
  },
  {
    id: "detector",
    icon: Radio,
    title: "Detector Events",
    desc: "Focused metal-detecting days and demos — often with manufacturer partners. Perfect for honing your skills.",
    image: "/images/about-events/detector-events.jpg",
  },
  {
    id: "other",
    icon: Calendar,
    title: "Other Adventures",
    desc: "Dredge Quest, Desert Chaos, Push Digs, BBQ weekends, and camp-specific gatherings across 8 states.",
    image: "/images/about-events/adventure.jpg",
  },
] as const;

const INTEREST_PILLARS = [
  {
    id: "first_timer",
    title: "First timer",
    desc: "Never panned or detected? We'll show you what to expect and which events welcome beginners.",
    cta: "Get the beginner guide",
  },
  {
    id: "family_trip",
    title: "Family trip",
    desc: "Kid-friendly camps, group tickets, and weekends built for making memories together.",
    cta: "Family-friendly picks",
  },
  {
    id: "detector",
    title: "Serious detectorist",
    desc: "Detector-focused events, demos, and hunts on LDMA claims with experienced prospectors.",
    cta: "Detector event alerts",
  },
  {
    id: "curious",
    title: "Just curious",
    desc: "Not ready to commit? Get a light monthly digest of what's coming up — no pressure.",
    cta: "Stay in the loop",
  },
] as const;

const TESTIMONIALS = [
  {
    quote:
      "We had never prospected before. By Sunday we were finding color in the creek and already planning our next trip.",
    name: "Mike & Sarah",
    detail: "First-time guests, Burnt River",
  },
  {
    quote:
      "The community is what keeps us coming back — everyone shares tips, and the kids love the camp activities.",
    name: "James R.",
    detail: "Member, Stanton camp",
  },
  {
    quote:
      "I came for a detector weekend and left with new friends and a list of camps I want to visit.",
    name: "Linda K.",
    detail: "Detector event attendee",
  },
];

const FAQ = [
  {
    q: "Do I need to be an LDMA member to attend?",
    a: "Most events welcome guests. Members often save on tickets — you'll see member and guest pricing when you register.",
  },
  {
    q: "What is LDMA?",
    a: "The Lost Dutchman's Mining Association — 50 years of private gold claims and campgrounds across the American West and Southeast. Events are weekends at those camps.",
  },
  {
    q: "I've never prospected. Is that OK?",
    a: "Absolutely. Many events include demos, paydirt, and help for beginners. Gold Diggin's and Dirt Party weekends are especially welcoming.",
  },
  {
    q: "What's included in my ticket?",
    a: "It varies by event — typically campsite access for your party, structured activities, and time on the claim. Each event page lists what's included.",
  },
];

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

type LeadConfig = {
  title: string;
  description: string;
  interestPath: string;
  referrerCta: string;
  eventTypeInterest?: string;
  showCampSelect?: boolean;
};

export function DiscoverEventsContent({ events }: { events: EventProduct[] }) {
  const heroRef = useRef<HTMLElement>(null);
  const typeCarouselRef = useRef<HTMLDivElement>(null);
  const eventsCarouselRef = useRef<HTMLDivElement>(null);
  const testimonialRef = useRef<HTMLDivElement>(null);
  const campsRef = useRef<HTMLDivElement>(null);

  const { scrollY } = useScroll();
  const heroBgY = useTransform(scrollY, [0, 600], [0, 120]);

  const [videoOpen, setVideoOpen] = useState(false);
  const [leadModal, setLeadModal] = useState<LeadConfig | null>(null);

  const upcoming = useMemo(() => sortUpcomingEvents(events), [events]);
  const nextEvent = useMemo(() => getNextUpcomingEvent(events), [events]);

  const openLead = useCallback((config: LeadConfig) => {
    trackDiscoverCtaClick(config.referrerCta, config.interestPath);
    setLeadModal(config);
  }, []);

  const scrollCarousel = (ref: React.RefObject<HTMLDivElement | null>, dir: -1 | 1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.85), behavior: "smooth" });
  };

  const nextEventDates = nextEvent ? getEventDates(nextEvent) : null;
  const nextEventCamp = nextEvent ? getCampLabel(nextEvent) : null;
  const nextEventType = nextEvent ? getEventTypeLabel(getEventType(nextEvent)) : null;
  const nextEventImage =
    nextEvent?.featuredImage?.url ?? "/images/campgrounds/stanton-arizona/camp-stanton.jpg";

  return (
    <div className="bg-[#1a120b] text-[#e8e0d5] overflow-x-hidden">
      {/* ── Full-bleed hero ── */}
      <section ref={heroRef} className="relative min-h-[100vh] flex items-end overflow-hidden">
        <motion.div className="absolute inset-0" style={{ y: heroBgY }}>
          <Image
            src="/images/about-events/community.jpg"
            alt="LDMA members gathered for a fun event at camp"
            fill
            priority
            className="object-cover object-center scale-105"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-[#1a120b]/75" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1a120b] via-[#1a120b]/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0f3d1e]/30 to-transparent" />
        </motion.div>

        <div className="relative z-10 w-full px-4 sm:px-6 lg:px-10 pb-16 md:pb-24 pt-32">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-10 lg:gap-16 items-end">
            <div>
              <motion.span
                className="inline-block px-3 py-1 rounded-full border border-[#d4af37]/40 bg-[#d4af37]/10 text-[#d4af37] text-xs sm:text-sm font-medium tracking-wide mb-5"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                LDMA Events · 50th Anniversary
              </motion.span>
              <motion.h1
                className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-[#f0d48f] leading-[1.05] mb-5"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
              >
                Gold, adventure &amp; community at America&apos;s camps
              </motion.h1>
              <motion.p
                className="text-[#e8e0d5]/90 text-lg md:text-xl max-w-xl leading-relaxed mb-8"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                Weekends on private gold claims — panning, detecting, camp life, and people who love the hunt.
                No membership required to get started.
              </motion.p>
              <motion.div
                className="flex flex-wrap gap-3"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                <button
                  type="button"
                  onClick={() =>
                    openLead({
                      title: "See what's coming up",
                      description:
                        "We'll email you the next LDMA events — dates, camps, and when registration opens.",
                      interestPath: "events_digest",
                      referrerCta: "hero_see_upcoming",
                    })
                  }
                  className="inline-flex items-center justify-center px-7 py-3.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-all shadow-[0_0_24px_rgba(212,175,55,0.25)]"
                >
                  See what&apos;s coming up
                </button>
                <button
                  type="button"
                  onClick={() => {
                    trackDiscoverCtaClick("hero_watch_intro");
                    setVideoOpen(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 border border-[#d4af37]/50 text-[#f0d48f] font-semibold rounded-lg hover:bg-[#d4af37]/10 transition-colors"
                >
                  <Play className="w-4 h-4 fill-current" /> Watch 60-sec intro
                </button>
              </motion.div>
            </div>

            {/* Next event spotlight — dynamic from Shopify dates */}
            {nextEvent && (
              <motion.div
                className="rounded-2xl overflow-hidden border border-[#d4af37]/30 bg-[#0f0a06]/80 backdrop-blur-md shadow-[0_8px_48px_rgba(0,0,0,0.45)]"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.7, delay: 0.35 }}
              >
                <p className="px-5 pt-4 text-xs font-semibold uppercase tracking-widest text-[#d4af37]">
                  Next event
                </p>
                <div className="relative aspect-[16/9] w-full mt-2">
                  <Image
                    src={nextEventImage}
                    alt={getCardTitle(nextEvent.title)}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 40vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1a120b] via-transparent to-transparent" />
                </div>
                <div className="p-5 sm:p-6 -mt-8 relative">
                  {nextEventType && (
                    <span className="text-xs text-[#d4af37]/80 font-medium">{nextEventType}</span>
                  )}
                  <h2 className="font-serif text-xl sm:text-2xl font-semibold text-[#f0d48f] mt-1 mb-3">
                    {getCardTitle(nextEvent.title)}
                  </h2>
                  <div className="flex flex-wrap gap-4 text-sm text-[#e8e0d5]/80 mb-5">
                    {nextEventDates?.formatted && (
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-[#d4af37]" />
                        {nextEventDates.formatted}
                      </span>
                    )}
                    {nextEventCamp && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-[#d4af37]" />
                        {nextEventCamp}
                      </span>
                    )}
                  </div>
                  <Link
                    href={`/events/${nextEvent.handle}`}
                    onClick={() => trackDiscoverCtaClick("next_event_register")}
                    className="inline-flex w-full sm:w-auto items-center justify-center px-6 py-3 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors"
                  >
                    View dates &amp; register
                  </Link>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* ── Event types carousel ── */}
      <section className="py-20 md:py-28 border-t border-[#d4af37]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 mb-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#f0d48f]">
              What kind of event is this?
            </h2>
            <p className="mt-2 text-[#e8e0d5]/75 max-w-xl">
              LDMA hosts different weekends for different vibes — from flagship Gold Diggin&apos;s to
              detector hunts and one-of-a-kind adventures.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => scrollCarousel(typeCarouselRef, -1)}
              className="p-2.5 rounded-lg border border-[#d4af37]/30 text-[#d4af37] hover:bg-[#d4af37]/10"
              aria-label="Previous"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => scrollCarousel(typeCarouselRef, 1)}
              className="p-2.5 rounded-lg border border-[#d4af37]/30 text-[#d4af37] hover:bg-[#d4af37]/10"
              aria-label="Next"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div
          ref={typeCarouselRef}
          className="flex gap-5 overflow-x-auto snap-x snap-mandatory scroll-smooth px-4 sm:px-6 lg:px-10 pb-4 scrollbar-hide"
          style={{ scrollbarWidth: "none" }}
        >
          {EVENT_TYPE_CARDS.map((card, i) => (
            <motion.article
              key={card.id}
              className="snap-start shrink-0 w-[min(85vw,340px)] rounded-2xl overflow-hidden border border-[#d4af37]/20 bg-[#0f0a06]/60 hover:border-[#d4af37]/40 transition-colors group"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image src={card.image} alt={card.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="340px" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1a120b] via-[#1a120b]/30 to-transparent" />
                <span className="absolute top-4 left-4 inline-flex w-10 h-10 rounded-lg bg-[#d4af37]/20 items-center justify-center text-[#d4af37]">
                  <card.icon className="w-5 h-5" />
                </span>
              </div>
              <div className="p-5">
                <h3 className="font-serif text-xl font-semibold text-[#f0d48f] mb-2">{card.title}</h3>
                <p className="text-sm text-[#e8e0d5]/80 leading-relaxed mb-4">{card.desc}</p>
                <button
                  type="button"
                  onClick={() =>
                    openLead({
                      title: `Learn about ${card.title}`,
                      description: `Tell us where to reach you — we'll send info about ${card.title} events, dates, and how to register.`,
                      interestPath: card.id,
                      referrerCta: `type_${card.id}`,
                      eventTypeInterest: card.id,
                    })
                  }
                  className="text-sm font-semibold text-[#d4af37] hover:text-[#f0d48f] transition-colors"
                >
                  Learn more &amp; get alerts →
                </button>
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      {/* ── Interest pillars ── */}
      <section className="py-20 md:py-28 bg-[#0f3d1e]/25 border-y border-[#d4af37]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#f0d48f]">
              Find your kind of weekend
            </h2>
            <p className="mt-3 text-[#e8e0d5]/75">
              Tell us what you&apos;re looking for — we&apos;ll send the right events and tips for your situation.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {INTEREST_PILLARS.map((pillar, i) => (
              <motion.button
                key={pillar.id}
                type="button"
                onClick={() =>
                  openLead({
                    title: pillar.cta,
                    description: pillar.desc,
                    interestPath: pillar.id,
                    referrerCta: `pillar_${pillar.id}`,
                    showCampSelect: pillar.id === "family_trip" || pillar.id === "first_timer",
                  })
                }
                className="text-left rounded-2xl border border-[#d4af37]/20 bg-[#1a120b]/80 p-6 hover:border-[#d4af37]/45 hover:bg-[#1a120b] transition-all group"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <h3 className="font-serif text-lg font-semibold text-[#f0d48f] mb-2 group-hover:text-[#f0d48f]">
                  {pillar.title}
                </h3>
                <p className="text-sm text-[#e8e0d5]/75 leading-relaxed mb-4">{pillar.desc}</p>
                <span className="text-sm font-semibold text-[#d4af37] group-hover:text-[#f0d48f]">
                  {pillar.cta} →
                </span>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Social proof carousel ── */}
      <section className="py-20 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 mb-8 flex items-center justify-between">
          <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#f0d48f]">
            Real weekends, real stories
          </h2>
          <div className="flex gap-2">
            <button type="button" onClick={() => scrollCarousel(testimonialRef, -1)} className="p-2 rounded-lg border border-[#d4af37]/25 text-[#d4af37]/80 hover:bg-[#d4af37]/10" aria-label="Previous quote">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => scrollCarousel(testimonialRef, 1)} className="p-2 rounded-lg border border-[#d4af37]/25 text-[#d4af37]/80 hover:bg-[#d4af37]/10" aria-label="Next quote">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div ref={testimonialRef} className="flex gap-5 overflow-x-auto snap-x snap-mandatory scroll-smooth px-4 sm:px-6 lg:px-10 pb-2" style={{ scrollbarWidth: "none" }}>
          {TESTIMONIALS.map((t) => (
            <blockquote
              key={t.name}
              className="snap-start shrink-0 w-[min(88vw,420px)] rounded-2xl border border-[#d4af37]/15 bg-[#0f0a06]/50 p-8"
            >
              <p className="text-[#e8e0d5]/90 text-base leading-relaxed mb-6">&ldquo;{t.quote}&rdquo;</p>
              <footer>
                <p className="font-semibold text-[#f0d48f]">{t.name}</p>
                <p className="text-sm text-[#e8e0d5]/55">{t.detail}</p>
              </footer>
            </blockquote>
          ))}
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 mt-12 grid grid-cols-3 gap-6 text-center">
          {[
            { value: "50", label: "Years of adventure" },
            { value: "12", label: "Private campgrounds" },
            { value: "8", label: "States" },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="font-serif text-3xl md:text-4xl font-bold text-[#d4af37]">{stat.value}</p>
              <p className="text-xs sm:text-sm text-[#e8e0d5]/60 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Upcoming events ── */}
      <section id="upcoming-events" className="py-20 md:py-28 bg-[#0f0a06]/50 border-t border-[#d4af37]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 mb-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#f0d48f]">Upcoming events</h2>
            <p className="mt-2 text-[#e8e0d5]/75">Sorted by date — register when you&apos;re ready.</p>
          </div>
          <div className="flex gap-2 items-center">
            <button type="button" onClick={() => scrollCarousel(eventsCarouselRef, -1)} className="p-2.5 rounded-lg border border-[#d4af37]/30 text-[#d4af37] hover:bg-[#d4af37]/10" aria-label="Previous events">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button type="button" onClick={() => scrollCarousel(eventsCarouselRef, 1)} className="p-2.5 rounded-lg border border-[#d4af37]/30 text-[#d4af37] hover:bg-[#d4af37]/10" aria-label="Next events">
              <ChevronRight className="w-5 h-5" />
            </button>
            <Link href="/events" className="ml-2 text-sm font-semibold text-[#d4af37] hover:text-[#f0d48f] whitespace-nowrap">
              View all →
            </Link>
          </div>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-center text-[#e8e0d5]/60 px-4">New events are being scheduled — sign up above to hear first.</p>
        ) : (
          <div ref={eventsCarouselRef} className="flex gap-5 overflow-x-auto snap-x snap-mandatory scroll-smooth px-4 sm:px-6 lg:px-10 pb-4" style={{ scrollbarWidth: "none" }}>
            {upcoming.slice(0, 8).map((event) => {
              const dates = getEventDates(event);
              const camp = getCampLabel(event);
              const typeLabel = getEventTypeLabel(getEventType(event));
              const img = event.featuredImage?.url ?? "/images/campgrounds/stanton-arizona/camp-stanton.jpg";
              return (
                <article
                  key={event.id}
                  className="snap-start shrink-0 w-[min(85vw,300px)] rounded-xl overflow-hidden border border-[#d4af37]/20 bg-[#1a120b]/80 flex flex-col"
                >
                  <div className="relative aspect-[4/3]">
                    <Image src={img} alt={getCardTitle(event.title)} fill className="object-cover" sizes="300px" />
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    <span className="text-xs text-[#d4af37]/75">{typeLabel}</span>
                    <h3 className="font-serif text-lg font-semibold text-[#f0d48f] mt-1 mb-2 line-clamp-2">
                      {getCardTitle(event.title)}
                    </h3>
                    {dates.formatted && (
                      <p className="text-xs text-[#e8e0d5]/65 flex items-center gap-1 mb-1">
                        <Calendar className="w-3.5 h-3.5" /> {dates.formatted}
                      </p>
                    )}
                    {camp && (
                      <p className="text-xs text-[#e8e0d5]/65 flex items-center gap-1 mb-4">
                        <MapPin className="w-3.5 h-3.5" /> {camp}
                      </p>
                    )}
                    <Link
                      href={`/events/${event.handle}`}
                      className="mt-auto inline-flex justify-center py-2.5 text-sm font-semibold bg-[#d4af37]/15 text-[#f0d48f] border border-[#d4af37]/35 rounded-lg hover:bg-[#d4af37]/25 transition-colors"
                    >
                      Get details
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Camps ── */}
      <section className="py-20 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 mb-8">
          <h2 className="font-serif text-3xl font-bold text-[#f0d48f]">Where we host</h2>
          <p className="mt-2 text-[#e8e0d5]/75 max-w-xl">
            Private campgrounds on real gold claims — from Arizona deserts to Carolina hills.
          </p>
        </div>
        <div ref={campsRef} className="flex gap-4 overflow-x-auto snap-x scroll-smooth px-4 sm:px-6 lg:px-10 pb-2" style={{ scrollbarWidth: "none" }}>
          {CAMPS_SLIDER.map((camp) => (
            <Link
              key={camp.slug}
              href={`/campgrounds/${camp.slug}`}
              className="snap-start shrink-0 w-48 sm:w-56 rounded-xl overflow-hidden border border-[#d4af37]/15 group"
            >
              <div className="relative aspect-[4/3]">
                <Image src={camp.image} alt={camp.label} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="224px" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1a120b]/90 to-transparent" />
                <span className="absolute bottom-3 left-3 text-sm font-semibold text-[#f0d48f]">{camp.label}</span>
              </div>
            </Link>
          ))}
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 mt-8 text-center">
          <button
            type="button"
            onClick={() =>
              openLead({
                title: "Events near you",
                description: "Pick your nearest camp and we'll send upcoming events in that region.",
                interestPath: "near_me",
                referrerCta: "camps_near_me",
                showCampSelect: true,
              })
            }
            className="inline-flex items-center gap-2 px-6 py-3 border border-[#d4af37]/40 text-[#f0d48f] font-semibold rounded-lg hover:bg-[#d4af37]/10 transition-colors"
          >
            <MapPin className="w-4 h-4" /> Find events near me
          </button>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-16 md:py-20 bg-[#0f3d1e]/20 border-t border-[#d4af37]/10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#f0d48f] text-center mb-10">
            New to LDMA? Start here.
          </h2>
          <dl className="space-y-6">
            {FAQ.map((item) => (
              <div key={item.q} className="rounded-xl border border-[#d4af37]/15 bg-[#1a120b]/60 p-5">
                <dt className="font-semibold text-[#f0d48f] mb-2">{item.q}</dt>
                <dd className="text-sm text-[#e8e0d5]/80 leading-relaxed">{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Final CTA band ── */}
      <section className="relative py-24 md:py-32 overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/images/campgrounds/stanton-arizona/camp-stanton.jpg"
            alt=""
            fill
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-[#1a120b]/85" />
        </div>
        <div className="relative max-w-3xl mx-auto px-4 text-center">
          <Users className="w-10 h-10 text-[#d4af37] mx-auto mb-5" />
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#f0d48f] mb-4">
            Ready to see it for yourself?
          </h2>
          <p className="text-[#e8e0d5]/85 mb-8 leading-relaxed">
            Pick an event, grab a ticket, and show up at camp. Or start with our guide — we&apos;ll help you find the right first weekend.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/events"
              onClick={() => trackDiscoverCtaClick("footer_browse_events")}
              className="inline-flex justify-center px-8 py-3.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors"
            >
              Browse all events
            </Link>
            <button
              type="button"
              onClick={() =>
                openLead({
                  title: "Get the newcomer guide",
                  description: "A short email series: what LDMA is, what to pack, and which events fit beginners.",
                  interestPath: "first_timer",
                  referrerCta: "footer_newcomer_guide",
                })
              }
              className="inline-flex justify-center px-8 py-3.5 border border-[#d4af37]/50 text-[#f0d48f] font-semibold rounded-lg hover:bg-[#d4af37]/10 transition-colors"
            >
              Email me the guide
            </button>
          </div>
        </div>
      </section>

      {/* Video modal */}
      {videoOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90" onClick={() => setVideoOpen(false)}>
          <div className="relative w-full max-w-4xl aspect-video rounded-xl overflow-hidden border border-[#d4af37]/30" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setVideoOpen(false)} className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/60 text-white hover:bg-black/80" aria-label="Close video">
              <X className="w-5 h-5" />
            </button>
            <iframe
              src={`https://www.youtube.com/embed/${INTRO_VIDEO_ID}?autoplay=1&rel=0`}
              title="Introduction to LDMA"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          </div>
        </div>
      )}

      <DiscoverLeadModal
        open={leadModal != null}
        onClose={() => setLeadModal(null)}
        title={leadModal?.title ?? ""}
        description={leadModal?.description ?? ""}
        interestPath={leadModal?.interestPath ?? "curious"}
        referrerCta={leadModal?.referrerCta ?? "unknown"}
        eventTypeInterest={leadModal?.eventTypeInterest}
        showCampSelect={leadModal?.showCampSelect}
      />
    </div>
  );
}
