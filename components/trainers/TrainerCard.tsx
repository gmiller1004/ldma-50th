import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { TrainerProfile } from "@/lib/trainers-types";
import { TrainerAvatar } from "./TrainerAvatar";
import { focusRing, nonEmpty } from "./format";

export function TrainerCard({ trainer }: { trainer: TrainerProfile }) {
  const title = nonEmpty(trainer.title);
  const summary = nonEmpty(trainer.summary);
  const href = `/trainers/${encodeURIComponent(trainer.slug)}`;

  return (
    <article className="h-full w-full">
      <Link
        href={href}
        className={`group flex h-full flex-col overflow-hidden rounded-2xl border border-[#d4af37]/20 bg-[#0f0a06]/80 transition-colors hover:border-[#d4af37]/50 ${focusRing}`}
      >
        <TrainerAvatar
          name={trainer.name}
          photoUrl={trainer.photoUrl}
          alt=""
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 360px"
          imageClassName="object-cover object-top motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-[1.04]"
        />
        <div className="flex flex-1 flex-col p-5">
          <h2 className="font-serif text-2xl font-semibold leading-tight text-[#f0d48f] text-balance transition-colors group-hover:text-[#d4af37] line-clamp-2">
            {trainer.name}
          </h2>
          {title ? (
            <p className="mt-2 text-sm font-medium leading-snug text-[#d4af37] line-clamp-3">{title}</p>
          ) : null}
          {summary ? (
            <p className="mt-3 text-sm leading-relaxed text-[#e8e0d5]/80 line-clamp-3">{summary}</p>
          ) : null}
          <span className="mt-auto inline-flex min-h-11 items-center gap-1.5 pt-4 text-sm font-semibold text-[#f0d48f]">
            View profile
            <ArrowRight className="h-4 w-4 transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden />
          </span>
        </div>
      </Link>
    </article>
  );
}
