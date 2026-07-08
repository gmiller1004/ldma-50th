/**
 * Shared event date parsing, classification, and display helpers.
 * Used by /events and /discover-events.
 */

import { CAMP_FILTERS, EVENT_TYPES, type EventTypeId } from "@/lib/events-config";
import type { EventProduct } from "@/lib/shopify";

export type EventDates = {
  startDate: Date | null;
  endDate: Date | null;
  formatted: string | null;
};

function buildEventMetaMap(
  metafields: Array<{ namespace?: string; key: string; value?: string }>
): Record<string, string> {
  const metaMap: Record<string, string> = {};
  for (const m of metafields) {
    if (m?.key == null) continue;
    const val = String(m.value ?? "").trim();
    if (!val) continue;
    const ns = m.namespace;
    if (ns) metaMap[`${ns}.${m.key}`] = val;
    if (metaMap[m.key] === undefined) metaMap[m.key] = val;
  }
  return metaMap;
}

function parseDateOnlyLocal(str: string): Date | null {
  const m = str.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  const d = parseInt(m[3], 10);
  const dt = new Date(y, mo, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return dt;
}

function parseISODate(str: string): Date | null {
  const trimmed = str.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const local = parseDateOnlyLocal(trimmed);
    if (local) return local;
  }
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d;
}

const HANDLE_MONTH: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function monthFromHandleToken(tok: string): number | undefined {
  const x = tok.toLowerCase().replace(/[^a-z]/g, "");
  if (x.startsWith("sept")) return 8;
  const three = x.slice(0, 3);
  return HANDLE_MONTH[three];
}

function parseDatesFromHandle(
  handle: string,
  title: string
): { startDate: Date; endDate: Date } | null {
  const isoPair = handle.match(/\b(20\d{2}-\d{2}-\d{2})\b.*\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoPair) {
    const s = parseDateOnlyLocal(isoPair[1]);
    const e = parseDateOnlyLocal(isoPair[2]);
    if (s && e) return { startDate: s, endDate: e };
  }
  const re =
    /(?:^|-)(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)-(\d{1,2})-(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)-(\d{1,2})(?=-|$)/i;
  const m = handle.match(re);
  if (!m) return null;
  const mo1 = monthFromHandleToken(m[1]);
  const d1 = parseInt(m[2], 10);
  const mo2 = monthFromHandleToken(m[3]);
  const d2 = parseInt(m[4], 10);
  if (mo1 === undefined || mo2 === undefined) return null;
  const yearMatch = title.match(/\b(20\d{2})\b/) ?? handle.match(/\b(20\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();
  const startDate = new Date(year, mo1, d1);
  const endDate = new Date(year, mo2, d2);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return null;
  if (endDate < startDate) return null;
  return { startDate, endDate };
}

const TITLE_MONTH: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

function monthIndexFromName(token: string): number | undefined {
  const key = token.toLowerCase().replace(/[^a-z]/g, "");
  if (key.startsWith("sept")) return 8;
  return TITLE_MONTH[key.slice(0, 3)] ?? TITLE_MONTH[key];
}

function parseCrossMonthDateRangeFromTitle(
  title: string
): { startDate: Date; endDate: Date } | null {
  const yearMatch = title.match(/\b(20\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();
  const cross = title.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})\s*[-–—]\s*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})\b/i
  );
  if (!cross) return null;
  const mo1 = monthIndexFromName(cross[1]);
  const mo2 = monthIndexFromName(cross[3]);
  if (mo1 === undefined || mo2 === undefined) return null;
  const startDay = parseInt(cross[2], 10);
  const endDay = parseInt(cross[4], 10);
  const startDate = new Date(year, mo1, startDay);
  const endDate = new Date(year, mo2, endDay);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return null;
  if (endDate < startDate) return null;
  return { startDate, endDate };
}

function parseSameMonthDateRangeFromTitle(
  title: string
): { startDate: Date; endDate: Date } | null {
  const yearMatch = title.match(/\b(20\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();
  const monthNameMatch = title.match(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)(?:uary|ruary|ch|il|e|y|tember|ober|ember)?\b/i
  );
  if (!monthNameMatch) return null;
  const month = monthIndexFromName(monthNameMatch[1]);
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

function parseDateRangeFromTitle(
  title: string
): { startDate: Date; endDate: Date } | null {
  return parseCrossMonthDateRangeFromTitle(title) ?? parseSameMonthDateRangeFromTitle(title);
}

export function formatDateRange(start: Date | null, end: Date | null): string | null {
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

/** Extract dates from metafields (preferred), tags, title, or product handle. */
export function getEventDates(product: EventProduct): EventDates {
  const result: EventDates = { startDate: null, endDate: null, formatted: null };

  const metaMap = buildEventMetaMap(product.metafields ?? []);

  let startStr =
    metaMap["event.start_date"] ??
    metaMap["custom.start_date"] ??
    metaMap["start_date"] ??
    metaMap["start_date_iso"];
  let endStr =
    metaMap["event.end_date"] ??
    metaMap["custom.end_date"] ??
    metaMap["end_date"] ??
    metaMap["end_date_iso"];

  if (!startStr) {
    for (const tag of product.tags ?? []) {
      const m = tag.match(/^date[:=]([\d-]+)$/i);
      if (m) {
        startStr = m[1];
        break;
      }
    }
  }
  if (!endStr) {
    for (const tag of product.tags ?? []) {
      const m = tag.match(/^date-end[:=]([\d-]+)$/i);
      if (m) {
        endStr = m[1];
        break;
      }
    }
  }

  let startDate = startStr ? parseISODate(startStr) : null;
  let endDate = endStr ? parseISODate(endStr) : null;

  if (!startDate && product.title) {
    const parsed = parseDateRangeFromTitle(product.title);
    if (parsed) {
      startDate = parsed.startDate;
      endDate = parsed.endDate ?? parsed.startDate;
    }
  }

  if (!startDate && product.handle) {
    const fromHandle = parseDatesFromHandle(product.handle, product.title);
    if (fromHandle) {
      startDate = fromHandle.startDate;
      endDate = fromHandle.endDate;
    }
  }

  result.startDate = startDate;
  result.endDate = endDate;
  result.formatted = formatDateRange(startDate, endDate);
  return result;
}

export function startOfTodayLocal(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Hide after the event's last calendar day (end_date, or start_date when no end). */
export function isPastEvent(product: EventProduct): boolean {
  const { startDate, endDate } = getEventDates(product);
  const lastDay = endDate ?? startDate;
  if (!lastDay) return false;
  return lastDay.getTime() < startOfTodayLocal().getTime();
}

function eventSearchText(product: EventProduct): string {
  const tags = (product.tags ?? []).join(" ");
  return `${product.title} ${product.handle} ${tags}`.toLowerCase();
}

/** Classify event type from tags/title. Legacy Dirt Fest products map to gold_diggings. */
export function getEventType(product: EventProduct): EventTypeId {
  if (product.tags?.some((t) => t.toLowerCase() === "event-type:gold-diggings")) return "gold_diggings";
  if (product.tags?.some((t) => t.toLowerCase() === "event-type:dirt-party")) return "dirt_party";
  if (product.tags?.some((t) => t.toLowerCase() === "event-type:detector")) return "detector";

  const text = eventSearchText(product);
  if (/gold[\s_-]*diggin/.test(text)) return "gold_diggings";
  if (/dirt[\s_-]*party|dirtparty/.test(text)) return "dirt_party";
  if (/detector/.test(text)) return "detector";
  // Legacy naming still in Shopify
  if (/dirt[\s_-]*fest|dirtfest/.test(text)) return "gold_diggings";
  return "other";
}

export function getEventTypeLabel(typeId: EventTypeId): string {
  return EVENT_TYPES.find((t) => t.id === typeId)?.label ?? "Event";
}

export function matchesEventType(product: EventProduct, typeId: string): boolean {
  if (typeId === "all") return true;
  return getEventType(product) === typeId;
}

export function getCampSlug(product: EventProduct): string | null {
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
  const titleLower = product.title.toLowerCase();
  for (const slug of campSlugs) {
    const parts = slug.split("-");
    const nameParts = parts.length > 2 ? parts.slice(0, 2) : parts.slice(0, -1);
    if (nameParts.length >= 1 && nameParts.every((p) => titleLower.includes(p))) return slug;
  }
  return null;
}

export function getCampLabel(product: EventProduct): string | null {
  const slug = getCampSlug(product);
  if (!slug) return null;
  return CAMP_FILTERS.find((c) => c.id === slug)?.label ?? null;
}

/** Events with a known start date on or after today, soonest first. */
export function sortUpcomingEvents(events: EventProduct[]): EventProduct[] {
  const today = startOfTodayLocal().getTime();
  return events
    .filter((e) => !isPastEvent(e))
    .sort((a, b) => {
      const aStart = getEventDates(a).startDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bStart = getEventDates(b).startDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      if (aStart === Number.MAX_SAFE_INTEGER && bStart === Number.MAX_SAFE_INTEGER) return 0;
      if (aStart === Number.MAX_SAFE_INTEGER) return 1;
      if (bStart === Number.MAX_SAFE_INTEGER) return -1;
      return aStart - bStart;
    });
}

export function getNextUpcomingEvent(events: EventProduct[]): EventProduct | null {
  const upcoming = sortUpcomingEvents(events);
  return upcoming[0] ?? null;
}

/** VIP upsell applies to flagship multi-day camp events (Gold Diggin's, Dirt Party, legacy Dirt Fest). */
export function isVipUpsellEvent(product: EventProduct): boolean {
  const type = getEventType(product);
  return type === "gold_diggings" || type === "dirt_party";
}

export function getCardTitle(fullTitle: string): string {
  const idx = fullTitle.indexOf(" - ");
  return idx >= 0 ? fullTitle.slice(0, idx).trim() : fullTitle;
}
