import Image from "next/image";
import Link from "next/link";
import { Calendar } from "lucide-react";
import type { TrainerEventLink } from "@/lib/trainers-types";
import { focusRing, isOptimizableImage, nonEmpty, visibleEvents } from "./format";

function EventThumb({ event }: { event: TrainerEventLink }) {
  const src = nonEmpty(event.imageUrl);
  return (
    <span className="relative block h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-[#0f3d1e]">
      {src && isOptimizableImage(src) ? (
        <Image src={src} alt="" fill sizes="80px" className="object-cover" />
      ) : src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-[#d4af37]" aria-hidden>
          <Calendar className="h-6 w-6" />
        </span>
      )}
    </span>
  );
}

export function TrainerEvents({
  firstName,
  events,
}: {
  firstName: string;
  events: TrainerEventLink[];
}) {
  const visible = visibleEvents(events);
  if (visible.length === 0) return null;

  return (
    <section aria-labelledby="where-to-find" className="rounded-2xl border border-[#d4af37]/25 bg-[#0f0a06]/70 p-5">
      <h2 id="where-to-find" className="font-serif text-2xl font-semibold text-[#f0d48f] text-balance">
        Where to find {firstName}
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-[#e8e0d5]/70">
        LDMA events on this trainer&apos;s schedule.
      </p>
      <ul className="mt-4 space-y-3">
        {visible.map((event, index) => {
          const handle = nonEmpty(event.handle) ?? "";
          const title = nonEmpty(event.title) ?? "LDMA event";
          const subtitle = nonEmpty(event.subtitle);
          return (
            <li key={`${event.productGid}-${index}`}>
              <Link
                href={`/events/${encodeURIComponent(handle)}`}
                className={`group flex min-h-11 gap-3 rounded-xl border border-[#d4af37]/15 bg-[#1a120b] p-2.5 transition-colors hover:border-[#d4af37]/45 ${focusRing}`}
              >
                <EventThumb event={event} />
                <span className="flex min-w-0 flex-1 flex-col justify-center py-0.5">
                  <span className="font-serif text-base font-semibold leading-snug text-[#f0d48f] line-clamp-2 transition-colors group-hover:text-[#d4af37]">
                    {title}
                  </span>
                  {subtitle ? (
                    <span className="mt-1 text-sm leading-snug text-[#e8e0d5]/70 line-clamp-2">{subtitle}</span>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
