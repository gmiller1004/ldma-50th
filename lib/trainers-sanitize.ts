import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "h1",
  "h2",
  "h3",
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "a",
  "ul",
  "ol",
  "li",
  "blockquote",
];

const SAFE_HREF = /^(https?:|mailto:|tel:)/i;

/**
 * Sanitize trainer bio HTML. Allows a small set of formatting tags and only
 * http(s), mailto, and tel links. Strips style, class, and script.
 */
export function sanitizeTrainerHtml(html: string | null | undefined): string {
  if (html == null) return "";
  const cleaned = sanitizeHtml(String(html), {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "rel", "target"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: {
      a: ["http", "https", "mailto", "tel"],
    },
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    transformTags: {
      a: (tagName, attribs) => {
        const href = (attribs.href ?? "").trim();
        if (!SAFE_HREF.test(href)) {
          return { tagName: "span", attribs: {} };
        }
        const isExternal = /^https?:/i.test(href);
        const next: Record<string, string> = {
          href,
          rel: "noopener noreferrer",
        };
        if (isExternal) next.target = "_blank";
        return { tagName, attribs: next };
      },
    },
  });

  return cleaned
    .replace(/<span>/gi, "")
    .replace(/<\/span>/gi, "")
    .trim();
}

/** Plain text for summaries and other non-HTML fields. */
export function trainerPlainText(value: string | null | undefined): string {
  if (value == null) return "";
  return sanitizeHtml(String(value), {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\s+/g, " ")
    .trim();
}
