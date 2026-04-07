/**
 * Query normalization and synonym expansion for knowledge retrieval.
 */

/** Normalize common phrases so tokenization matches chunk vocabulary. */
export function preprocessQueryForKnowledge(query: string): string {
  return (
    query
      .replace(/\bdirt\s*fest\b/gi, "dirtfest")
      .replace(/\bdirt[\s_-]?fest\b/gi, "dirtfest")
      .replace(/\bgold\s*n\s*bbq\b/gi, "gold n bbq")
      .replace(/\b50\s*th\b/gi, "50th")
      .replace(/\bmy\s*ldma\b/gi, "myldma")
      .replace(/\bldma\s*50\b/gi, "50th ldma")
      .replace(/\bvein\s*mtn\b/gi, "vein mountain")
      .replace(/\bblue\s*bucket\b/gi, "blue-bucket")
      .replace(/\bburnt\s*river\b/gi, "burnt-river")
      .replace(/\bloud\s*mine\b/gi, "loud-mine")
      .replace(/\bvein\s*mountain\b/gi, "vein-mountain")
      .replace(/\bitalian\s*bar\b/gi, "italian-bar")
  );
}

/**
 * Equivalence groups: if the query matches any member (token or substring),
 * add all group tokens for scoring (deduped).
 */
export const SYNONYM_GROUPS: string[][] = [
  ["dirtfest", "dirtfest2026", "dirt-fest"],
  ["membership", "member", "members", "join", "lifetime"],
  ["campground", "campgrounds", "camp", "camps", "camping"],
  ["prospect", "prospecting", "gold", "mining", "claim", "claims"],
  ["detector", "detecting", "metal"],
  ["shop", "merch", "merchandise", "store"],
  ["event", "events", "tickets", "registration"],
  ["stanton", "stanton-arizona", "arizona", "congress"],
  ["italian-bar", "italian", "columbia", "stanislaus"],
  ["duisenburg", "duisenburg-california", "ridgecrest", "mojave", "randsburg"],
  ["blue-bucket", "huntington"],
  ["burnt-river", "durkee"],
  ["oconee", "oconee-south-carolina", "tamassee"],
  ["loud-mine", "dahlonega", "cleveland", "georgia"],
  ["vein-mountain", "nebo", "carolina"],
  ["contact", "phone", "call", "email", "lostdutchman"],
  ["faq", "question", "questions"],
  ["ldma", "lost", "dutchman", "association"],
];

function groupMatchesQuery(
  group: string[],
  tokens: string[],
  queryLower: string
): boolean {
  for (const g of group) {
    const gLower = g.toLowerCase();
    if (gLower.includes(" ")) {
      if (queryLower.includes(gLower)) return true;
      continue;
    }
    if (tokens.includes(gLower)) return true;
    if (queryLower.includes(gLower) && gLower.length >= 4) return true;
  }
  return false;
}

export function expandQueryTokens(tokens: string[], queryLower: string): string[] {
  const set = new Set(tokens.map((t) => t.toLowerCase()));

  for (const group of SYNONYM_GROUPS) {
    if (!groupMatchesQuery(group, tokens, queryLower)) continue;
    for (const g of group) {
      const gLower = g.toLowerCase();
      for (const part of gLower.split(/\s+/)) {
        if (part.length >= 2) set.add(part);
      }
      if (!gLower.includes(" ")) set.add(gLower);
    }
  }

  return [...set];
}
