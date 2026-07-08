"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ExternalLink, MapPin, Navigation, X } from "lucide-react";
import { getCampBySlug } from "@/lib/directory-camps";
import type { CampPageData } from "@/lib/camp-page-data";

function mapsEmbedFromAddress(address: string) {
  return `https://maps.google.com/maps?q=${encodeURIComponent(address)}&t=k&z=15&ie=UTF8&iwloc=&output=embed`;
}

function mapsSearchFromAddress(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function mapsDirFromAddress(address: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

function truncate(text: string, max: number) {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

function CampMapModal({
  campName,
  address,
  mapsEmbedUrl,
  mapsSearchUrl,
  mapsDirUrl,
  onClose,
}: {
  campName: string;
  address: string;
  mapsEmbedUrl: string;
  mapsSearchUrl: string;
  mapsDirUrl: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" aria-hidden="true" />
      <motion.div
        className="relative w-full sm:max-w-3xl bg-[#1a120b] border border-[#d4af37]/30 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="camp-map-title"
      >
        <div className="flex items-start justify-between gap-4 p-5 border-b border-[#d4af37]/15">
          <div className="min-w-0">
            <h2 id="camp-map-title" className="font-serif text-xl font-bold text-[#f0d48f]">
              {campName}
            </h2>
            <p className="mt-1 text-sm text-[#e8e0d5]/75 flex items-start gap-2">
              <MapPin className="w-4 h-4 text-[#d4af37] shrink-0 mt-0.5" />
              <span>{address}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[#e8e0d5]/70 hover:text-[#e8e0d5] hover:bg-[#d4af37]/10 transition-colors shrink-0"
            aria-label="Close map"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative w-full aspect-[4/3] sm:aspect-video bg-[#0f3d1e]/30 min-h-[240px]">
          <iframe
            src={mapsEmbedUrl}
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title={`${campName} location map`}
            className="absolute inset-0 w-full h-full"
          />
        </div>

        <div className="p-5 flex flex-col sm:flex-row gap-3 border-t border-[#d4af37]/15">
          <a
            href={mapsDirUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 flex-1 px-5 py-3 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors"
          >
            <Navigation className="w-5 h-5" />
            Get directions
          </a>
          <a
            href={mapsSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 flex-1 px-5 py-3 border border-[#d4af37]/40 text-[#e8e0d5] font-medium rounded-lg hover:bg-[#d4af37]/10 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Open in Google Maps
          </a>
        </div>
      </motion.div>
    </motion.div>
  );
}

function campHighlights(data: CampPageData): string[] {
  const fromAmenities = data.amenities
    .filter((a) => a.highlight)
    .map((a) => a.text)
    .slice(0, 4);
  if (fromAmenities.length > 0) return fromAmenities;
  return data.amenities.map((a) => a.text).slice(0, 3);
}

export function EventCampHighlight({ campSlug }: { campSlug: string | null }) {
  const [mapOpen, setMapOpen] = useState(false);

  if (!campSlug) return null;

  const camp = getCampBySlug(campSlug);
  if (!camp) return null;

  const data = camp.data;
  const address = data?.address ?? camp.address;
  const mapsEmbedUrl = data?.mapsEmbedUrl ?? mapsEmbedFromAddress(address);
  const mapsSearchUrl = data?.mapsSearchUrl ?? mapsSearchFromAddress(address);
  const mapsDirUrl = mapsDirFromAddress(address);
  const campPageHref = `/campgrounds/${camp.slug}`;
  const highlights = data ? campHighlights(data) : [];
  const overview = data ? truncate(data.overview, 220) : truncate(camp.desc, 220);
  const goldNote = data?.goldProspecting.text
    ? truncate(data.goldProspecting.text, 140)
    : null;
  const stats = data?.stats.slice(0, 3) ?? [];

  return (
    <>
      <section className="mb-8 rounded-xl border border-[#d4af37]/25 bg-gradient-to-br from-[#0f3d1e]/25 via-[#0f0a06]/60 to-[#1a120b] overflow-hidden">
        <div className="grid md:grid-cols-[200px_1fr] lg:grid-cols-[240px_1fr]">
          <div className="relative aspect-[16/10] md:aspect-auto md:min-h-[220px] bg-[#0f3d1e]/40">
            <Image
              src={camp.image}
              alt={`${camp.name} campground`}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 240px"
            />
            <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-[#1a120b]/80 via-transparent to-transparent" />
          </div>

          <div className="p-5 md:p-6 flex flex-col">
            <p className="text-xs font-medium uppercase tracking-wider text-[#d4af37]/80 mb-1">
              Hosted at
            </p>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
              <div>
                <Link
                  href={campPageHref}
                  className="font-serif text-2xl font-bold text-[#f0d48f] hover:text-[#d4af37] transition-colors"
                >
                  {camp.name}
                </Link>
                <p className="text-sm text-[#d4af37]/90 mt-0.5">{camp.tagline}</p>
              </div>
              {stats.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {stats.map((stat) => (
                    <span
                      key={stat.label}
                      className="px-2.5 py-1 rounded-md text-xs bg-[#d4af37]/10 border border-[#d4af37]/20 text-[#e8e0d5]/85"
                    >
                      <span className="font-semibold text-[#d4af37]">{stat.value}</span>{" "}
                      {stat.label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <p className="text-sm text-[#e8e0d5]/80 leading-relaxed mb-4">{overview}</p>

            {goldNote && (
              <p className="text-sm text-[#e8e0d5]/70 italic mb-4 border-l-2 border-[#d4af37]/40 pl-3">
                {goldNote}
              </p>
            )}

            {highlights.length > 0 && (
              <ul className="grid sm:grid-cols-2 gap-2 mb-5">
                {highlights.map((item) => (
                  <li key={item} className="flex gap-2 text-sm text-[#e8e0d5]/85">
                    <Check className="w-4 h-4 text-[#d4af37] shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setMapOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors"
              >
                <MapPin className="w-4 h-4" />
                Map &amp; directions
              </button>
              <Link
                href={campPageHref}
                className="inline-flex items-center gap-2 px-4 py-2.5 border border-[#d4af37]/35 text-[#e8e0d5] font-medium rounded-lg hover:bg-[#d4af37]/10 transition-colors"
              >
                Explore {camp.name}
              </Link>
              <span className="text-xs text-[#e8e0d5]/50 hidden sm:inline">{address}</span>
            </div>
          </div>
        </div>
      </section>

      <AnimatePresence>
        {mapOpen && (
          <CampMapModal
            campName={camp.name}
            address={address}
            mapsEmbedUrl={mapsEmbedUrl}
            mapsSearchUrl={mapsSearchUrl}
            mapsDirUrl={mapsDirUrl}
            onClose={() => setMapOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
