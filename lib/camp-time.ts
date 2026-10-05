/**
 * Camp-local calendar dates. Camp slugs end in their state (e.g. "stanton-arizona"),
 * so the time zone is derived from the slug without loading camp page data.
 */

const EASTERN_STATES = ["georgia", "north-carolina", "south-carolina"];

export function campTimeZone(campSlug?: string | null): string {
  const slug = (campSlug ?? "").trim().toLowerCase();
  if (slug.endsWith("arizona")) return "America/Phoenix";
  if (EASTERN_STATES.some((state) => slug.endsWith(state))) return "America/New_York";
  return "America/Los_Angeles";
}

/** Calendar date (YYYY-MM-DD) at the camp right now. Defaults to Pacific when no camp is known. */
export function campTodayStr(campSlug?: string | null, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: campTimeZone(campSlug),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
