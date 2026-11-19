import type { TrainerEventLink } from "@/lib/trainers-types";

/** Gold focus ring used across the trainer pages. Matches the admin editor controls. */
export const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4af37]";

export function trainerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "LD";
  const first = parts[0] ?? "";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? "";
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

export function trainerFirstName(name: string): string {
  const first = name.trim().split(/\s+/)[0];
  return first || "this trainer";
}

export function nonEmpty(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** True when next/image can optimize this src under next.config.ts remotePatterns. */
export function isOptimizableImage(src: string): boolean {
  if (src.startsWith("/") && !src.startsWith("//")) return true;
  try {
    const url = new URL(src);
    if (url.protocol !== "https:") return false;
    if (url.hostname === "images.unsplash.com" || url.hostname === "cdn.shopify.com") return true;
    return url.hostname.endsWith(".blob.vercel-storage.com") || url.hostname === "blob.vercel-storage.com";
  } catch {
    return false;
  }
}

/** Blank TipTap output (`<p></p>`, `<p><br></p>`) counts as no biography. */
export function isEmptyTrainerHtml(html: string | null | undefined): boolean {
  if (!html) return true;
  const text = html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length === 0;
}

export function visibleEvents(events: TrainerEventLink[] | null | undefined): TrainerEventLink[] {
  if (!events) return [];
  return events.filter((event) => nonEmpty(event.handle) != null);
}

export function publicSiteOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || "https://ldma-50th.vercel.app";
  const trimmed = raw.replace(/\/$/, "");
  if (trimmed.includes("myshopify.com")) return "https://ldma-50th.vercel.app";
  return trimmed;
}

export function absoluteAssetUrl(origin: string, src: string): string {
  if (/^https?:\/\//i.test(src)) return src;
  return `${origin}${src.startsWith("/") ? "" : "/"}${src}`;
}
