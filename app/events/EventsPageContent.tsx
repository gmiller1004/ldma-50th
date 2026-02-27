"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { MapPin, Calendar, Loader2 } from "lucide-react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { AddToCartButton } from "@/components/AddToCartButton";
import { EVENT_TYPES, CAMP_FILTERS } from "@/lib/events-config";
import type { EventProduct } from "@/lib/shopify";

type EventWithVariant = EventProduct & {
  variantId: string;
  price: string;
};

type EventDates = {
  startDate: Date | null;
  endDate: Date | null;
  formatted: string | null;
};

/** Extract dates from metafields (preferred) or tags. Tags: date:YYYY-MM-DD, date-end:YYYY-MM-DD */
function getEventDates(product: EventProduct): EventDates {
  const result: EventDates = { startDate: null, endDate: null, formatted: null };

  const metafields = product.metafields ?? [];
  const metaMap: Record<string, string> = {};
  for (const m of metafields) {
    if (m?.key != null) metaMap[m.key] = m.value ?? "";
  }

  let startStr = metaMap["start_date"] ?? metaMap["start_date_iso"];
  let endStr = metaMap["end_date"] ?? metaMap["end_date_iso"];

  if (!startStr) {
    const tags = product.tags ?? [];
    for (const tag of tags) {
      const m = tag.match(/^date[:=]([\d-]+)$/i);
      if (m) {
        startStr = m[1];
        break;
      }
    }
  }
  if (!endStr) {
    const tags = product.tags ?? [];
    for (const tag of tags) {
      const m = tag.match(/^date-end[:=]([\d-]+)$/i);
      if (m) {
        endStr = m[1];
        break;
      }
    }
  }

  // Fallback: try to parse "March 16-22" or "March 16 – 22" from title
  if (!startStr && product.title) {
    const parsed = parseDateRangeFromTitle(product.title);
    if (parsed) {
      result.startDate = parsed.startDate;
      result.endDate = parsed.endDate;
      result.formatted = formatDateRange(parsed.startDate, parsed.endDate);
      return result;
    }
  }

  const startDate = startStr ? parseISODate(startStr) : null;
  const endDate = endStr ? parseISODate(endStr) : null;

  result.startDate = startDate;
  result.endDate = endDate;
  result.formatted = formatDateRange(startDate, endDate);

  return result;
}

function parseISODate(str: string): Date | null {
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/** Try to parse "March 16-22" or "Mar 16 – 22, 2026" from title. Year from title or current year. */
function parseDateRangeFromTitle(
  title: string
): { startDate: Date; endDate: Date } | null {
  const yearMatch = title.match(/\b(20\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();
  const months: Record<string, number> = {
    jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
    may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
    sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
    dec: 11, december: 11,
  };
  const monthNameMatch = title.match(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)(?:uary|ruary|ch|il|e|y|tember|ober|ember)?\b/i
  );
  if (!monthNameMatch) return null;
  const month = months[monthNameMatch[1].toLowerCase().slice(0, 3)];
  if (month === undefined) return null;
  const dayMatch = title.match(/(\d{1,2})\s*[-–—]\s*(\d{1,2})/);
  if (!dayMatch) return null;
  const startDay = parseInt(dayMatch[1], 10);
  const endDay = parseInt(dayMatch[2], 10);
  const startDate = new Date(year, month, startDay);
  const endDate = new Date(year, month, endDay);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return null;
  return { startDate, endDate };
}

function formatDateRange(start: Date | null, end: Date | null): string | null {
  if (!start) return null;
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  if (!end || start.getTime() === end.getTime()) {
    return start.toLocaleDateString("en-US", opts);
  }
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return `${start.toLocaleDateString("en-US", { month: "short" })} ${start.getDate()} – ${end.getDate()}, ${start.getFullYear()}`;
  }
  return `${start.toLocaleDateString("en-US", opts)} – ${end.toLocaleDateString("en-US", opts)}`;
}

function getEventType(product: EventWithVariant): string {
  const tags = product.tags ?? [];
  const lower = tags.map((t) => t.toLowerCase());
  if (
    lower.some((t) =>
      /dirt\s*fest|dirtfest|dirt-fest/.test(t)
    )
  )
    return "dirtfest";
  if (lower.some((t) => t.includes("detector"))) return "detector";
  // Fallback: infer from title (e.g. "Dirt Fest Stanton 2026")
  const titleLower = product.title.toLowerCase();
  if (/dirt\s*fest/.test(titleLower)) return "dirtfest";
  if (titleLower.includes("detector")) return "detector";
  return "other";
}

function getCampSlug(product: EventWithVariant): string | null {
  const tags = product.tags ?? [];
  const lower = tags.map((t) => t.toLowerCase().replace(/\s/g, "-"));
  const campSlugs = CAMP_FILTERS.slice(1).map((c) => c.id);
  for (const tag of lower) {
    for (const slug of campSlugs) {
      const slugNoHyphens = slug.replace(/-/g, "");
      if (
        tag.includes(slug) ||
        tag.includes(slugNoHyphens) ||
        slug === tag ||
        slug.startsWith(tag + "-")
      )
        return slug;
    }
  }
  // Fallback: infer from title (e.g. "Dirt Fest Stanton", "Burnt River")
  const titleLower = product.title.toLowerCase();
  for (const slug of campSlugs) {
    const parts = slug.split("-");
    const nameParts =
      parts.length > 2 ? parts.slice(0, 2) : parts.slice(0, -1);
    if (nameParts.length >= 1 && nameParts.every((p) => titleLower.includes(p)))
      return slug;
  }
  return null;
}

function matchesEventType(product: EventWithVariant, typeId: string): boolean {
  if (typeId === "all") return true;
  return getEventType(product) === typeId;
}

function matchesCamp(product: EventWithVariant, campId: string): boolean {
  if (campId === "all") return true;
  const slug = getCampSlug(product);
  return slug === campId || (campId === "other" && !slug);
}

export function EventsPageContent({
  events,
}: {
  events: EventProduct[];
}) {
  const [eventType, setEventType] = useState<string>("all");
  const [camp, setCamp] = useState<string>("all");

  const eventsWithVariant: EventWithVariant[] = useMemo(() => {
    return events
      .map((e) => {
        const variant = e.variants?.edges?.[0]?.node;
        if (!variant) return null;
        return {
          ...e,
          variantId: variant.id,
          price: variant.price.amount,
        };
      })
      .filter((e): e is EventWithVariant => e !== null);
  }, [events]);

  const filtered = useMemo(() => {
    const list = eventsWithVariant.filter(
      (e) => matchesEventType(e, eventType) && matchesCamp(e, camp)
    );
    return list.sort((a, b) => {
      const aDates = getEventDates(a);
      const bDates = getEventDates(b);
      const aT = aDates.startDate?.getTime() ?? 0;
      const bT = bDates.startDate?.getTime() ?? 0;
      return aT - bT;
    });
  }, [eventsWithVariant, eventType, camp]);

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Events" },
          ]}
        />
      </div>

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
            2026
          </motion.span>
          <motion.h1
            className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-[#f0d48f] tracking-tight mb-4"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Events
          </motion.h1>
          <motion.p
            className="text-[#e8e0d5]/90 text-lg md:text-xl max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Dirt Fest, detector days, Gold N BBQ, and more — across all LDMA
            campgrounds. Register for your next adventure.
          </motion.p>
        </div>
      </section>

      {/* Filters */}
      <section className="py-8 border-b border-[#d4af37]/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label
                htmlFor="event-type"
                className="block text-sm font-medium text-[#e8e0d5]/70 mb-1"
              >
                Event type
              </label>
              <select
                id="event-type"
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-[#1a120b] border border-[#d4af37]/30 text-[#e8e0d5] focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50"
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label
                htmlFor="camp"
                className="block text-sm font-medium text-[#e8e0d5]/70 mb-1"
              >
                Camp
              </label>
              <select
                id="camp"
                value={camp}
                onChange={(e) => setCamp(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-[#1a120b] border border-[#d4af37]/30 text-[#e8e0d5] focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50"
              >
                {CAMP_FILTERS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Event grid or empty state */}
      <section className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {filtered.length === 0 ? (
            <motion.div
              className="text-center py-16"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <p className="text-[#e8e0d5]/80 text-lg mb-4">
                {eventsWithVariant.length === 0
                  ? "No events are listed yet."
                  : "No events match your filters."}
              </p>
              <p className="text-[#e8e0d5]/60 text-sm max-w-lg mx-auto mb-8">
                {eventsWithVariant.length === 0
                  ? "Event registrations will appear here as they’re added. Check back soon or contact us for the latest schedule."
                  : "Try changing the event type or camp filter above."}
              </p>
              <Link
                href="/memberships"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#d4af37]/20 text-[#d4af37] font-semibold rounded-lg hover:bg-[#d4af37]/30 transition-colors"
              >
                Explore memberships
              </Link>
            </motion.div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 items-start">
              {filtered.map((event, i) => (
                <EventCard key={event.id} event={event} index={i} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

/** Strip " - " and anything after it for card display; full title stays for cart/checkout */
function getCardTitle(fullTitle: string): string {
  const idx = fullTitle.indexOf(" - ");
  return idx >= 0 ? fullTitle.slice(0, idx).trim() : fullTitle;
}

function EventCard({
  event,
  index,
}: {
  event: EventWithVariant;
  index: number;
}) {
  const campSlug = getCampSlug(event);
  const campLabel =
    CAMP_FILTERS.find((c) => c.id === campSlug)?.label ?? null;
  const dates = getEventDates(event);
  const cardTitle = getCardTitle(event.title);

  return (
    <motion.article
      className="group relative flex flex-col rounded-2xl bg-[#1a120b]/80 border border-[#d4af37]/20 overflow-hidden hover:border-[#d4af37]/40 transition-colors duration-300"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      {/* Image with overlay — default state: title + date over image */}
      <div className="relative aspect-[16/10] bg-[#0f3d1e]/30 overflow-hidden">
        {event.featuredImage?.url ? (
          <Image
            src={event.featuredImage.url}
            alt={event.featuredImage.altText || event.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[#d4af37]/30">
            <Calendar className="w-16 h-16" />
          </div>
        )}
        {/* Gradient overlay for text readability — hidden on hover when details panel shows */}
        <div
          className="absolute inset-x-0 bottom-0 pt-20 pb-4 px-4 transition-opacity duration-200 group-hover:opacity-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.6) 45%, transparent 100%)",
          }}
        >
          {dates.formatted && (
            <p className="text-white/95 text-sm mb-0.5 truncate drop-shadow-sm">
              {dates.formatted}
            </p>
          )}
          <h3 className="font-serif text-lg font-semibold text-white truncate drop-shadow-sm">
            {cardTitle}
          </h3>
        </div>
      </div>

      {/* Full details panel — slides down on hover */}
      <div className="max-h-0 overflow-hidden transition-[max-height] duration-300 ease-out group-hover:max-h-80 border-t border-transparent group-hover:border-[#d4af37]/20">
        <div className="flex flex-col p-5 bg-[#1a120b]/95">
          {dates.formatted && (
            <p className="flex items-center gap-1.5 text-[#e8e0d5]/80 text-sm mb-2">
              <Calendar className="w-4 h-4 text-[#d4af37]/70 flex-shrink-0" />
              {dates.formatted}
            </p>
          )}
          <h3 className="font-serif text-xl font-semibold text-[#f0d48f] mb-2 line-clamp-2">
            {cardTitle}
          </h3>
          {campLabel && (
            <p className="flex items-center gap-1.5 text-[#e8e0d5]/70 text-sm mb-4">
              <MapPin className="w-4 h-4 text-[#d4af37]/70 flex-shrink-0" />
              {campLabel}
            </p>
          )}
          <div className="mt-auto pt-2 flex items-center justify-between gap-4">
            <span className="text-[#d4af37] font-bold">
              ${parseFloat(event.price).toFixed(2)}
            </span>
            <AddToCartButton
              variantId={event.variantId}
              className="!py-2 !px-4 text-sm"
              label="Register"
              addingLabel="Registering…"
            />
          </div>
        </div>
      </div>
    </motion.article>
  );
}
