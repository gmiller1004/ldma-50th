import Link from "next/link";
import { ArrowRight, Calendar, Mail } from "lucide-react";
import type { TrainerProfile } from "@/lib/trainers-types";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { TrainerCard } from "./TrainerCard";
import { focusRing, publicSiteOrigin } from "./format";

const primaryButton = `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#d4af37] px-6 py-3 text-sm font-semibold text-[#1a120b] transition-colors hover:bg-[#f0d48f] ${focusRing}`;

export function TrainersDirectory({ trainers }: { trainers: TrainerProfile[] }) {
  const origin = publicSiteOrigin();
  const countLabel = trainers.length === 1 ? "1 trainer" : `${trainers.length} trainers`;

  return (
    <>
      <div className="mx-auto max-w-6xl px-4 pt-2 sm:px-6">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Trainers" },
          ]}
          baseUrl={origin}
        />
      </div>

      <section className="relative overflow-hidden border-b border-[#d4af37]/15" aria-labelledby="trainers-heading">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0f3d1e]/40 via-transparent to-transparent" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(212,175,55,0.1)_0%,transparent_68%)]" />
        <div className="relative mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 md:py-24">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d4af37] sm:text-sm">
            Hands-on education at LDMA events
          </p>
          <h1
            id="trainers-heading"
            className="mt-4 font-serif text-4xl font-bold tracking-tight text-[#f0d48f] text-balance sm:text-5xl md:text-6xl"
          >
            LDMA Certified Trainers
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[#e8e0d5]/90 sm:text-lg">
            These are the trainers we recruit to lead hands-on classes at LDMA events. They teach metal
            detecting, dry washing, high banking, dredging, and the rest of the work of finding gold, then
            stay on the claims while people practice.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <Link href="/events" className={primaryButton}>
              <Calendar className="h-4 w-4" aria-hidden />
              See upcoming events
            </Link>
            <p className="text-sm text-[#e8e0d5]/70">Open to everyone. No membership needed to take a class.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-16" aria-labelledby="trainer-list-heading">
        {trainers.length === 0 ? (
          <div className="mx-auto max-w-xl rounded-2xl border border-[#d4af37]/25 bg-[#0f0a06]/70 px-6 py-14 text-center">
            <div
              className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-[#d4af37]/50 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.22),#0f3d1e_72%)]"
              aria-hidden
            >
              <span className="font-serif text-3xl font-semibold tracking-wide text-[#f0d48f]">LD</span>
            </div>
            <h2 id="trainer-list-heading" className="mt-6 font-serif text-3xl font-semibold text-[#f0d48f] text-balance">
              Our trainer lineup is coming soon
            </h2>
            <p className="mt-3 text-base leading-relaxed text-[#e8e0d5]/80">
              Profiles appear here once a trainer is published. The event calendar is open in the meantime,
              with hands-on classes at LDMA camps.
            </p>
            <Link href="/events" className={`${primaryButton} mt-8`}>
              Browse upcoming events
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="trainer-list-heading" className="font-serif text-3xl font-semibold text-[#f0d48f] md:text-4xl">
                  {trainers.length === 1 ? "Meet the trainer" : "Meet the trainers"}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#e8e0d5]/75 sm:text-base">
                  Open a profile for the full biography, contact details, and the events they&apos;re teaching.
                </p>
              </div>
              <p className="text-sm font-medium tracking-wide text-[#d4af37]">{countLabel}</p>
            </div>
            <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {trainers.map((trainer) => (
                <li key={trainer.slug} className="flex min-w-0">
                  <TrainerCard trainer={trainer} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="border-t border-[#d4af37]/15 bg-[#0f0a06]/45" aria-labelledby="trainers-next-heading">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-16">
          <h2 id="trainers-next-heading" className="sr-only">
            More ways to get involved
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Link
              href="/events"
              className={`group rounded-2xl border border-[#d4af37]/20 bg-[#1a120b] p-6 transition-colors hover:border-[#d4af37]/45 sm:p-7 ${focusRing}`}
            >
              <Calendar className="h-6 w-6 text-[#d4af37]" aria-hidden />
              <span className="mt-4 block font-serif text-2xl font-semibold text-[#f0d48f] group-hover:text-[#d4af37]">
                Upcoming events
              </span>
              <span className="mt-2 block text-sm leading-relaxed text-[#e8e0d5]/80">
                See the season&apos;s classes and sign up. Trainers teach on site at LDMA camps.
              </span>
              <span className="mt-5 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-[#f0d48f]">
                Browse events
                <ArrowRight className="h-4 w-4" aria-hidden />
              </span>
            </Link>
            <Link
              href="/contact"
              className={`group rounded-2xl border border-[#d4af37]/20 bg-[#1a120b] p-6 transition-colors hover:border-[#d4af37]/45 sm:p-7 ${focusRing}`}
            >
              <Mail className="h-6 w-6 text-[#d4af37]" aria-hidden />
              <span className="mt-4 block font-serif text-2xl font-semibold text-[#f0d48f] text-balance group-hover:text-[#d4af37]">
                Interested in training with us?
              </span>
              <span className="mt-2 block text-sm leading-relaxed text-[#e8e0d5]/80">
                LDMA recruits certified trainers to lead hands-on education at events. Tell us about your
                experience.
              </span>
              <span className="mt-5 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-[#f0d48f]">
                Contact LDMA
                <ArrowRight className="h-4 w-4" aria-hidden />
              </span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
