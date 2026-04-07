import type { KnowledgeChunk } from "@/lib/ldma-knowledge-chunks";
import { LDMA_KNOWLEDGE_CHUNKS } from "@/lib/ldma-knowledge-chunks";
import {
  cosineSimilarity,
  embedQueryForKnowledge,
  getChunkEmbeddingMap,
} from "@/lib/knowledge-embeddings";
import {
  expandQueryTokens,
  preprocessQueryForKnowledge,
} from "@/lib/knowledge-synonyms";

/** Rough token estimate for English text (conservative for budgeting). */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

const STOPWORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "can", "was", "one",
  "our", "out", "day", "get", "has", "how", "its", "may", "new", "now", "old",
  "see", "two", "who", "way", "with", "from", "have", "this", "that", "what",
  "when", "where", "will", "your", "about", "into", "just", "like", "more",
  "some", "than", "them", "then", "these", "they", "want", "were", "which",
  "would", "there", "their", "does", "did", "any", "she", "her", "his",
]);

function tokenize(s: string): string[] {
  const m = s.toLowerCase().match(/[a-z0-9]+/g);
  return m ?? [];
}

function scoreChunk(queryTokens: string[], chunk: KnowledgeChunk): number {
  let score = 0;
  const idLower = chunk.id.toLowerCase();
  const contentLower = chunk.content.toLowerCase();
  const titleTok = tokenize(chunk.title);

  for (const q of queryTokens) {
    if (q.length < 2 || STOPWORDS.has(q)) continue;

    for (const t of chunk.topics) {
      const tl = t.toLowerCase();
      if (tl === q || tl.includes(q) || q.includes(tl)) score += 6;
    }
    if (idLower.includes(q)) score += 4;

    for (const tw of titleTok) {
      if (tw === q || tw.startsWith(q) || q.startsWith(tw)) score += 4;
    }

    if (contentLower.includes(q)) score += 1;
  }

  return score;
}

/** Last few user turns → search query (capped). */
export function buildSearchQueryFromMessages(
  messages: Array<{ role: string; content: string }>,
  maxChars = 2000
): string {
  const userParts = messages
    .filter((m) => m.role === "user")
    .slice(-4)
    .map((m) => m.content.trim())
    .filter(Boolean);
  return userParts.join("\n").slice(0, maxChars);
}

const FALLBACK_IDS = ["site-identity", "about-ldma", "contact-and-phone"] as const;

function chunkById(id: string): KnowledgeChunk | undefined {
  return LDMA_KNOWLEDGE_CHUNKS.find((c) => c.id === id);
}

function formatChunkBlock(chunk: KnowledgeChunk): string {
  return `[${chunk.id}] ${chunk.title} (${chunk.source})\n${chunk.content}`;
}

export type SearchKnowledgeOptions = {
  maxContextTokens?: number;
  maxChunks?: number;
};

export type SearchKnowledgeResult = {
  chunks: KnowledgeChunk[];
  contextBlock: string;
  estimatedContextTokens: number;
};

const KNOWLEDGE_PREAMBLE = `The following excerpts are from myldma.com public pages. Prefer them for factual details (camps, events, membership themes, contact). If a topic is not covered here, follow your other instructions (including the phone fallback).`;

function hybridEmbeddingWeight(): number {
  const raw = process.env.KNOWLEDGE_HYBRID_EMBEDDING_WEIGHT?.trim();
  if (raw) {
    const w = parseFloat(raw);
    if (!Number.isNaN(w) && w >= 0 && w <= 1) return w;
  }
  return 0.58;
}

/**
 * Score and select knowledge chunks within a token budget.
 * Uses synonym-expanded keywords + optional embedding hybrid when
 * `lib/ldma-knowledge-embeddings.json` is populated and `OPENROUTER_API_KEY` is set.
 */
export async function searchKnowledge(
  query: string,
  options: SearchKnowledgeOptions = {}
): Promise<SearchKnowledgeResult> {
  const maxContextTokens =
    typeof process.env.KNOWLEDGE_CONTEXT_TOKEN_BUDGET === "string" &&
    /^\d+$/.test(process.env.KNOWLEDGE_CONTEXT_TOKEN_BUDGET.trim())
      ? parseInt(process.env.KNOWLEDGE_CONTEXT_TOKEN_BUDGET.trim(), 10)
      : options.maxContextTokens ?? 2800;

  const maxChunks = options.maxChunks ?? 8;

  const q = preprocessQueryForKnowledge(query);
  const queryLower = q.toLowerCase();
  const baseTokens = tokenize(q);
  const queryTokens = expandQueryTokens(baseTokens, queryLower);

  const keywordScored = LDMA_KNOWLEDGE_CHUNKS.map((chunk) => ({
    chunk,
    kw: scoreChunk(queryTokens, chunk),
  }));

  const maxKw = Math.max(...keywordScored.map((x) => x.kw), 0);

  const embMap = getChunkEmbeddingMap();
  const hasKey = Boolean(process.env.OPENROUTER_API_KEY);
  const qVec = embMap && hasKey ? await embedQueryForKnowledge(q) : null;

  const wEmb = hybridEmbeddingWeight();

  type Ranked = { chunk: KnowledgeChunk; sortKey: number; kw: number };
  let ranked: Ranked[];

  if (qVec && embMap) {
    ranked = keywordScored.map(({ chunk, kw }) => {
      const vec = embMap.get(chunk.id);
      const emb = vec ? cosineSimilarity(qVec, vec) : 0;
      const kwNorm = maxKw > 0 ? kw / maxKw : 0;
      const sortKey = wEmb * emb + (1 - wEmb) * kwNorm;
      return { chunk, sortKey, kw };
    });
    ranked.sort((a, b) => b.sortKey - a.sortKey);
  } else {
    ranked = keywordScored.map(({ chunk, kw }) => ({
      chunk,
      sortKey: kw,
      kw,
    }));
    ranked.sort((a, b) => b.sortKey - a.sortKey);
  }

  let ordered: KnowledgeChunk[];
  if (maxKw === 0 && !qVec) {
    ordered = FALLBACK_IDS.map((id) => chunkById(id)).filter(
      Boolean
    ) as KnowledgeChunk[];
  } else {
    ordered = ranked.map((r) => r.chunk);
  }

  const preambleTokens = estimateTokens(KNOWLEDGE_PREAMBLE + "\n\n");
  let budgetLeft = Math.max(0, maxContextTokens - preambleTokens);
  const selected: KnowledgeChunk[] = [];
  const seen = new Set<string>();

  for (const chunk of ordered) {
    if (selected.length >= maxChunks) break;
    if (seen.has(chunk.id)) continue;

    const block = formatChunkBlock(chunk);
    const separator = selected.length > 0 ? "\n\n---\n\n" : "";
    const addTokens = estimateTokens(separator + block);

    if (addTokens > budgetLeft && selected.length > 0) break;
    if (addTokens > budgetLeft && selected.length === 0) {
      selected.push(chunk);
      seen.add(chunk.id);
      budgetLeft = 0;
      break;
    }

    selected.push(chunk);
    seen.add(chunk.id);
    budgetLeft -= addTokens;
  }

  const contextBody =
    selected.length === 0
      ? ""
      : selected.map(formatChunkBlock).join("\n\n---\n\n");

  const contextBlock =
    selected.length === 0
      ? ""
      : `${KNOWLEDGE_PREAMBLE}\n\n${contextBody}`;

  return {
    chunks: selected,
    contextBlock,
    estimatedContextTokens: estimateTokens(contextBlock),
  };
}
