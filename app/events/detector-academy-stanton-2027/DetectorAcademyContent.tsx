"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bell, Calendar, Check, ChevronDown, Clock, MapPin, Tent, Users } from "lucide-react";
import {
  ACADEMY_PROMO_DEADLINE_LABEL,
  DETECTOR_ACADEMY_CAPACITY,
  DETECTOR_ACADEMY_DATES_LABEL,
  DETECTOR_ACADEMY_DATES_NOTE,
  DETECTOR_ACADEMY_DEPOSIT,
  DETECTOR_ACADEMY_FAQ,
  DETECTOR_ACADEMY_GAINS,
  DETECTOR_ACADEMY_INCLUDED,
  DETECTOR_ACADEMY_LEARNING,
  DETECTOR_ACADEMY_LOCATION,
  DETECTOR_ACADEMY_NAME,
  DETECTOR_ACADEMY_PRICE,
  DETECTOR_ACADEMY_RESERVATION_PATH,
  DETECTOR_ACADEMY_SCHEDULE,
  DETECTOR_ACADEMY_TRAINERS,
  GARRETT_TRADEMARK_NOTICE,
  isAcademyPromoOpen,
} from "@/lib/detector-academy";
import { InterestQuestionnaire } from "./InterestQuestionnaire";

const BUNDLE_HREF = "/memberships#bundle-offer";

const LEARNING_IMAGES = [
  { src: "/images/memberships/axiom-lite-bundle-hero.jpg", alt: "Garrett Axiom Lite from the LDMA Lifetime Bundle", fit: "object-cover object-[35%_center]" },
  { src: "/images/flyers/goldmaster24k-img1.png", alt: "Garrett GoldMaster 24k detector", fit: "object-contain bg-white p-3" },
  { src: "/images/email/events-education/nugget-in-hand.jpg", alt: "Gold nugget found on desert ground", fit: "object-cover" },
  { src: "/images/email/events-education/real-gold.jpg", alt: "Gold recovered at an LDMA camp", fit: "object-cover" },
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

function RegistrationCard({ onInterested }: { onInterested: () => void }) {
  return (
    <div className="rounded-2xl border border-[#d4af37]/30 bg-[#0f0a06]/80 p-6 md:p-8 flex flex-col">
      <p className="text-xs uppercase tracking-[0.18em] text-[#d4af37] mb-2">Registration</p>
      <h3 className="font-serif text-2xl text-[#f0d48f] font-semibold mb-2">${DETECTOR_ACADEMY_PRICE} per participant</h3>
      <p className="text-sm text-[#e8e0d5]/75 mb-4">
        Open to LDMA members and the public. Registration opens once the dates are set. Camping is booked separately.
      </p>
      <ul className="grid gap-2 sm:grid-cols-2 text-sm text-[#e8e0d5]/85 mb-6">
        {DETECTOR_ACADEMY_INCLUDED.map((item) => (
          <li key={item} className="flex gap-2">
            <Check className="w-4 h-4 text-[#d4af37] shrink-0 mt-0.5" />
            {item}
          </li>
        ))}
      </ul>
      <div className="mt-auto rounded-xl border border-[#d4af37]/25 bg-[#d4af37]/10 p-5 space-y-3">
        <p className="text-sm text-[#e8e0d5]/85">
          Tell us a little about yourself and a member of our team will reach out with the dates and answer your
          questions.
        </p>
        <button
          type="button"
          onClick={onInterested}
          className="w-full inline-flex justify-center items-center gap-2 px-6 py-3 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors"
        >
          <Bell className="w-4 h-4" /> I&apos;m interested in this event
        </button>
      </div>
    </div>
  );
}

function BundleCard({ promoOpen }: { promoOpen: boolean }) {
  return (
    <div className="relative rounded-2xl border-2 border-[#d4af37] bg-gradient-to-br from-[#0f3d1e]/70 via-[#1a120b] to-[#1a120b] p-6 md:p-8 flex flex-col overflow-hidden">
      <span className="self-start mb-3 sm:mb-0 sm:absolute sm:top-4 sm:right-4 rounded-full bg-[#d4af37] text-[#1a120b] text-xs font-bold px-3 py-1">
        Best value
      </span>
      <p className="text-xs uppercase tracking-[0.18em] text-[#d4af37] mb-2">New members</p>
      <h3 className="font-serif text-2xl text-[#f0d48f] font-semibold mb-2 sm:pr-24">Join with the Axiom Lite bundle and attend free</h3>
      <p className="text-sm text-[#e8e0d5]/80 mb-4">
        Join LDMA with the Garrett Axiom Lite bundle by {ACADEMY_PROMO_DEADLINE_LABEL}, and your academy registration is
        free. The bundle includes lifetime LDMA and GPAA membership, the Family Legacy benefits, and your own Garrett
        Axiom Lite to train on.
      </p>
      <ul className="space-y-2 text-sm text-[#e8e0d5]/85 mb-6">
        <li className="flex gap-2">
          <Check className="w-4 h-4 text-[#d4af37] shrink-0 mt-0.5" />
          Reserve your spot now with a ${DETECTOR_ACADEMY_DEPOSIT} non-refundable deposit, before registration opens
        </li>
        <li className="flex gap-2">
          <Check className="w-4 h-4 text-[#d4af37] shrink-0 mt-0.5" />
          When you attend, the ${DETECTOR_ACADEMY_DEPOSIT} comes back to you as Stanton camp credit for site fees or other
          camp purchases
        </li>
        <li className="flex gap-2">
          <Check className="w-4 h-4 text-[#d4af37] shrink-0 mt-0.5" />
          Can&apos;t make the dates once they&apos;re announced? Your ${DETECTOR_ACADEMY_DEPOSIT} becomes Stanton camp
          credit instead
        </li>
      </ul>
      <div className="mt-auto flex flex-col gap-3">
        {promoOpen ? (
          <>
            <Link
              href={BUNDLE_HREF}
              className="inline-flex justify-center items-center px-6 py-3.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors"
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

export function DetectorAcademyContent() {
  const promoOpen = isAcademyPromoOpen();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [interestOpen, setInterestOpen] = useState(false);

  return (
    <div className="text-[#e8e0d5]">
      {/* Hero */}
      <section className="relative min-h-[78vh] flex items-end overflow-hidden">
        <Image
          src="/images/about-events/detector-events.jpg"
          alt="Detectorists at an LDMA desert detecting event"
          fill
          priority
          className="object-cover object-[center_75%]"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a120b] via-[#1a120b]/70 to-[#1a120b]/20" />
        <div className="relative max-w-6xl mx-auto w-full px-4 sm:px-6 pb-14 md:pb-20 pt-32">
          <p className="inline-flex rounded-full border border-[#d4af37]/40 bg-[#0f0a06]/70 backdrop-blur px-4 py-2 mb-6 text-xs uppercase tracking-[0.18em] text-[#e8e0d5]/85">
            Hands-on Garrett detector training
          </p>
          <h1 className="font-serif text-5xl md:text-7xl font-bold text-[#f0d48f] leading-[1.05] max-w-4xl">
            {DETECTOR_ACADEMY_NAME}
          </h1>
          <p className="mt-5 text-lg md:text-2xl text-[#e8e0d5]/90 max-w-3xl leading-relaxed">
            Four days of metal detecting training on Arizona gold ground, built around the Garrett Axiom, Axiom Lite, and
            GoldMaster 24k and taught by LDMA&apos;s field team.
          </p>
          <div className="mt-7 flex flex-wrap gap-3 text-sm">
            <span className="inline-flex items-center gap-2 rounded-lg bg-[#0f0a06]/70 border border-[#d4af37]/25 px-3 py-2">
              <Calendar className="w-4 h-4 text-[#d4af37]" /> {DETECTOR_ACADEMY_DATES_LABEL} · {DETECTOR_ACADEMY_DATES_NOTE.toLowerCase()}
            </span>
            <span className="inline-flex items-center gap-2 rounded-lg bg-[#0f0a06]/70 border border-[#d4af37]/25 px-3 py-2">
              <MapPin className="w-4 h-4 text-[#d4af37]" /> Stanton, Arizona
            </span>
            <span className="inline-flex items-center gap-2 rounded-lg bg-[#0f0a06]/70 border border-[#d4af37]/25 px-3 py-2">
              <Users className="w-4 h-4 text-[#d4af37]" /> Limited to {DETECTOR_ACADEMY_CAPACITY} participants
            </span>
          </div>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => setInterestOpen(true)}
              className="inline-flex justify-center items-center gap-2 px-7 py-4 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors text-lg"
            >
              <Bell className="w-5 h-5" /> I&apos;m interested
            </button>
            {promoOpen && (
              <Link
                href={BUNDLE_HREF}
                className="inline-flex justify-center items-center px-7 py-4 border-2 border-[#d4af37] text-[#f0d48f] font-semibold rounded-lg hover:bg-[#d4af37]/10 transition-colors text-lg"
              >
                Attend free with the Axiom Lite bundle
              </Link>
            )}
          </div>
        </div>
      </section>

      {promoOpen && (
        <section className="border-y border-[#d4af37]/30 bg-[#d4af37]/10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 text-center text-sm md:text-base">
            <strong className="text-[#f0d48f]">New members:</strong> join LDMA with the Garrett Axiom Lite bundle by{" "}
            {ACADEMY_PROMO_DEADLINE_LABEL}, and your academy registration is free.{" "}
            <Link href={BUNDLE_HREF} className="text-[#d4af37] underline underline-offset-4 hover:text-[#f0d48f]">
              See the bundle
            </Link>
          </div>
        </section>
      )}

      {/* What you'll learn */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <SectionHeading
          eyebrow="The training"
          title="Learn three Garrett gold detectors, then put them to work"
          intro="Mornings are for the classroom and the test garden. Afternoons are for hunting Stanton's claims with a trainer nearby."
        />
        <div className="grid gap-6 md:grid-cols-2">
          {DETECTOR_ACADEMY_LEARNING.map((item, i) => (
            <div key={item.title} className="rounded-2xl overflow-hidden border border-[#d4af37]/20 bg-[#0f0a06]/60 flex flex-col sm:flex-row">
              <div className="relative sm:w-44 h-44 sm:h-auto shrink-0 bg-[#0f3d1e]/30">
                <Image
                  src={LEARNING_IMAGES[i].src}
                  alt={LEARNING_IMAGES[i].alt}
                  fill
                  className={LEARNING_IMAGES[i].fit}
                  sizes="(max-width: 640px) 100vw, 176px"
                />
              </div>
              <div className="p-6">
                <h3 className="font-serif text-xl text-[#f0d48f] font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-[#e8e0d5]/80 leading-relaxed">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* What you'll gain */}
      <section className="bg-[#0f3d1e]/25 border-y border-[#d4af37]/15">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 grid gap-10 lg:grid-cols-2 items-center">
          <div>
            <SectionHeading eyebrow="What you'll take home" title="Go home knowing your detector" />
            <ul className="grid gap-3 sm:grid-cols-2">
              {DETECTOR_ACADEMY_GAINS.map((g) => (
                <li key={g} className="flex gap-3 rounded-xl bg-[#0f0a06]/60 border border-[#d4af37]/15 p-4 text-sm">
                  <Check className="w-5 h-5 text-[#d4af37] shrink-0" />
                  <span>{g}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-[#d4af37]/25">
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

      {/* Schedule */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <SectionHeading
          eyebrow="Daily schedule"
          title="The four-day schedule"
          intro="All times are Arizona time. Early March mornings at Stanton are cool, so bring layers."
        />
        <div className="grid gap-6 lg:grid-cols-2">
          {DETECTOR_ACADEMY_SCHEDULE.map((day) => (
            <div key={day.day} className="rounded-2xl border border-[#d4af37]/20 bg-[#0f0a06]/60 p-6">
              <p className="text-xs uppercase tracking-[0.18em] text-[#d4af37] mb-1">{day.day}</p>
              <h3 className="font-serif text-xl text-[#f0d48f] font-semibold mb-4">{day.theme}</h3>
              <ol className="space-y-3">
                {day.sessions.map((s) => (
                  <li key={`${s.time}-${s.title}`} className="grid gap-1 sm:grid-cols-[9rem_1fr] sm:gap-3 text-sm">
                    <span className="inline-flex items-start gap-1.5 text-[#e8e0d5]/60">
                      <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      {s.time}
                    </span>
                    <span>
                      <span className="font-medium text-[#e8e0d5]">{s.title}</span>
                      {s.detail ? <span className="block text-[#e8e0d5]/70 mt-0.5">{s.detail}</span> : null}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      {/* Trainers */}
      <section className="bg-[#0f0a06]/60 border-y border-[#d4af37]/15">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <SectionHeading
            eyebrow="Your trainers"
            title="Meet your trainers"
            intro="LDMA's field team leads every session, from the classroom to one-on-one tuning out on the claims."
          />
          <div className="grid gap-6 md:grid-cols-3">
            {DETECTOR_ACADEMY_TRAINERS.map((t) => (
              <div key={t.name} className="rounded-2xl border border-[#d4af37]/20 bg-[#1a120b] p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative w-20 h-20 rounded-full overflow-hidden bg-[#0f3d1e] border-2 border-[#d4af37]/50 flex items-center justify-center font-serif text-xl text-[#f0d48f] shrink-0">
                {t.photo ? <Image src={t.photo} alt={t.name} fill className="object-cover" sizes="80px" /> : initials(t.name)}
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
        </div>
      </section>

      {/* Bring your detector + good to know */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#d4af37]/25 bg-[#0f3d1e]/30 p-7">
          <h2 className="font-serif text-2xl text-[#f0d48f] font-semibold mb-3">Bring your detector</h2>
          <p className="text-[#e8e0d5]/85 leading-relaxed">
            Bring your own detector so you go home with it dialed in for your ground. Sessions center on the Garrett
            Axiom, Axiom Lite, and GoldMaster 24k, and the fundamentals apply to any detector. Also pack headphones, a
            pinpointer, a digging tool, and layers for cool mornings.
          </p>
        </div>
        <div className="rounded-2xl border border-[#d4af37]/25 bg-[#0f0a06]/60 p-7">
          <h2 className="font-serif text-2xl text-[#f0d48f] font-semibold mb-3">Good to know</h2>
          <ul className="space-y-3 text-sm text-[#e8e0d5]/85">
            <li className="flex gap-3">
              <Calendar className="w-4 h-4 text-[#d4af37] shrink-0 mt-0.5" /> {DETECTOR_ACADEMY_DATES_LABEL}.{" "}
              {DETECTOR_ACADEMY_DATES_NOTE}.
            </li>
            <li className="flex gap-3">
              <MapPin className="w-4 h-4 text-[#d4af37] shrink-0 mt-0.5" /> {DETECTOR_ACADEMY_LOCATION}
            </li>
            <li className="flex gap-3">
              <Tent className="w-4 h-4 text-[#d4af37] shrink-0 mt-0.5" />
              <span>
                Camping isn&apos;t included.{" "}
                <Link href="/campgrounds/stanton-arizona" className="text-[#d4af37] underline">
                  Reserve your Stanton campsite
                </Link>{" "}
                separately.
              </span>
            </li>
            <li className="flex gap-3">
              <Users className="w-4 h-4 text-[#d4af37] shrink-0 mt-0.5" /> Every participant, member or not, hunts Stanton
              claims with trainers during scheduled sessions.
            </li>
          </ul>
        </div>
      </section>

      {/* Register */}
      <section id="register" className="scroll-mt-24 bg-[#0f0a06]/70 border-y border-[#d4af37]/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <SectionHeading
            eyebrow="Save your spot"
            title="Two ways to get in"
            intro={`New members can reserve a free spot now. Everyone else, let us know you're interested and we'll be in touch with the dates. The academy is limited to ${DETECTOR_ACADEMY_CAPACITY} participants.`}
          />
          <div className="grid gap-6 lg:grid-cols-2">
            <BundleCard promoOpen={promoOpen} />
            <RegistrationCard onInterested={() => setInterestOpen(true)} />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-20">
        <SectionHeading eyebrow="Questions" title="Frequently asked" />
        <div className="space-y-3">
          {DETECTOR_ACADEMY_FAQ.map((f, i) => (
            <div key={f.q} className="rounded-xl border border-[#d4af37]/20 bg-[#0f0a06]/60">
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 p-5 text-left"
                aria-expanded={openFaq === i}
              >
                <span className="font-medium text-[#f0d48f]">{f.q}</span>
                <ChevronDown className={`w-5 h-5 text-[#d4af37] transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
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
    </div>
  );
}
