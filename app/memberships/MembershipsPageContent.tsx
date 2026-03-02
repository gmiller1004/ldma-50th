"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  MapPin,
  Tent,
  Sparkles,
  Users,
  Gem,
  Zap,
  ChevronRight,
  Shield,
  Clock,
} from "lucide-react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CustomizeMembershipButton } from "./CustomizeMembershipButton";

const benefits = [
  {
    icon: MapPin,
    title: "12 Private Campgrounds",
    desc: "Exclusive access across 8 states — Arizona, California, Oregon, Georgia, South Carolina, North Carolina, Nevada, Colorado. Full hookups to primitive, from desert to Blue Ridge.",
  },
  {
    icon: Sparkles,
    title: "Keep the Gold You Find",
    desc: "Every nugget and flake you uncover on LDMA claims is yours to keep — no limits, no catch. Patented mines and gold-bearing claims in historic gold rush territory.",
  },
  {
    icon: Tent,
    title: "Camping from $6/Night",
    desc: "Stay up to 6 months per visit. RV hookups, showers, clubhouses, dump stations. Bring up to 4 guests. Family-friendly settings built for adventure.",
  },
  {
    icon: Users,
    title: "Community of 6,500+",
    desc: "Hands-on demos, co-hosted outings with Minelab and Garrett, campfire camaraderie. Beginners welcome — learn from experienced members.",
  },
  {
    icon: Gem,
    title: "More Than Gold",
    desc: "Fishing, kayaking, hiking, ATV trails, metal detecting, relic hunting. Gem hunting at select camps. Potlucks, crafts, and events.",
  },
  {
    icon: Zap,
    title: "Equipment & Discounts",
    desc: "Membership perks, equipment deals, and optional add-ons. GPAA integration for 93,000+ additional acres. Companion add-on for family.",
  },
];

const included = [
  "Access to all 12 LDMA campgrounds",
  "Gold prospecting on patented claims",
  "Family-inclusive (spouse, children under 18)",
  "Up to 4 guests per visit",
  "Stay up to 6 months at a time",
  "Membership card, name badges, decals",
  "Paydirt bag, gold pans, scoops",
  "30-day refund window",
  "No prospecting experience required",
];

const testimonials = [
  {
    quote:
      "We joined in 2023 and have been to Blue Bucket and Stanton. Wow! I could not ask for better places to camp AND prospect. The people we've met have made us feel like family.",
    author: "Donna H.",
  },
  {
    quote:
      "We have traveled all over the country, been to all but one camp. Vein Mountain is our Home. Love the caretakers, the mining, the location. 10 out of 10 stars.",
    author: "Bill O.",
  },
  {
    quote:
      "So much to offer! Prospecting for gold, gems, silver, make new friends, campfires, camping, coffee, relaxing. It's a must see and do for yourself.",
    author: "Yvette E.",
  },
];

const TRUST_STATS = [
  { label: "50 years", sub: "of adventure" },
  { label: "6,500+", sub: "members" },
  { label: "12", sub: "private campgrounds" },
  { label: "30-day", sub: "refund guarantee" },
];

export function MembershipsPageContent() {
  const [showStickyBar, setShowStickyBar] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowStickyBar(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Membership" },
          ]}
        />
      </div>

      {/* Sticky CTA bar — appears on scroll */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{
          opacity: showStickyBar ? 1 : 0,
          y: showStickyBar ? 0 : -20,
          pointerEvents: showStickyBar ? "auto" : "none",
        }}
        className="fixed top-16 md:top-20 left-0 right-0 z-40 py-3 px-4 bg-[#1a120b]/95 backdrop-blur-md border-b border-[#d4af37]/20 shadow-lg"
      >
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[#e8e0d5]/90 text-sm sm:text-base font-medium">
            Lifetime membership from $2,000 · <span className="text-[#6dd472]">Save $1,750</span>
          </p>
          <CustomizeMembershipButton />
        </div>
      </motion.div>

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
            Join LDMA
          </motion.h1>
          <motion.p
            className="text-[#e8e0d5]/90 text-lg md:text-xl max-w-2xl mx-auto mb-4"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Your family&apos;s key to gold prospecting & camping across 12
            exclusive locations — since 1976
          </motion.p>
          <motion.div
            className="flex items-center justify-center gap-2 mb-8 text-[#e8e0d5]/80"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <span className="text-lg font-semibold text-[#d4af37]">$2,000</span>
            <span className="text-sm line-through">$3,750</span>
            <span className="px-2 py-0.5 rounded bg-[#0f3d1e] text-[#6dd472] text-sm font-medium">
              Save $1,750
            </span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <CustomizeMembershipButton />
          </motion.div>
          <p className="text-[#e8e0d5]/50 text-xs mt-3">
            Takes under 2 minutes · No commitment to explore options
          </p>
        </div>

        {/* Trust strip */}
        <motion.div
          className="relative mt-16 pt-12 border-t border-[#d4af37]/20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <div className="max-w-4xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {TRUST_STATS.map(({ label, sub }) => (
              <div key={label} className="text-center">
                <p className="font-serif text-2xl md:text-3xl font-bold text-[#d4af37]">
                  {label}
                </p>
                <p className="text-[#e8e0d5]/60 text-sm mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Overview */}
      <section className="py-12 md:py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <motion.p
            className="text-[#e8e0d5]/90 text-lg leading-relaxed text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            At LDMA, you&apos;re not just joining an adventure club — you&apos;re
            becoming part of a family that thrives on the thrill of gold
            prospecting and the serenity of the great outdoors. One membership
            unlocks campgrounds, claims, and camaraderie across eight states.
          </motion.p>
        </div>
      </section>

      {/* Benefits Grid */}
      <section className="py-16 md:py-24 bg-[#0f3d1e]/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.h2
            className="font-serif text-2xl md:text-3xl font-bold text-[#f0d48f] text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Membership Benefits
          </motion.h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {benefits.map(({ icon: Icon, title, desc }, i) => (
              <motion.div
                key={title}
                className="p-6 rounded-2xl bg-[#1a120b]/80 border border-[#d4af37]/20 hover:border-[#d4af37]/40 transition-colors"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <span className="inline-flex w-12 h-12 rounded-xl bg-[#d4af37]/15 items-center justify-center text-[#d4af37] mb-4">
                  <Icon className="w-6 h-6" strokeWidth={2} />
                </span>
                <h3 className="font-serif text-xl font-semibold text-[#f0d48f] mb-2">
                  {title}
                </h3>
                <p className="text-[#e8e0d5]/85 text-sm leading-relaxed">
                  {desc}
                </p>
              </motion.div>
            ))}
          </div>
          <motion.div
            className="text-center mt-12"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <CustomizeMembershipButton />
          </motion.div>
        </div>
      </section>

      {/* What's Included */}
      <section className="py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <motion.h2
            className="font-serif text-2xl md:text-3xl font-bold text-[#f0d48f] text-center mb-10"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            What&apos;s Included
          </motion.h2>
          <motion.ul
            className="space-y-3"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            {included.map((item, i) => (
              <motion.li
                key={item}
                className="flex items-center gap-3 text-[#e8e0d5]/90"
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.03 }}
              >
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#d4af37]/30 flex items-center justify-center">
                  <ChevronRight className="w-3 h-3 text-[#d4af37]" />
                </span>
                {item}
              </motion.li>
            ))}
          </motion.ul>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 md:py-24 bg-[#0f3d1e]/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <motion.h2
            className="font-serif text-2xl md:text-3xl font-bold text-[#f0d48f] text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Hear From Members
          </motion.h2>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map(({ quote, author }, i) => (
              <motion.blockquote
                key={author}
                className="p-6 rounded-xl bg-[#1a120b]/60 border border-[#d4af37]/15"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <p className="text-[#e8e0d5]/90 text-sm leading-relaxed mb-4 italic">
                  &ldquo;{quote}&rdquo;
                </p>
                <footer className="text-[#d4af37] text-sm font-medium">
                  — {author}
                </footer>
              </motion.blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        id="membership-cta"
        className="py-20 md:py-28 bg-gradient-to-b from-[#0f3d1e]/50 to-[#1a120b]"
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#f0d48f] mb-4">
              Find Your Perfect Membership
            </h2>
            <p className="text-[#e8e0d5]/80 mb-6 max-w-xl mx-auto">
              Customize your membership in under 2 minutes — we&apos;ll recommend
              options that fit your family, camping style, and prospecting goals.
              No commitment required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
              <CustomizeMembershipButton />
              <a
                href="tel:8005519707"
                className="text-[#e8e0d5]/70 hover:text-[#d4af37] text-sm transition-colors"
              >
                Questions? Call (800) 551-9707
              </a>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-[#e8e0d5]/60">
              <span className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-[#6dd472]" />
                30-day refund guarantee
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#6dd472]" />
                No prospecting experience needed
              </span>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}
