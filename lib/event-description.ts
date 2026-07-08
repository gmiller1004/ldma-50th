/**
 * Parse Shopify event description HTML into structured sections for product pages.
 */

export type EventDescriptionSection = {
  level: 2 | 3;
  title: string;
  html: string;
  bullets: string[];
};

export type ParsedEventDescription = {
  introHtml: string | null;
  sections: EventDescriptionSection[];
  highlights: string[];
  plainTextSummary: string;
};

function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

/**
 * Balance an HTML fragment so it has valid nesting: drop orphan closing tags and
 * append closing tags for anything left open. Slicing raw Shopify HTML by heading
 * position frequently splits wrapper elements (e.g. a centered <div>), which the
 * browser silently repairs — causing React hydration mismatches. Repairing here
 * keeps server and client markup identical.
 */
function balanceHtml(fragment: string): string {
  const stack: string[] = [];
  const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?(\/?)>/g;
  let out = "";
  let lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = tagRegex.exec(fragment)) !== null) {
    const full = m[0];
    const name = m[1]!.toLowerCase();
    const isClose = full.startsWith("</");
    const selfClose = m[2] === "/" || VOID_ELEMENTS.has(name);

    out += fragment.slice(lastIndex, m.index);
    lastIndex = m.index + full.length;

    if (isClose) {
      const idx = stack.lastIndexOf(name);
      if (idx === -1) {
        // Orphan closing tag (opener was sliced off) — drop it.
        continue;
      }
      // Close any tags left open inside this one, then the tag itself.
      for (let j = stack.length - 1; j > idx; j--) {
        out += `</${stack[j]}>`;
      }
      stack.length = idx;
      out += full;
    } else {
      out += full;
      if (!selfClose) stack.push(name);
    }
  }

  out += fragment.slice(lastIndex);
  for (let i = stack.length - 1; i >= 0; i--) {
    out += `</${stack[i]}>`;
  }
  return out;
}

function extractBullets(html: string): string[] {
  const bullets: string[] = [];
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let match: RegExpExecArray | null;
  while ((match = liRegex.exec(html)) !== null) {
    const text = stripTags(match[1]);
    if (text) bullets.push(text);
  }
  return bullets;
}

/** Split Shopify description HTML into intro + headed sections with bullet highlights. */
export function parseEventDescriptionHtml(html: string | null | undefined): ParsedEventDescription {
  const raw = (html ?? "").trim();
  if (!raw) {
    return { introHtml: null, sections: [], highlights: [], plainTextSummary: "" };
  }

  const highlights = extractBullets(raw);
  const plainTextSummary = stripTags(raw).slice(0, 320);

  const headingRegex = /<h([23])[^>]*>([\s\S]*?)<\/h\1>/gi;
  const matches = [...raw.matchAll(headingRegex)];

  if (matches.length === 0) {
    return {
      introHtml: balanceHtml(raw),
      sections: [],
      highlights,
      plainTextSummary,
    };
  }

  const sections: EventDescriptionSection[] = [];
  const firstHeadingIndex = matches[0]!.index ?? 0;
  const introRaw = raw.slice(0, firstHeadingIndex).trim();
  const introHtml = introRaw ? balanceHtml(introRaw) : null;

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]!;
    const level = parseInt(match[1], 10) as 2 | 3;
    const title = stripTags(match[2]);
    const contentStart = (match.index ?? 0) + match[0].length;
    const contentEnd =
      i + 1 < matches.length ? (matches[i + 1]!.index ?? raw.length) : raw.length;
    const sectionHtml = raw.slice(contentStart, contentEnd).trim();
    if (!title && !sectionHtml) continue;
    sections.push({
      level,
      title,
      html: sectionHtml ? balanceHtml(sectionHtml) : "",
      bullets: extractBullets(sectionHtml),
    });
  }

  return { introHtml, sections, highlights, plainTextSummary };
}
