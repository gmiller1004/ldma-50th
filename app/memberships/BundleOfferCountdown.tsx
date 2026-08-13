"use client";

import { useEffect, useState } from "react";
import { BUNDLE_OFFER_EXPIRES_AT_MS } from "@/lib/membership-bundle-config";

type Remaining = {
  days: number;
  hours: number;
  minutes: number;
  expired: boolean;
};

function getRemaining(nowMs: number): Remaining {
  const ms = Math.max(0, BUNDLE_OFFER_EXPIRES_AT_MS - nowMs);
  const totalMinutes = Math.floor(ms / 60_000);
  return {
    days: Math.floor(totalMinutes / (60 * 24)),
    hours: Math.floor((totalMinutes % (60 * 24)) / 60),
    minutes: totalMinutes % 60,
    expired: ms <= 0,
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function TimeUnit({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center min-w-[3.25rem] sm:min-w-[3.75rem]">
      <span className="font-semibold tabular-nums text-xl sm:text-2xl text-[#f0d48f] leading-none">
        {value}
      </span>
      <span className="mt-1 text-[10px] sm:text-xs uppercase tracking-wide text-[#e8e0d5]/55">
        {label}
      </span>
    </div>
  );
}

/** Sticky top countdown for LDMA detector bundle offer (expires end of 8/22/26 Pacific). */
export function BundleOfferCountdown() {
  const [remaining, setRemaining] = useState<Remaining | null>(null);

  useEffect(() => {
    const tick = () => setRemaining(getRemaining(Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  // Avoid SSR/client mismatch — render a stable shell until mounted.
  if (!remaining) {
    return (
      <div
        className="border-b border-[#d4af37]/25 bg-[#241c12]"
        aria-hidden
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 min-h-[4.5rem]" />
      </div>
    );
  }

  if (remaining.expired) {
    return (
      <div
        className="border-b border-[#d4af37]/25 bg-[#241c12]"
        role="status"
        aria-live="polite"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 text-center">
          <p className="text-sm sm:text-base text-[#f0d48f] font-semibold">
            Bundle offers expired. Call{" "}
            <a
              href="tel:+18884653717"
              className="underline decoration-[#d4af37]/60 underline-offset-2 hover:text-[#fff3c4]"
            >
              (888) 465-3717
            </a>{" "}
            for membership options.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="border-b border-[#d4af37]/25 bg-[#241c12]"
      role="timer"
      aria-live="polite"
      aria-label={`LDMA bundle offers expire in ${remaining.days} days, ${remaining.hours} hours, ${remaining.minutes} minutes`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6">
        <p className="text-xs sm:text-sm font-medium uppercase tracking-wide text-[#e8e0d5]/75 text-center">
          LDMA Bundle Offers Expire In:
        </p>
        <div className="flex items-center gap-3 sm:gap-4">
          <TimeUnit value={String(remaining.days)} label="Days" />
          <span className="text-[#d4af37]/50 text-xl font-light pb-4" aria-hidden>
            :
          </span>
          <TimeUnit value={pad2(remaining.hours)} label="Hours" />
          <span className="text-[#d4af37]/50 text-xl font-light pb-4" aria-hidden>
            :
          </span>
          <TimeUnit value={pad2(remaining.minutes)} label="Minutes" />
        </div>
      </div>
    </div>
  );
}
