import Link from "next/link";
import { focusRing } from "@/components/trainers/format";

export default function TrainerNotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d4af37]">Trainers</p>
      <h1 className="mt-3 font-serif text-4xl font-bold text-[#f0d48f] text-balance">
        This trainer profile is unavailable
      </h1>
      <p className="mt-4 text-base leading-relaxed text-[#e8e0d5]/80">
        It may be unpublished, or the address may have changed. The directory lists everyone who is
        currently public.
      </p>
      <Link
        href="/trainers"
        className={`mt-8 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#d4af37] px-6 font-semibold text-[#1a120b] transition-colors hover:bg-[#f0d48f] ${focusRing}`}
      >
        Back to trainers
      </Link>
    </div>
  );
}
