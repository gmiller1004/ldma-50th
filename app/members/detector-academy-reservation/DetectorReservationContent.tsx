"use client";

import Link from "next/link";
import { CheckCircle2, Phone } from "lucide-react";
import { AddToCartButton } from "@/components/AddToCartButton";
import {
  DETECTOR_ACADEMY_DATES_LABEL,
  DETECTOR_ACADEMY_DEPOSIT,
  DETECTOR_ACADEMY_NAME,
  DETECTOR_ACADEMY_PATH,
  ACADEMY_PROMO_DEADLINE_LABEL,
} from "@/lib/detector-academy";

export type ReservationView =
  | { state: "eligible"; variantId: string }
  | { state: "already_reserved" }
  | { state: "no_bundle_order" }
  | { state: "not_open_yet" }
  | { state: "sold_out" }
  | { state: "lookup_failed" }
  | { state: "no_email" };

function CallLine() {
  return (
    <a href="tel:+18884653717" className="inline-flex items-center gap-2 text-sm text-[#d4af37] hover:text-[#f0d48f]">
      <Phone className="w-4 h-4" /> Call Member Services at (888) 465-3717
    </a>
  );
}

const MESSAGES: Record<Exclude<ReservationView["state"], "eligible" | "already_reserved">, { title: string; body: string }> = {
  no_bundle_order: {
    title: "We couldn't find a qualifying bundle purchase",
    body: `Free academy registration is for members who join with the LDMA Lifetime Bundle — Garrett Axiom Lite by ${ACADEMY_PROMO_DEADLINE_LABEL}. If you bought the bundle with a different email address, call us and we'll set up your reservation.`,
  },
  not_open_yet: {
    title: "Reservations open soon",
    body: "Your Axiom Lite bundle purchase qualifies you. Academy reservations aren't open yet. Check back shortly.",
  },
  sold_out: {
    title: "The academy is full",
    body: "All spots have been reserved. Call us to join the waitlist.",
  },
  lookup_failed: {
    title: "We couldn't check your purchase right now",
    body: "Please try again in a few minutes, or call us and we'll help you reserve your spot.",
  },
  no_email: {
    title: "We need an email on your membership",
    body: "Your member record doesn't have an email address. Call us and we'll update it and reserve your spot.",
  },
};

export function DetectorReservationContent({ firstName, view }: { firstName: string; view: ReservationView }) {
  return (
    <section className="rounded-xl bg-[#0f3d1e]/40 border border-[#d4af37]/30 p-6 sm:p-8 max-w-2xl">
      <p className="text-xs uppercase tracking-[0.18em] text-[#d4af37] mb-2">
        {DETECTOR_ACADEMY_NAME} · {DETECTOR_ACADEMY_DATES_LABEL}
      </p>

      {view.state === "eligible" ? (
        <>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#f0d48f] mb-3">
            {firstName ? `${firstName}, your` : "Your"} free spot is waiting
          </h1>
          <p className="text-[#e8e0d5]/90 mb-4">
            Thanks for joining with the Axiom Lite bundle. Your academy registration is free. Reserve your spot with a $
            {DETECTOR_ACADEMY_DEPOSIT} non-refundable deposit.
          </p>
          <ul className="space-y-2 text-sm text-[#e8e0d5]/85 mb-6">
            <li className="flex gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#d4af37] shrink-0 mt-0.5" />
              We&apos;re finalizing the early March dates and will email you as soon as they&apos;re set.
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#d4af37] shrink-0 mt-0.5" />
              When you attend, your ${DETECTOR_ACADEMY_DEPOSIT} comes back as credit at the Stanton camp for site fees or
              other camp purchases.
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#d4af37] shrink-0 mt-0.5" />
              If you can&apos;t make the dates once they&apos;re announced, your ${DETECTOR_ACADEMY_DEPOSIT} becomes Stanton
              camp credit instead.
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#d4af37] shrink-0 mt-0.5" />
              Bring your new Axiom Lite, and go home with it dialed in for your ground.
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#d4af37] shrink-0 mt-0.5" />
              Camping isn&apos;t included. Book your Stanton campsite separately.
            </li>
          </ul>
          <div className="flex flex-wrap items-center gap-4">
            <AddToCartButton
              variantId={view.variantId}
              className="!w-auto px-6"
              label={`Reserve my spot · $${DETECTOR_ACADEMY_DEPOSIT}`}
              addingLabel="Reserving…"
              trackCategory="event"
            />
            <Link href={DETECTOR_ACADEMY_PATH} className="text-sm text-[#d4af37] underline">
              See event details
            </Link>
          </div>
        </>
      ) : view.state === "already_reserved" ? (
        <>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#f0d48f] mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-7 h-7 text-[#d4af37]" /> You&apos;re reserved
          </h1>
          <p className="text-[#e8e0d5]/90 mb-6">
            We have your ${DETECTOR_ACADEMY_DEPOSIT} reservation deposit. See you at Stanton! When you check in, your
            deposit comes back as camp credit.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href={DETECTOR_ACADEMY_PATH} className="px-5 py-2.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f]">
              See event details
            </Link>
            <Link href="/campgrounds/stanton-arizona" className="text-sm text-[#d4af37] underline">
              Reserve your Stanton campsite
            </Link>
          </div>
        </>
      ) : (
        <>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#f0d48f] mb-3">{MESSAGES[view.state].title}</h1>
          <p className="text-[#e8e0d5]/90 mb-6">{MESSAGES[view.state].body}</p>
          <div className="flex flex-wrap items-center gap-4">
            <CallLine />
            <Link href={DETECTOR_ACADEMY_PATH} className="text-sm text-[#d4af37] underline">
              Back to the academy
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
