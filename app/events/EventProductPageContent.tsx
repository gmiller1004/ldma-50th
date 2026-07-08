"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Calendar, Check, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ShareButton } from "@/components/ShareButton";
import {
  EventPurchaseSection,
  filterEventVariantsByMember,
  getEventVariants,
} from "@/components/EventPurchaseSection";
import {
  getCampLabel,
  getCampSlug,
  getCardTitle,
  getEventDates,
  getEventType,
  getEventTypeLabel,
} from "@/lib/event-display";
import { parseEventDescriptionHtml } from "@/lib/event-description";
import { EventCampHighlight } from "@/components/EventCampHighlight";
import type { EventProduct } from "@/lib/shopify";

const DESCRIPTION_CLASS =
  "event-description text-[#e8e0d5]/90 text-sm md:text-base leading-relaxed [&_h2]:font-serif [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-[#f0d48f] [&_h2]:mt-6 [&_h2]:mb-3 [&_h3]:font-serif [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-[#f0d48f] [&_h3]:mt-4 [&_h3]:mb-2 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_ul]:space-y-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-4 [&_li]:text-[#e8e0d5]/85 [&_a]:text-[#d4af37] [&_a]:underline [&_strong]:text-[#e8e0d5]";

export function EventProductPageContent({
  event,
  isMemberLoggedIn,
}: {
  event: EventProduct;
  isMemberLoggedIn: boolean;
}) {
  const filteredEvent = useMemo(
    () => filterEventVariantsByMember(event, isMemberLoggedIn),
    [event, isMemberLoggedIn]
  );

  const variants = getEventVariants(filteredEvent);
  const defaultVariant = variants.find((v) => v.availableForSale !== false) ?? variants[0];
  const [selectedVariantId, setSelectedVariantId] = useState(defaultVariant?.id ?? "");
  const [galleryIndex, setGalleryIndex] = useState(0);

  const dates = getEventDates(event);
  const campSlug = getCampSlug(event);
  const campLabel = getCampLabel(event);
  const typeLabel = getEventTypeLabel(getEventType(event));
  const cardTitle = getCardTitle(event.title);
  const parsed = useMemo(() => parseEventDescriptionHtml(event.descriptionHtml), [event.descriptionHtml]);
  const pagePath = `/events/${event.handle}`;

  const galleryImages = useMemo(() => {
    const primary = event.featuredImage;
    const rest = (event.images?.edges ?? []).map((e) => e.node).filter(Boolean);
    if (primary?.url) {
      return [primary, ...rest.filter((img) => img.url !== primary.url)];
    }
    return rest;
  }, [event.featuredImage, event.images]);

  const sidebarHighlights = useMemo(() => {
    const fromSections = parsed.sections.flatMap((s) => s.bullets);
    const combined = [...parsed.highlights, ...fromSections];
    return [...new Set(combined)].slice(0, 12);
  }, [parsed]);

  return (
    <div className="bg-[#1a120b] min-h-screen">
      {/* Hero gallery */}
      <section className="relative w-full">
        <div className="relative aspect-[21/9] min-h-[240px] max-h-[520px] w-full bg-[#0f3d1e]/30">
          {galleryImages.length > 0 ? (
            <>
              <Image
                src={galleryImages[galleryIndex]?.url ?? galleryImages[0]!.url}
                alt={galleryImages[galleryIndex]?.altText ?? event.title}
                fill
                priority
                className="object-cover"
                sizes="100vw"
              />
              {galleryImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setGalleryIndex((i) => (i === 0 ? galleryImages.length - 1 : i - 1))
                    }
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/50 text-white hover:bg-black/70"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setGalleryIndex((i) => (i === galleryImages.length - 1 ? 0 : i + 1))
                    }
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/50 text-white hover:bg-black/70"
                    aria-label="Next image"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-[#d4af37]/30">
              <Calendar className="w-20 h-20" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#1a120b] via-[#1a120b]/40 to-transparent" />
        </div>

        {galleryImages.length > 1 && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 relative z-10 flex gap-2 overflow-x-auto pb-2">
            {galleryImages.map((img, i) => (
              <button
                key={img.url}
                type="button"
                onClick={() => setGalleryIndex(i)}
                className={`relative shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-colors ${
                  galleryIndex === i ? "border-[#d4af37]" : "border-transparent opacity-70 hover:opacity-100"
                }`}
              >
                <Image src={img.url} alt="" fill className="object-cover" sizes="80px" />
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Events", href: "/events" },
            { label: cardTitle },
          ]}
        />

        <div className="mt-8 grid lg:grid-cols-[1fr_380px] gap-10 lg:gap-14 items-start">
          {/* Main content */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/30">
                {typeLabel}
              </span>
              <ShareButton
                url={pagePath}
                title={event.title}
                text={[dates.formatted, campLabel].filter(Boolean).join(" • ")}
              />
            </div>

            <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-[#f0d48f] leading-tight mb-4">
              {cardTitle}
            </h1>

            <div className="flex flex-wrap gap-5 text-[#e8e0d5]/85 mb-8">
              {dates.formatted && (
                <span className="inline-flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#d4af37]" />
                  {dates.formatted}
                </span>
              )}
              {campLabel && (
                <span className="inline-flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-[#d4af37]" />
                  {campLabel}
                </span>
              )}
            </div>

            <EventCampHighlight campSlug={campSlug} />

            {/* Mobile purchase — above fold on small screens */}
            <div className="lg:hidden mb-10">
              <EventPurchaseSection
                event={filteredEvent}
                isMemberLoggedIn={isMemberLoggedIn}
                selectedVariantId={selectedVariantId}
                onSelectVariant={setSelectedVariantId}
                loginRedirectPath={pagePath}
              />
            </div>

            {parsed.sections.length > 0 ? (
              <>
                {parsed.introHtml && (
                  <div
                    className={`${DESCRIPTION_CLASS} mb-8`}
                    dangerouslySetInnerHTML={{ __html: parsed.introHtml }}
                  />
                )}
                <div className="space-y-8">
                  {parsed.sections.map((section) => (
                    <section
                      key={section.title}
                      className="rounded-xl border border-[#d4af37]/15 bg-[#0f0a06]/40 p-6 md:p-8"
                    >
                      <h2
                        className={`font-serif font-semibold text-[#f0d48f] mb-4 ${
                          section.level === 2 ? "text-2xl" : "text-xl"
                        }`}
                      >
                        {section.title}
                      </h2>
                      {section.bullets.length > 0 && (
                        <ul className="mb-5 space-y-2">
                          {section.bullets.map((item) => (
                            <li key={item} className="flex gap-2.5 text-sm text-[#e8e0d5]/85">
                              <Check className="w-4 h-4 text-[#d4af37] shrink-0 mt-0.5" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {section.html && (
                        <div className={DESCRIPTION_CLASS} dangerouslySetInnerHTML={{ __html: section.html }} />
                      )}
                    </section>
                  ))}
                </div>
              </>
            ) : (
              (() => {
                const html = parsed.introHtml ?? event.descriptionHtml;
                if (!html) return null;
                return (
                  <div
                    className={`rounded-xl border border-[#d4af37]/15 bg-[#0f0a06]/40 p-6 md:p-8 ${DESCRIPTION_CLASS}`}
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                );
              })()
            )}

            <div className="mt-10 pt-8 border-t border-[#d4af37]/15 flex flex-wrap gap-4 text-sm">
              <Link href="/discover-events" className="text-[#d4af37] hover:text-[#f0d48f] font-medium">
                ← New to LDMA events?
              </Link>
              <Link href="/events" className="text-[#e8e0d5]/60 hover:text-[#e8e0d5]">
                Browse all events
              </Link>
            </div>
          </div>

          {/* Sticky sidebar */}
          <aside className="hidden lg:block lg:sticky lg:top-28 space-y-6">
            <EventPurchaseSection
              event={filteredEvent}
              isMemberLoggedIn={isMemberLoggedIn}
              selectedVariantId={selectedVariantId}
              onSelectVariant={setSelectedVariantId}
              loginRedirectPath={pagePath}
            />

            {sidebarHighlights.length > 0 && (
              <div className="rounded-xl border border-[#d4af37]/15 bg-[#0f0a06]/50 p-5">
                <h3 className="font-serif text-lg font-semibold text-[#f0d48f] mb-4">Highlights</h3>
                <ul className="space-y-2.5">
                  {sidebarHighlights.map((item) => (
                    <li key={item} className="flex gap-2 text-sm text-[#e8e0d5]/80">
                      <Check className="w-4 h-4 text-[#d4af37] shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
