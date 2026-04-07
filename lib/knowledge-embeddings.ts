import { readFileSync } from "fs";
import { join } from "path";
import type { KnowledgeChunk } from "@/lib/ldma-knowledge-chunks";

const OPENROUTER_EMBEDDINGS_URL = "https://openrouter.ai/api/v1/embeddings";
const DEFAULT_EMBEDDING_MODEL = "openai/text-embedding-3-small";
const MAX_INPUT_CHARS = 8000;

function embeddingModel(): string {
  return (
    process.env.OPENROUTER_EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL
  );
}

export type StoredEmbeddingsFile = {
  model: string;
  dimensions: number;
  entries: Array<{ id: string; embedding: number[] }>;
};

let cachedFile: StoredEmbeddingsFile | null | undefined;

function loadEmbeddingsFile(): StoredEmbeddingsFile | null {
  if (cachedFile !== undefined) return cachedFile;
  try {
    const path = join(process.cwd(), "lib", "ldma-knowledge-embeddings.json");
    const raw = readFileSync(path, "utf8");
    cachedFile = JSON.parse(raw) as StoredEmbeddingsFile;
    return cachedFile;
  } catch {
    cachedFile = null;
    return null;
  }
}

/** Map chunk id → vector; null if file missing or empty. */
export function getChunkEmbeddingMap(): Map<string, number[]> | null {
  const file = loadEmbeddingsFile();
  if (!file?.entries?.length) return null;
  const m = new Map<string, number[]>();
  for (const e of file.entries) {
    if (e.id && Array.isArray(e.embedding) && e.embedding.length > 0) {
      m.set(e.id, e.embedding);
    }
  }
  return m.size > 0 ? m : null;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d === 0 ? 0 : dot / d;
}

function openRouterHeaders(apiKey: string): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  const referer = process.env.OPENROUTER_HTTP_REFERER?.trim();
  if (referer) h["HTTP-Referer"] = referer;
  const title = process.env.OPENROUTER_APP_TITLE?.trim();
  if (title) h["X-Title"] = title;
  return h;
}

/** Embed search query via OpenRouter (text-embedding-3-small). Returns null if no key or error. */
export async function embedQueryForKnowledge(
  text: string
): Promise<number[] | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const input = text.trim().slice(0, MAX_INPUT_CHARS);
  if (!input) return null;

  try {
    const res = await fetch(OPENROUTER_EMBEDDINGS_URL, {
      method: "POST",
      headers: openRouterHeaders(apiKey),
      body: JSON.stringify({
        model: embeddingModel(),
        input,
        encoding_format: "float",
      }),
    });

    const data = (await res.json()) as {
      data?: Array<{ embedding?: number[] }>;
      error?: { message?: string };
    };

    if (!res.ok) {
      console.error(
        "[knowledge] OpenRouter embeddings error:",
        res.status,
        data?.error?.message
      );
      return null;
    }

    const emb = data.data?.[0]?.embedding;
    if (!emb?.length) return null;
    return emb;
  } catch (e) {
    console.error("[knowledge] embedQueryForKnowledge:", e);
    return null;
  }
}

/** Text used for chunk embedding in the generator (keep in sync with script). */
export function chunkTextForEmbedding(chunk: KnowledgeChunk): string {
  return `${chunk.title}\n${chunk.topics.join(" ")}\n${chunk.content}`;
}

export function embeddingModelId(): string {
  return embeddingModel();
}
