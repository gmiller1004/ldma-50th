"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { MapPin, Calendar, ChevronRight } from "lucide-react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import { EventsExitIntentSignup } from "@/components/EventsExitIntentSignup";
import { AddToCartButton } from "@/components/AddToCartButton";
import { EVENT_TYPES, CAMP_FILTERS, PRICE_LEVEL_METAFIELD } from "@/lib/events-config";
import {
  getEventDates,
  getEventType,
  getCampSlug,
  isPastEvent,
  isVipUpsellEvent,
  getCardTitle,
  matchesEventType,
} from "@/lib/event-display";
import type { EventProduct, EventVariant } from "@/lib/shopify";

type EventWithVariant = EventProduct;

function matchesCamp(product: EventWithVariant, campId: string): boolean {
  if (campId === "all") return true;
  const slug = getCampSlug(product);
  return slug === campId || (campId === "other" && !slug);
}

/** Get flat array of variants from product */
function getVariants(product: EventProduct): EventVariant[] {
  return (product.variants?.edges ?? []).map((e) => e.node).filter(Boolean);
}

/** Classify variant as "member" or "general" from the price_level variant metafield; "unset" if missing or unknown. */
function getVariantPricingType(variant: EventVariant): "member" | "general" | "unset" {
  const raw = (variant.metafields ?? []).find(
    (m) => m && m.key === PRICE_LEVEL_METAFIELD.key && m.value
  )?.value;
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "member") return "member";
  if (v === "non member" || v === "nonmember") return "general";
  return "unset";
}

/**
 * Return event with variants filtered by member login state:
 * - Not logged in: only "general" variants (general admission); "unset" included.
 * - Logged in: only "member" variants; if none, fall back to all so event stays registerable.
 */
function filterEventVariantsByMember(
  event: EventProduct,
  isMemberLoggedIn: boolean
): EventProduct {
  const allVariants = getVariants(event);
  if (allVariants.length === 0) return event;

  const types = allVariants.map((v) => getVariantPricingType(v));
  const hasMember = types.some((t) => t === "member");
  const hasGeneral = types.some((t) => t === "general");

  let keep: (v: EventVariant) => boolean;
  if (isMemberLoggedIn) {
    if (hasMember) keep = (v) => getVariantPricingType(v) === "member";
    else keep = () => true;
  } else {
    if (hasGeneral) keep = (v) => getVariantPricingType(v) === "general" || getVariantPricingType(v) === "unset";
    else keep = () => true;
  }

  const filtered = allVariants.filter(keep);
  if (filtered.length === allVariants.length) return event;

  const edges = filtered.map((node) => ({ node }));
  return {
    ...event,
    variants: { edges },
  } as EventProduct;
}

/** Get displayable options (exclude Title if only "Default Title") for variant selection */
function getVariantOptions(product: EventProduct): Array<{
  name: string;
  values: string[];
}> {
  const opts = product.options ?? [];
  return opts
    .filter((opt) => {
      const vals = opt.optionValues?.map((v) => v.name) ?? [];
      if (opt.name === "Title" && vals.length <= 1) return false;
      return vals.length > 1;
    })
    .map((opt) => ({
      name: opt.name,
      values: opt.optionValues?.map((v) => v.name) ?? [],
    }));
}

/** Option values for one option that exist in the given variant list (keeps product order). */
function getOptionValuesFromVariants(
  variants: EventVariant[],
  optionName: string,
  productOptionValues: string[]
): string[] {
  const inVariants = new Set(
    variants
      .map((v) =>
        (v.selectedOptions ?? []).find((o) => o.name === optionName)?.value
      )
      .filter(Boolean)
  );
  return productOptionValues.filter((val) => inVariants.has(val));
}

/** Find variant matching selected option values */
function findVariantByOptions(
  product: EventProduct,
  selected: Record<string, string>
): EventVariant | null {
  const variants = getVariants(product);
  for (const v of variants) {
    const match = (v.selectedOptions ?? []).every(
      (opt) => selected[opt.name] === opt.value
    );
    if (match) return v;
  }
  return variants[0] ?? null;
}

/** Variant selector: dropdown(s) for multi-variant products */
function EventVariantSelector({
  event,
  selectedVariantId,
  onSelect,
  className = "",
}: {
  event: EventProduct;
  selectedVariantId: string;
  onSelect: (variantId: string) => void;
  className?: string;
}) {
  const variants = getVariants(event);
  const options = getVariantOptions(event);

  if (variants.length <= 1) return null;

  const isAvailable = (v: EventVariant) => v.availableForSale !== false;

  // Fallback: no multi-value options but multiple variants — list by variant label
  if (options.length === 0) {
    const label = (v: EventVariant) =>
      (v.selectedOptions ?? [])
        .map((o) => o.value)
        .filter(Boolean)
        .join(" / ") || "Option";
    return (
      <div className={className}>
        <label
          htmlFor={`variant-${event.id}`}
          className="block text-sm font-medium text-[#e8e0d5]/70 mb-1"
        >
          Option
        </label>
        <select
          id={`variant-${event.id}`}
          value={selectedVariantId}
          onChange={(e) => onSelect(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-[#1a120b] border border-[#d4af37]/30 text-[#e8e0d5] text-sm focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50"
        >
          {variants.map((v) => (
            <option key={v.id} value={v.id} disabled={!isAvailable(v)}>
              {label(v)} — ${parseFloat(v.price.amount).toFixed(2)}
              {!isAvailable(v) ? " (Sold out)" : ""}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // Single option with multiple values: one select — only show values that exist in filtered variants
  if (options.length === 1) {
    const opt = options[0]!;
    const valuesToShow = getOptionValuesFromVariants(variants, opt.name, opt.values);
    const selectedVariant = variants.find((v) => v.id === selectedVariantId);
    const currentValue =
      selectedVariant?.selectedOptions?.find((o) => o.name === opt.name)
        ?.value ?? valuesToShow[0];

    return (
      <div className={className}>
        <label
          htmlFor={`variant-${event.id}-${opt.name}`}
          className="block text-sm font-medium text-[#e8e0d5]/70 mb-1"
        >
          {opt.name}
        </label>
        <select
          id={`variant-${event.id}-${opt.name}`}
          value={currentValue}
          onChange={(e) => {
            const val = e.target.value;
            const v = variants.find(
              (x) =>
                x.selectedOptions?.find((o) => o.name === opt.name)?.value ===
                val
            );
            if (v) onSelect(v.id);
          }}
          className="w-full px-3 py-2 rounded-lg bg-[#1a120b] border border-[#d4af37]/30 text-[#e8e0d5] text-sm focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50"
        >
          {valuesToShow.map((val) => {
            const v = variants.find(
              (x) =>
                x.selectedOptions?.find((o) => o.name === opt.name)?.value ===
                val
            );
            const available = v ? isAvailable(v) : true;
            return (
              <option
                key={val}
                value={val}
                disabled={!available}
              >
                {val}
                {!available ? " (Sold out)" : ""}
              </option>
            );
          })}
        </select>
      </div>
    );
  }

  // Multiple options: select per option — only show values that exist in filtered variants
  const selectedVariant = variants.find((v) => v.id === selectedVariantId);
  const selectedOptions: Record<string, string> = {};
  for (const o of selectedVariant?.selectedOptions ?? []) {
    selectedOptions[o.name] = o.value;
  }
  const selectedIsSoldOut =
    selectedVariant && !isAvailable(selectedVariant);

  return (
    <div className={`space-y-3 ${className}`}>
      {selectedIsSoldOut && (
        <p className="text-amber-400/90 text-sm font-medium">This option is sold out</p>
      )}
      {options.map((opt) => {
        const valuesToShow = getOptionValuesFromVariants(variants, opt.name, opt.values);
        return (
          <div key={opt.name}>
            <label
              htmlFor={`variant-${event.id}-${opt.name}`}
              className="block text-sm font-medium text-[#e8e0d5]/70 mb-1"
            >
              {opt.name}
            </label>
            <select
              id={`variant-${event.id}-${opt.name}`}
              value={selectedOptions[opt.name] ?? valuesToShow[0]}
              onChange={(e) => {
                const next = { ...selectedOptions, [opt.name]: e.target.value };
                const v = findVariantByOptions(event, next);
                if (v) onSelect(v.id);
              }}
              className="w-full px-3 py-2 rounded-lg bg-[#1a120b] border border-[#d4af37]/30 text-[#e8e0d5] text-sm focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50"
            >
              {valuesToShow.map((val) => (
                <option key={val} value={val}>
                  {val}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}

export function EventsPageContent({
  events,
  isMemberLoggedIn,
}: {
  events: EventProduct[];
  isMemberLoggedIn: boolean;
}) {
  const [eventType, setEventType] = useState<string>("all");
  const [camp, setCamp] = useState<string>("all");
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightHandle = searchParams.get("product");

  const eventsWithVariant: EventWithVariant[] = useMemo(() => {
    const withVariants = events.filter(
      (e) => (e.variants?.edges?.length ?? 0) > 0 && !isPastEvent(e)
    ) as EventWithVariant[];
    return withVariants.map((e) =>
      filterEventVariantsByMember(e, isMemberLoggedIn)
    ) as EventWithVariant[];
  }, [events, isMemberLoggedIn]);

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

  useEffect(() => {
    if (!highlightHandle) return;
    router.replace(`/events/${encodeURIComponent(highlightHandle)}`);
  }, [highlightHandle, router]);

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
            Gold Diggin&apos;s, Dirt Party, detector days, and more — across all LDMA
            campgrounds. Register for your next adventure.
          </motion.p>
          <motion.p
            className="mt-4 text-[#e8e0d5]/80 text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
          >
            <Link
              href="/about-events"
              className="text-[#d4af37] hover:text-[#f0d48f] font-medium underline underline-offset-2"
            >
              Learn more about LDMA events
            </Link>
          </motion.p>
          {!isMemberLoggedIn && (
            <motion.p
              className="mt-6 text-[#e8e0d5]/80 text-sm md:text-base max-w-xl mx-auto"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              Log in to see member-only pricing.{" "}
              <Link
                href="/members/login?redirect=/events"
                className="font-medium text-[#d4af37] hover:text-[#f0d48f] underline underline-offset-2 transition-colors"
              >
                Sign in
              </Link>
            </motion.p>
          )}
        </div>
      </section>

      <NewsletterSignup
        variant="banner"
        id="events-email-signup"
        analyticsSource="events"
        title="Get email updates on LDMA events"
        description="Sign up to hear when we announce new Gold Diggin's, Dirt Party, detector days, and camp events — plus heads-up when registration opens so you don't miss a spot."
        successTitle="You're on the list"
        successMessage="Watch your inbox for new events and registration news from LDMA."
        submitLabel="Notify me"
      />

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
                <EventCard
                  key={event.id}
                  event={event}
                  index={i}
                  isMemberLoggedIn={isMemberLoggedIn}
                />
              ))}
            </div>
          )}

        </div>
      </section>

      <EventsExitIntentSignup isMemberLoggedIn={isMemberLoggedIn} blockTriggers={false} />
    </>
  );
}

function EventCard({
  event,
  index,
  isMemberLoggedIn,
}: {
  event: EventWithVariant;
  index: number;
  isMemberLoggedIn: boolean;
}) {
  const variants = getVariants(event);
  const defaultVariant =
    variants.find((v) => v.availableForSale !== false) ?? variants[0];
  const [selectedVariantId, setSelectedVariantId] = useState(
    defaultVariant?.id ?? ""
  );
  const selectedVariant =
    variants.find((v) => v.id === selectedVariantId) ?? defaultVariant;
  const isSoldOut =
    selectedVariant ? selectedVariant.availableForSale === false : false;
  const memberPricingOnly = variants.length === 0 && !isMemberLoggedIn;

  const campSlug = getCampSlug(event);
  const campLabel =
    CAMP_FILTERS.find((c) => c.id === campSlug)?.label ?? null;
  const dates = getEventDates(event);
  const cardTitle = getCardTitle(event.title);
  const [isSmUp, setIsSmUp] = useState(false);
  const [isTouchLikeInput, setIsTouchLikeInput] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const smQuery = window.matchMedia("(min-width: 640px)");
    const touchQuery = window.matchMedia("(hover: none), (pointer: coarse)");
    const update = () => {
      setIsSmUp(smQuery.matches);
      setIsTouchLikeInput(touchQuery.matches);
    };
    update();
    smQuery.addEventListener("change", update);
    touchQuery.addEventListener("change", update);
    return () => {
      smQuery.removeEventListener("change", update);
      touchQuery.removeEventListener("change", update);
    };
  }, []);

  // Landscape phones often hit sm breakpoint but still have no hover. Use tap-to-expand there.
  const isTapExpandMode = isSmUp && isTouchLikeInput;

  const handleCardClick = (e: React.MouseEvent<HTMLElement>) => {
    if (!isTapExpandMode) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("button, a, input, select, textarea, label")) return;
    setIsExpanded((v) => !v);
  };

  return (
    <motion.article
      className="group relative flex flex-col rounded-2xl bg-[#1a120b]/80 border border-[#d4af37]/20 overflow-hidden hover:border-[#d4af37]/40 transition-colors duration-300"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={handleCardClick}
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
        {/* Gradient overlay with date/title — hidden on mobile (panel always expanded); on sm+ shown until hover */}
        <div
          className={`absolute inset-x-0 bottom-0 pt-20 pb-4 px-4 transition-opacity duration-200 hidden sm:block ${
            isTapExpandMode
              ? isExpanded
                ? "opacity-0"
                : "opacity-100"
              : "sm:group-hover:opacity-0"
          }`}
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

      {/* Full details panel — always expanded on mobile; slides down on hover for sm+ */}
      <div
        className={`overflow-hidden transition-[max-height] duration-300 ease-out border-t ${
          isTapExpandMode
            ? isExpanded
              ? "max-h-80 border-[#d4af37]/20"
              : "max-h-0 border-transparent"
            : "max-h-80 sm:max-h-0 border-[#d4af37]/20 sm:border-transparent sm:group-hover:max-h-80 sm:group-hover:border-[#d4af37]/20"
        }`}
      >
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
          {memberPricingOnly ? (
            <div className="mb-4 p-3 rounded-lg bg-[#d4af37]/10 border border-[#d4af37]/20 text-center">
              <p className="text-[#e8e0d5]/90 text-sm mb-2">Member pricing — log in to view</p>
              <Link
                href={`/members/login?redirect=${encodeURIComponent("/events")}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#d4af37] border border-[#d4af37]/40 rounded-lg hover:bg-[#d4af37]/10 transition-colors"
              >
                Log in
              </Link>
            </div>
          ) : (
            <>
              <EventVariantSelector
                event={event}
                selectedVariantId={selectedVariantId}
                onSelect={setSelectedVariantId}
                className="mb-4"
              />
              <div className="mt-auto pt-2 flex flex-wrap items-center justify-between gap-3">
                <span className="text-[#d4af37] font-bold">
                  $
                  {selectedVariant
                    ? parseFloat(selectedVariant.price.amount).toFixed(2)
                    : "0.00"}
                </span>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/events/${event.handle}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#e8e0d5] border border-[#d4af37]/40 rounded-lg hover:bg-[#d4af37]/10 hover:border-[#d4af37]/60 transition-colors"
                  >
                    More Info
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                  {isSoldOut ? (
                    <span className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-[#e8e0d5]/60 bg-[#d4af37]/10 rounded-lg cursor-not-allowed border border-[#d4af37]/20">
                      Sold out
                    </span>
                  ) : (
                    <AddToCartButton
                      variantId={selectedVariant?.id ?? ""}
                      className="!py-2 !px-4 text-sm"
                      label="Register"
                      addingLabel="Registering…"
                      disabled={!selectedVariant}
                      isDirtFestEvent={isVipUpsellEvent(event)}
                      trackCategory="event"
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </motion.article>
  );
}
