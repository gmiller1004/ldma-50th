"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bell, Calendar, Check, ChevronDown, Clock, MapPin, Tent, Users } from "lucide-react";
import {
  EventPurchaseSection,
  filterEventVariantsByMember,
  getEventVariants,
} from "@/components/EventPurchaseSection";
import {
  ACADEMY_PROMO_DEADLINE_LABEL,
  DETECTOR_ACADEMY_CAPACITY,
  DETECTOR_ACADEMY_DATES_LABEL,
  DETECTOR_ACADEMY_DATES_NOTE,
  DETECTOR_ACADEMY_DEPOSIT,
  DETECTOR_ACADEMY_DISCOUNT_ELIGIBILITY,
  DETECTOR_ACADEMY_FAQ,
  DETECTOR_ACADEMY_GAINS,
  DETECTOR_ACADEMY_INCLUDED,
  DETECTOR_ACADEMY_LEARNING,
  DETECTOR_ACADEMY_LOCATION,
  DETECTOR_ACADEMY_NAME,
  DETECTOR_ACADEMY_PATH,
  DETECTOR_ACADEMY_PRICE,
  DETECTOR_ACADEMY_PRICE_FRAME,
  DETECTOR_ACADEMY_PROOF,
  DETECTOR_ACADEMY_RESERVATION_PATH,
  DETECTOR_ACADEMY_TRAINERS,
  DETECTOR_ACADEMY_TRAINERS_INTRO,
  DETECTOR_ACADEMY_WEEK_INTRO,
  DETECTOR_ACADEMY_WEEK_OVERVIEW,
  DETECTOR_ACADEMY_WHO_FOR,
  GARRETT_TRADEMARK_NOTICE,
  isAcademyPromoOpen,
} from "@/lib/detector-academy";
import type { EventProduct } from "@/lib/shopify";
import { HypeVideo } from "./HypeVideo";
import { DiscountQuestionnaire } from "./DiscountQuestionnaire";
import { InterestQuestionnaire } from "./InterestQuestionnaire";

const BUNDLE_HREF = "/memberships#bundle-offer";

const LEARNING_IMAGES = [
  {
    src: "/images/memberships/axiom-lite-bundle-hero.jpg",
    alt: "Garrett Axiom Lite pulse induction detector",
    fit: "object-cover object-[35%_center]",
  },
  {
    src: "/images/flyers/goldmaster24k-img1.png",
    alt: "Garrett GoldMaster 24k detector",
    fit: "object-contain bg-white p-3",
  },
  {
    src: "/images/email/events-education/real-gold.jpg",
    alt: "Gold recovered at an LDMA camp",
    fit: "object-cover",
  },
];

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function SectionHeading({ eyebrow, title, intro }: { eyebrow: string; title: string; intro?: string }) {
  return (
    <div className="max-w-3xl mb-10">
      <p className="text-xs uppercase tracking-[0.2em] text-[#d4af37] mb-3">{eyebrow}</p>
      <h2 className="font-serif text-3xl md:text-4xl font-semibold text-[#f0d48f] leading-tight">{title}</h2>
      {intro ? <p className="mt-4 text-[#e8e0d5]/80 text-base md:text-lg leading-relaxed">{intro}</p> : null}
    </div>
  );
}

function RegistrationCard({
  event,
  isMemberLoggedIn,
  onInterested,
  onApplyDiscount,
}: {
  event: EventProduct | null;
  isMemberLoggedIn: boolean;
  onInterested: () => void;
  onApplyDiscount: () => void;
}) {
  const filtered = useMemo(
    () => (event ? filterEventVariantsByMember(event, isMemberLoggedIn) : null),
    [event, isMemberLoggedIn]
  );
  const variants = filtered ? getEventVariants(filtered) : [];
  const defaultVariant = variants.find((v) => v.availableForSale !== false) ?? variants[0];
  const [selectedVariantId, setSelectedVariantId] = useState(defaultVariant?.id ?? "");

  return (
    <div className="rounded-2xl border-2 border-[#d4af37] bg-[#0f0a06]/80 p-6 md:p-8 flex flex-col">
      <p className="text-xs uppercase tracking-[0.18em] text-[#d4af37] mb-2">Academy registration</p>
      <h3 className="font-serif text-2xl text-[#f0d48f] font-semibold mb-2">${DETECTOR_ACADEMY_PRICE} per participant</h3>
      <p className="text-sm text-[#e8e0d5]/75 mb-2">{DETECTOR_ACADEMY_PRICE_FRAME}</p>
      <p className="text-sm text-[#e8e0d5]/65 mb-4">
        Open to LDMA members and the public. {DETECTOR_ACADEMY_CAPACITY} spots total.
      </p>
      <ul className="grid gap-2 sm:grid-cols-2 text-sm text-[#e8e0d5]/85 mb-6">
        {DETECTOR_ACADEMY_INCLUDED.map((item) => (
          <li key={item} className="flex gap-2">
            <Check className="w-4 h-4 text-[#d4af37] shrink-0 mt-0.5" />
            {item}
          </li>
        ))}
      </ul>
      <div className="mt-auto space-y-4">
        {filtered && variants.length > 0 ? (
          <EventPurchaseSection
            event={filtered}
            isMemberLoggedIn={isMemberLoggedIn}
            selectedVariantId={selectedVariantId || defaultVariant?.id || ""}
            onSelectVariant={setSelectedVariantId}
            loginRedirectPath={DETECTOR_ACADEMY_PATH}
            compact
          />
        ) : (
          <div className="rounded-xl border border-[#d4af37]/25 bg-[#d4af37]/10 p-5 space-y-3">
            <p className="text-sm text-[#e8e0d5]/85">
              Online checkout is briefly unavailable. Leave your info and Member Services will get you registered.
            </p>
            <button
              type="button"
              onClick={onInterested}
              className="w-full inline-flex justify-center items-center gap-2 px-6 py-3 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors"
            >
              <Bell className="w-4 h-4" /> I&apos;m interested. Help me register.
            </button>
          </div>
        )}
        <div className="rounded-xl border border-[#d4af37]/20 bg-[#1a120b]/80 p-4 space-y-2">
          <button
            type="button"
            onClick={onApplyDiscount}
            className="text-[#d4af37] hover:text-[#f0d48f] underline underline-offset-4 text-sm font-medium"
          >
            Apply for 25% off
          </button>
          <p className="text-xs text-[#e8e0d5]/65 leading-relaxed">{DETECTOR_ACADEMY_DISCOUNT_ELIGIBILITY}</p>
        </div>
        <button
          type="button"
          onClick={onInterested}
          className="w-full text-center text-sm text-[#e8e0d5]/55 hover:text-[#f0d48f] underline underline-offset-4"
        >
          Questions? Tell us you&apos;re interested
        </button>
      </div>
    </div>
  );
}

function BundleCard({ promoOpen }: { promoOpen: boolean }) {
  return (
    <div className="relative rounded-2xl border border-[#d4af37]/35 bg-gradient-to-br from-[#0f3d1e]/50 via-[#1a120b] to-[#1a120b] p-6 md:p-8 flex flex-col overflow-hidden">
      <p className="text-xs uppercase tracking-[0.18em] text-[#d4af37] mb-2">Optional for new members</p>
      <h3 className="font-serif text-2xl text-[#f0d48f] font-semibold mb-2">
        Join with the Axiom Lite bundle. Academy free.
      </h3>
      <p className="text-sm text-[#e8e0d5]/80 mb-4">
        Want lifetime LDMA + GPAA membership and your own Garrett Axiom Lite? Join with the bundle by{" "}
        {ACADEMY_PROMO_DEADLINE_LABEL} and academy registration is included. You still put down a $
        {DETECTOR_ACADEMY_DEPOSIT} deposit to hold your seat.
      </p>
      <ul className="space-y-2 text-sm text-[#e8e0d5]/85 mb-6">
        <li className="flex gap-2">
          <Check className="w-4 h-4 text-[#d4af37] shrink-0 mt-0.5" />
          Lifetime membership + Family Legacy benefits + Axiom Lite to train on
        </li>
        <li className="flex gap-2">
          <Check className="w-4 h-4 text-[#d4af37] shrink-0 mt-0.5" />
          ${DETECTOR_ACADEMY_DEPOSIT} deposit holds your academy seat; returns as Stanton camp credit when you attend
        </li>
        <li className="flex gap-2">
          <Check className="w-4 h-4 text-[#d4af37] shrink-0 mt-0.5" />
          Can&apos;t make these dates? The ${DETECTOR_ACADEMY_DEPOSIT} becomes Stanton camp credit instead
        </li>
      </ul>
      <div className="mt-auto flex flex-col gap-3">
        {promoOpen ? (
          <>
            <Link
              href={BUNDLE_HREF}
              className="inline-flex justify-center items-center px-6 py-3.5 border-2 border-[#d4af37] text-[#f0d48f] font-semibold rounded-lg hover:bg-[#d4af37]/10 transition-colors"
            >
              See the Axiom Lite bundle
            </Link>
            <Link
              href={DETECTOR_ACADEMY_RESERVATION_PATH}
              className="text-center text-sm text-[#d4af37] hover:text-[#f0d48f] underline underline-offset-4"
            >
              Already bought the bundle? Reserve your free spot
            </Link>
          </>
        ) : (
          <p className="text-sm text-[#e8e0d5]/70">
            The bundle offer ended {ACADEMY_PROMO_DEADLINE_LABEL}. If you bought the bundle before then, you can still{" "}
            <Link href={DETECTOR_ACADEMY_RESERVATION_PATH} className="text-[#d4af37] underline">
              reserve your spot
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}

export function DetectorAcademyContent({
  event,
  isMemberLoggedIn,
}: {
  event: EventProduct | null;
  isMemberLoggedIn: boolean;
}) {
  const promoOpen = isAcademyPromoOpen();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [interestOpen, setInterestOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);

  return (
    <div className="text-[#e8e0d5]">
      <HypeVideo />

      {/* Hero: outcome first, one primary CTA */}
      <section className="relative min-h-[60vh] flex items-end overflow-hidden">
        <Image
          src="/images/about-events/detector-events.jpg"
          alt="Detectorists at an LDMA desert detecting event"
          fill
          priority
          className="object-cover object-[center_75%]"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a120b] via-[#1a120b]/70 to-[#1a120b]/20" />
        <div className="relative max-w-6xl mx-auto w-full px-4 sm:px-6 pb-14 md:pb-20 pt-16">
          <p className="text-xs uppercase tracking-[0.2em] text-[#d4af37] mb-4">{DETECTOR_ACADEMY_NAME}</p>
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-[#f0d48f] leading-[1.08] max-w-4xl">
            Leave Stanton knowing how gold sounds on your detector
          </h1>
          <p className="mt-5 text-lg md:text-xl text-[#e8e0d5]/90 max-w-2xl leading-relaxed">
            Four days on Arizona claim ground. Test gardens, small-group coaching, and your machine dialed in for
            mineralized desert dirt, with LDMA trainers and guest instructors right beside you.
          </p>
          <div className="mt-7 flex flex-wrap gap-3 text-sm">
            <span className="inline-flex items-center gap-2 rounded-lg bg-[#0f0a06]/70 border border-[#d4af37]/25 px-3 py-2">
              <Calendar className="w-4 h-4 text-[#d4af37]" />{" "}
              {DETECTOR_ACADEMY_DATES_NOTE
                ? `${DETECTOR_ACADEMY_DATES_LABEL} · ${DETECTOR_ACADEMY_DATES_NOTE.toLowerCase()}`
                : DETECTOR_ACADEMY_DATES_LABEL}
            </span>
            <span className="inline-flex items-center gap-2 rounded-lg bg-[#0f0a06]/70 border border-[#d4af37]/25 px-3 py-2">
              <MapPin className="w-4 h-4 text-[#d4af37]" /> Stanton, Arizona
            </span>
            <span className="inline-flex items-center gap-2 rounded-lg bg-[#0f0a06]/70 border border-[#d4af37]/25 px-3 py-2">
              <Users className="w-4 h-4 text-[#d4af37]" /> Limited to {DETECTOR_ACADEMY_CAPACITY}
            </span>
          </div>
          <div className="mt-8">
            <a
              href="#register"
              className="inline-flex justify-center items-center gap-2 px-8 py-4 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors text-lg"
            >
              Register · ${DETECTOR_ACADEMY_PRICE}
            </a>
          </div>
        </div>
      </section>

      {promoOpen && (
        <section className="border-y border-[#d4af37]/25 bg-[#0f0a06]/80">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 text-center text-sm text-[#e8e0d5]/80">
            New to LDMA? The Axiom Lite lifetime bundle includes free academy registration through{" "}
            {ACADEMY_PROMO_DEADLINE_LABEL}.{" "}
            <a href="#register" className="text-[#d4af37] underline underline-offset-4 hover:text-[#f0d48f]">
              See both options
            </a>
            {" · "}
            <Link href={BUNDLE_HREF} className="text-[#d4af37] underline underline-offset-4 hover:text-[#f0d48f]">
              Bundle details
            </Link>
          </div>
        </section>
      )}

      {/* Who it's for */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <SectionHeading
          eyebrow="Who it's for"
          title="Whether you're new to the coil or sharpening an old habit"
          intro="Bring any detector. You'll train hardest on Garrett Axiom / Axiom Lite and GoldMaster 24k platforms, and the fundamentals come home with you."
        />
        <div className="grid gap-6 md:grid-cols-3">
          {DETECTOR_ACADEMY_WHO_FOR.map((item) => (
            <div key={item.title} className="border-t border-[#d4af37]/35 pt-5">
              <h3 className="font-serif text-xl text-[#f0d48f] font-semibold mb-2">{item.title}</h3>
              <p className="text-sm text-[#e8e0d5]/80 leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Proof */}
      <section className="bg-[#0f3d1e]/25 border-y border-[#d4af37]/15">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 grid gap-10 lg:grid-cols-2 items-center">
          <div>
            <SectionHeading
              eyebrow="Why this week"
              title="Real claim ground. Not a parking-lot demo."
            />
            <ul className="space-y-5">
              {DETECTOR_ACADEMY_PROOF.map((item) => (
                <li key={item.title}>
                  <p className="font-semibold text-[#f0d48f] mb-1">{item.title}</p>
                  <p className="text-sm text-[#e8e0d5]/80 leading-relaxed">{item.body}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden border border-[#d4af37]/25">
            <Image
              src="/images/campgrounds/stanton-arizona/stanton-4.jpg"
              alt="LDMA members showing their gold outside Hotel Stanton"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
        </div>
      </section>

      {/* What you'll learn */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <SectionHeading
          eyebrow="The training"
          title="PI and VLF on real dirt. Then dig what you hear."
          intro="Mornings in the classroom and test garden. Afternoons on Stanton claims with a coach in your group."
        />
        <div className="grid gap-6 md:grid-cols-3">
          {DETECTOR_ACADEMY_LEARNING.map((item, i) => (
            <div key={item.title} className="overflow-hidden border border-[#d4af37]/20 bg-[#0f0a06]/60 flex flex-col">
              <div className="relative h-44 shrink-0 bg-[#0f3d1e]/30">
                <Image
                  src={LEARNING_IMAGES[i].src}
                  alt={LEARNING_IMAGES[i].alt}
                  fill
                  className={LEARNING_IMAGES[i].fit}
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              </div>
              <div className="p-6">
                <h3 className="font-serif text-xl text-[#f0d48f] font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-[#e8e0d5]/80 leading-relaxed">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
        <ul className="mt-10 grid gap-3 sm:grid-cols-2 max-w-3xl">
          {DETECTOR_ACADEMY_GAINS.map((g) => (
            <li key={g} className="flex gap-3 text-sm text-[#e8e0d5]/85">
              <Check className="w-5 h-5 text-[#d4af37] shrink-0" />
              <span>{g}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* How the week works */}
      <section className="bg-[#0f0a06]/60 border-y border-[#d4af37]/15">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <SectionHeading
            eyebrow="How the week works"
            title="Six breakouts, groups of about 25"
            intro={DETECTOR_ACADEMY_WEEK_INTRO}
          />
          <div className="grid gap-8">
            {DETECTOR_ACADEMY_WEEK_OVERVIEW.map((block) => (
              <div key={block.label} className="border border-[#d4af37]/20 bg-[#1a120b]/80 p-6 md:p-8">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#d4af37]">{block.label}</p>
                  <h3 className="font-serif text-2xl text-[#f0d48f] font-semibold">{block.title}</h3>
                </div>
                <p className="text-[#e8e0d5]/85 leading-relaxed mb-6 max-w-3xl">{block.summary}</p>
                <ul
                  className={`grid gap-4 ${
                    block.sessions.length >= 4
                      ? "sm:grid-cols-2 lg:grid-cols-4"
                      : block.sessions.length === 2
                        ? "sm:grid-cols-2"
                        : "sm:grid-cols-1 max-w-xl"
                  }`}
                >
                  {block.sessions.map((session) => (
                    <li key={session.title} className="border border-[#d4af37]/15 bg-[#0f0a06]/60 p-4">
                      <p className="font-semibold text-[#f0d48f] mb-1">{session.title}</p>
                      <p className="text-xs uppercase tracking-[0.15em] text-[#d4af37]/90 mb-2">{session.where}</p>
                      <p className="text-sm text-[#e8e0d5]/75 leading-relaxed">{session.detail}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-[#e8e0d5]/55 flex items-start gap-2">
            <Clock className="w-4 h-4 text-[#d4af37] shrink-0 mt-0.5" />
            Exact session times are in your welcome packet at check-in.
          </p>
        </div>
      </section>

      {/* Trainers */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <SectionHeading eyebrow="Your trainers" title="The people beside you this week" intro={DETECTOR_ACADEMY_TRAINERS_INTRO} />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {DETECTOR_ACADEMY_TRAINERS.map((t) => (
            <div key={t.name} className="border border-[#d4af37]/20 bg-[#0f0a06]/60 p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="relative w-20 h-20 rounded-full overflow-hidden bg-[#0f3d1e] border-2 border-[#d4af37]/50 flex items-center justify-center font-serif text-xl text-[#f0d48f] shrink-0">
                  {t.photo ? (
                    <Image src={t.photo} alt={t.name} fill className="object-cover" sizes="80px" />
                  ) : (
                    initials(t.name)
                  )}
                </div>
                <div>
                  <h3 className="font-serif text-xl text-[#f0d48f] font-semibold">{t.name}</h3>
                  <p className="text-xs uppercase tracking-[0.15em] text-[#d4af37] mt-1">{t.role}</p>
                </div>
              </div>
              <p className="text-sm text-[#e8e0d5]/80 leading-relaxed">{t.bio}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bring your detector + good to know */}
      <section className="bg-[#0f0a06]/60 border-y border-[#d4af37]/15">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 grid gap-6 lg:grid-cols-2">
          <div className="border border-[#d4af37]/25 bg-[#0f3d1e]/30 p-7">
            <h2 className="font-serif text-2xl text-[#f0d48f] font-semibold mb-3">Bring your detector</h2>
            <p className="text-[#e8e0d5]/85 leading-relaxed">
              Bring your own machine so you go home with it dialed in. Sessions center on the Garrett Axiom, Axiom Lite,
              and GoldMaster 24k. The same habits apply to any detector. Pack headphones, a pinpointer, a digging tool,
              and layers for cool mornings.
            </p>
          </div>
          <div className="border border-[#d4af37]/25 bg-[#1a120b]/80 p-7">
            <h2 className="font-serif text-2xl text-[#f0d48f] font-semibold mb-3">Good to know</h2>
            <ul className="space-y-3 text-sm text-[#e8e0d5]/85">
              <li className="flex gap-3">
                <Calendar className="w-4 h-4 text-[#d4af37] shrink-0 mt-0.5" />
                {DETECTOR_ACADEMY_DATES_NOTE
                  ? `${DETECTOR_ACADEMY_DATES_LABEL}. ${DETECTOR_ACADEMY_DATES_NOTE}.`
                  : DETECTOR_ACADEMY_DATES_LABEL}
              </li>
              <li className="flex gap-3">
                <MapPin className="w-4 h-4 text-[#d4af37] shrink-0 mt-0.5" /> {DETECTOR_ACADEMY_LOCATION}
              </li>
              <li className="flex gap-3">
                <Tent className="w-4 h-4 text-[#d4af37] shrink-0 mt-0.5" />
                <span>
                  Camping and meals aren&apos;t included.{" "}
                  <Link href="/campgrounds/stanton-arizona" className="text-[#d4af37] underline">
                    Reserve your Stanton campsite
                  </Link>{" "}
                  separately.
                </span>
              </li>
              <li className="flex gap-3">
                <Users className="w-4 h-4 text-[#d4af37] shrink-0 mt-0.5" /> Every participant, member or not, hunts
                Stanton claims with trainers during scheduled sessions.
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Register: $800 primary, bundle secondary */}
      <section id="register" className="scroll-mt-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <SectionHeading
            eyebrow="Save your spot"
            title="Register for the academy"
            intro={`${DETECTOR_ACADEMY_PRICE_FRAME} Only ${DETECTOR_ACADEMY_CAPACITY} seats.`}
          />
          <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
            <RegistrationCard
              event={event}
              isMemberLoggedIn={isMemberLoggedIn}
              onInterested={() => setInterestOpen(true)}
              onApplyDiscount={() => setDiscountOpen(true)}
            />
            <BundleCard promoOpen={promoOpen} />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-20">
        <SectionHeading eyebrow="Questions" title="Frequently asked" />
        <div className="space-y-3">
          {DETECTOR_ACADEMY_FAQ.map((f, i) => (
            <div key={f.q} className="border border-[#d4af37]/20 bg-[#0f0a06]/60">
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 p-5 text-left"
                aria-expanded={openFaq === i}
              >
                <span className="font-medium text-[#f0d48f]">{f.q}</span>
                <ChevronDown
                  className={`w-5 h-5 text-[#d4af37] transition-transform ${openFaq === i ? "rotate-180" : ""}`}
                />
              </button>
              {openFaq === i && <p className="px-5 pb-5 -mt-1 text-sm text-[#e8e0d5]/80 leading-relaxed">{f.a}</p>}
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-[#e8e0d5]/70">
          More questions? Call Member Services at{" "}
          <a href="tel:+18884653717" className="text-[#d4af37] underline">
            (888) 465-3717
          </a>
          .
        </p>
        <p className="mt-6 text-center text-xs text-[#e8e0d5]/45">{GARRETT_TRADEMARK_NOTICE}</p>
      </section>

      <InterestQuestionnaire open={interestOpen} onClose={() => setInterestOpen(false)} />
      <DiscountQuestionnaire open={discountOpen} onClose={() => setDiscountOpen(false)} />
    </div>
  );
}
