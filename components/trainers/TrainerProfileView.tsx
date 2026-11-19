import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { TrainerDetail } from "@/lib/trainers-types";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { RichText } from "./RichText";
import { TrainerAvatar } from "./TrainerAvatar";
import { TrainerContactCard, hasTrainerContact } from "./TrainerContactCard";
import { TrainerEvents } from "./TrainerEvents";
import {
  absoluteAssetUrl,
  focusRing,
  isEmptyTrainerHtml,
  nonEmpty,
  publicSiteOrigin,
  trainerFirstName,
  visibleEvents,
} from "./format";

export type TrainerNeighbor = {
  slug: string;
  name: string;
};

function personJsonLd(trainer: TrainerDetail, origin: string) {
  const photo = nonEmpty(trainer.photoUrl);
  const summary = nonEmpty(trainer.summary);
  const title = nonEmpty(trainer.title);
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: trainer.name,
    url: `${origin}/trainers/${trainer.slug}`,
  };
  if (title) data.jobTitle = title;
  if (summary) data.description = summary;
  if (photo) data.image = absoluteAssetUrl(origin, photo);
  return data;
}

export function TrainerProfileView({
  trainer,
  previous = null,
  next = null,
}: {
  trainer: TrainerDetail;
  previous?: TrainerNeighbor | null;
  next?: TrainerNeighbor | null;
}) {
  const origin = publicSiteOrigin();
  const title = nonEmpty(trainer.title);
  const summary = nonEmpty(trainer.summary);
  const photo = nonEmpty(trainer.photoUrl);
  const firstName = trainerFirstName(trainer.name);
  const events = visibleEvents(trainer.events);
  const showContact = hasTrainerContact(trainer.contact);
  const showAside = events.length > 0 || showContact;
  const bioEmpty = isEmptyTrainerHtml(trainer.bodyHtml);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(personJsonLd(trainer, origin)).replace(/</g, "\\u003c"),
        }}
      />
      <div className="pt-2">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Trainers", href: "/trainers" },
            { label: trainer.name },
          ]}
          baseUrl={origin}
        />
      </div>

      <article>
        <header className="flex flex-col gap-8 border-b border-[#d4af37]/15 pb-10 md:flex-row md:items-center">
          <TrainerAvatar
            name={trainer.name}
            photoUrl={trainer.photoUrl}
            alt={photo ? `Portrait of ${trainer.name}` : ""}
            sizes="(max-width: 768px) 80vw, 288px"
            priority
            frame="profile"
          />
          <div className="min-w-0 flex-1 text-center md:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d4af37]">
              LDMA Certified Trainer
            </p>
            <h1 className="mt-3 font-serif text-4xl font-bold tracking-tight text-[#f0d48f] text-balance sm:text-5xl">
              {trainer.name}
            </h1>
            {title ? <p className="mt-3 text-lg leading-snug text-[#e8e0d5]/90">{title}</p> : null}
            {summary ? (
              <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[#e8e0d5]/80 md:mx-0">
                {summary}
              </p>
            ) : null}
          </div>
        </header>

        <div
          className={
            showAside
              ? "mt-10 grid items-start gap-10 lg:mt-12 lg:grid-cols-[minmax(0,1fr)_20.5rem] lg:gap-12"
              : "mt-10 lg:mt-12"
          }
        >
          <div className="min-w-0">
            {bioEmpty ? (
              <p className="text-base leading-relaxed text-[#e8e0d5]/75">
                A full biography for {firstName} is on the way.
              </p>
            ) : (
              <RichText html={trainer.bodyHtml} />
            )}
          </div>
          {showAside ? (
            <aside className="min-w-0 space-y-5" aria-label={`${trainer.name} events and contact`}>
              <TrainerEvents firstName={firstName} events={events} />
              {showContact ? <TrainerContactCard contact={trainer.contact} /> : null}
            </aside>
          ) : null}
        </div>

        {previous || next ? (
          <nav aria-label="Other trainers" className="mt-16 grid gap-4 border-t border-[#d4af37]/15 pt-8 sm:grid-cols-2">
            {previous ? (
              <Link
                href={`/trainers/${encodeURIComponent(previous.slug)}`}
                className={`group rounded-xl border border-[#d4af37]/20 bg-[#0f0a06]/60 p-4 transition-colors hover:border-[#d4af37]/45 ${focusRing}`}
              >
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#d4af37]">
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                  Previous
                </span>
                <span className="mt-1 block font-serif text-xl text-[#f0d48f] transition-colors group-hover:text-[#d4af37]">
                  {previous.name}
                </span>
              </Link>
            ) : (
              <span className="hidden sm:block" aria-hidden />
            )}
            {next ? (
              <Link
                href={`/trainers/${encodeURIComponent(next.slug)}`}
                className={`group rounded-xl border border-[#d4af37]/20 bg-[#0f0a06]/60 p-4 transition-colors hover:border-[#d4af37]/45 sm:text-right ${focusRing}`}
              >
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#d4af37] sm:justify-end">
                  Next
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </span>
                <span className="mt-1 block font-serif text-xl text-[#f0d48f] transition-colors group-hover:text-[#d4af37]">
                  {next.name}
                </span>
              </Link>
            ) : null}
          </nav>
        ) : null}
      </article>
    </div>
  );
}
