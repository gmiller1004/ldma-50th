"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Calendar, ChevronRight, MapPin, PlayCircle } from "lucide-react";
import type { EventProduct } from "@/lib/shopify";

const HEATH_REEL = "https://www.facebook.com/reel/3096037517394970";

const LEARNING_METHODS = [
  {
    title: "Metal Detecting",
    desc: "Ground balance, sensitivity, sweep speed, and trusting a faint signal in mineralized ground.",
    image: "/images/email/events-education/detecting.jpg",
    alt: "A line of prospectors learning to swing metal detectors",
    reel: HEATH_REEL,
  },
  {
    title: "Dry Washing",
    desc: "Recover gold with air and vibration, all the way up to multi-box machines like Big Bertha.",
    image: "/images/email/events-education/dry-washing.jpg",
    alt: "Running gold-bearing material through Big Bertha, a multi-box dry washer",
    reel: "https://fb.watch/KeaaeN8p0H/",
  },
  {
    title: "High Banking",
    desc: "Classify, feed, and run paydirt, then learn the cleanup that turns black sand into gold.",
    image: "/images/email/events-education/high-banking.jpg",
    alt: "Prospectors feeding paydirt into a high banker at an LDMA camp",
    reel: "https://fb.watch/Ke9-b5h8er/",
  },
  {
    title: "Dredging",
    desc: "Get in the water and see how a dredge moves material, at camps where it's allowed.",
    image: "/images/email/events-education/dredging.jpg",
    alt: "Prospectors running a dredge in a river at an LDMA camp",
    reel: "https://fb.watch/KealVB1tjX/",
  },
] as const;

export const THROWDOWN_HANDLE = "diggers-detector-throwdown-duisenburg-2026-oct-22-24";

const THROWDOWN_SCHEDULE = [
  { day: "Thu 10/22", title: "Training day", time: "9 AM–2 PM", desc: "Detector tune-up, techniques, and Minelab demos." },
  { day: "Fri 10/23", title: "Hunt day one", time: "8:30 AM–4 PM", desc: "Wild detecting plus the Gold Nugget Garden for token holders." },
  { day: "Sat 10/24", title: "Hunt day two", time: "8:30 AM–3:30 PM", desc: "Final finds, prize drawings, and awards." },
] as const;

const THROWDOWN_INSTRUCTORS: Array<{ name: string; org?: string; desc: string; link?: string }> = [
  {
    name: "Dylan Pritchard",
    org: "BKings Outdoors",
    desc: "Multi-time winner of Garrett's Gold Detecting Challenge in Mariposa, California. Leading training day.",
  },
  {
    name: "Heath Jones",
    org: "History Seekers",
    desc: "More than a million followers learn detecting from Heath. Training on site, with detectors for sale.",
    link: HEATH_REEL,
  },
  { name: "Ma Gold", desc: "Seeding the hunt field with gold and visiting with hunters all weekend." },
  { name: "Team Minelab", desc: "Demos of Minelab's top gold detectors, plus help dialing in your machine." },
];

export function FourWaysToLearn() {
  return (
    <section className="py-14 md:py-20 border-t border-[#d4af37]/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <p className="text-[#d4af37] text-xs font-semibold tracking-[0.2em] uppercase mb-2">
            Four ways to learn
          </p>
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#f0d48f]">
            Pick your method. We&apos;ll put you on the gold.
          </h2>
          <p className="mt-3 text-[#e8e0d5]/75 max-w-2xl mx-auto">
            LDMA prospects, digs, and stockpiles gold-bearing paydirt before every event, so the
            gold is there when you are. First swing or twenty years in, you&apos;ll leave knowing
            more, and with gold.
          </p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {LEARNING_METHODS.map((m, i) => (
            <motion.div
              key={m.title}
              className="group rounded-2xl overflow-hidden bg-[#1a120b]/80 border border-[#d4af37]/20 hover:border-[#d4af37]/40 transition-colors"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: i * 0.06 }}
            >
              <a href={m.reel} target="_blank" rel="noopener noreferrer" className="block relative aspect-[5/4] overflow-hidden">
                <Image
                  src={m.image}
                  alt={m.alt}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="(max-width: 1024px) 50vw, 25vw"
                />
                <span className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 inline-flex items-center gap-1.5 rounded-full bg-black/65 px-2.5 py-1 text-xs font-medium text-white">
                  <PlayCircle className="w-4 h-4 text-[#d4af37]" />
                  Watch
                </span>
              </a>
              <div className="p-3 sm:p-5">
                <h3 className="font-serif text-base sm:text-xl font-semibold text-[#f0d48f] sm:mb-2">{m.title}</h3>
                <p className="hidden sm:block text-[#e8e0d5]/75 text-sm leading-relaxed mb-3">{m.desc}</p>
                <a
                  href={m.reel}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-[#d4af37] hover:text-[#f0d48f]"
                >
                  <PlayCircle className="w-4 h-4" />
                  Watch it in action
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ThrowdownSpotlight({ event }: { event: EventProduct }) {
  const href = `/events/${event.handle}`;
  return (
    <section className="py-14 md:py-20 border-t border-[#d4af37]/10 bg-[#0f3d1e]/15">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-10 items-start">
          <div>
            <p className="text-[#d4af37] text-xs font-semibold tracking-[0.2em] uppercase mb-3">
              Featured event · Training day included
            </p>
            <Link href={href} className="block relative aspect-square max-w-[240px] sm:max-w-sm mx-auto lg:mx-0 rounded-2xl overflow-hidden border border-[#d4af37]/20">
              <Image
                src="/images/email/events-education/throwdown-logo.jpg"
                alt="Lost Dutchman's 50 Year Throwdown — A Gold Nugget Frenzy"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 90vw, 384px"
              />
            </Link>
          </div>
          <div>
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#f0d48f]">
              Digger&apos;s Detector Throwdown
            </h2>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[#e8e0d5]/80">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#d4af37]/80" />
                October 22–24, 2026
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#d4af37]/80" />
                Duisenburg Gold Camp, near Randsburg, CA
              </span>
            </p>
            <p className="mt-4 text-[#e8e0d5]/85 leading-relaxed">
              Start with a full day of hands-on training, then hunt private ground for real gold
              nuggets and buried prize tokens. Anything you find is yours to keep. Only 150 spots.
            </p>

            <ul className="mt-6 divide-y divide-[#d4af37]/15 border-y border-[#d4af37]/15">
              {THROWDOWN_SCHEDULE.map((s) => (
                <li key={s.day} className="flex gap-4 py-3">
                  <span className="w-20 flex-shrink-0 text-xs font-semibold uppercase tracking-wider text-[#d4af37] pt-0.5">
                    {s.day}
                  </span>
                  <span className="text-sm text-[#e8e0d5]/75">
                    <strong className="text-[#e8e0d5]">{s.title}</strong> · {s.time}
                    <br />
                    {s.desc}
                  </span>
                </li>
              ))}
            </ul>

            <h3 className="mt-8 mb-4 font-serif text-xl font-semibold text-[#f0d48f]">
              Who you&apos;ll learn from
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {THROWDOWN_INSTRUCTORS.map((p) => (
                <div key={p.name} className="flex gap-3">
                  <span className="flex-shrink-0 w-10 h-10 rounded-full bg-[#d4af37] text-[#1a120b] font-serif font-bold flex items-center justify-center">
                    {p.name.charAt(0)}
                  </span>
                  <div className="text-sm">
                    <p className="text-[#e8e0d5] font-semibold">
                      {p.name}
                      {p.org && <span className="font-normal text-[#d4af37]"> · {p.org}</span>}
                    </p>
                    <p className="text-[#e8e0d5]/70 leading-relaxed">
                      {p.desc}
                      {p.link && (
                        <>
                          {" "}
                          <a
                            href={p.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-medium text-[#d4af37] hover:text-[#f0d48f] whitespace-nowrap"
                          >
                            <PlayCircle className="w-3.5 h-3.5" />
                            Watch Heath
                          </a>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href={href}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#d4af37] text-[#1a120b] font-semibold hover:bg-[#f0d48f] transition-colors"
              >
                Save my Throwdown spot
                <ChevronRight className="w-4 h-4" />
              </Link>
              <span className="text-sm text-[#e8e0d5]/60">When it fills, it closes.</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
