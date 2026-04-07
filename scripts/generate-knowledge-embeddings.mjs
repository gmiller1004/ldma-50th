#!/usr/bin/env node
/**
 * Generates lib/ldma-knowledge-embeddings.json from lib/ldma-knowledge-chunks.ts
 * via OpenRouter (openai/text-embedding-3-small by default).
 *
 * Requires OPENROUTER_API_KEY in .env.local (see package.json script).
 * Optional: OPENROUTER_EMBEDDING_MODEL, OPENROUTER_HTTP_REFERER, OPENROUTER_APP_TITLE
 *
 * Chunk text must match lib/knowledge-embeddings.ts chunkTextForEmbedding().
 *
 * Usage: npm run generate:knowledge-embeddings
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const CHUNKS_TS = path.join(ROOT, "lib", "ldma-knowledge-chunks.ts");
const OUT_JSON = path.join(ROOT, "lib", "ldma-knowledge-embeddings.json");

const OPENROUTER_EMBEDDINGS_URL = "https://openrouter.ai/api/v1/embeddings";
const DEFAULT_MODEL = "openai/text-embedding-3-small";

function modelName() {
  return process.env.OPENROUTER_EMBEDDING_MODEL?.trim() || DEFAULT_MODEL;
}

function headers(apiKey) {
  const h = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  const referer = process.env.OPENROUTER_HTTP_REFERER?.trim();
  if (referer) h["HTTP-Referer"] = referer;
  const title = process.env.OPENROUTER_APP_TITLE?.trim();
  if (title) h["X-Title"] = title;
  return h;
}

/** Align with lib/knowledge-embeddings.ts chunkTextForEmbedding */
function chunkTextForEmbedding({ title, topics, content }) {
  return `${title}\n${topics.join(" ")}\n${content}`.slice(0, 8000);
}

function parseTopicsArray(topicsRaw) {
  const out = [];
  const re = /"([^"]*)"/g;
  let m;
  while ((m = re.exec(topicsRaw))) out.push(m[1]);
  return out;
}

function parseChunksFromTs(source) {
  const chunks = [];
  const re =
    /\{\s*id:\s*"([^"]+)"\s*,\s*topics:\s*\[([^\]]*)\]\s*,\s*title:\s*"([^"]*)"\s*,\s*source:\s*"[^"]*"\s*,\s*content:\s*`([^`]*)`/g;
  let m;
  while ((m = re.exec(source))) {
    const id = m[1];
    const topics = parseTopicsArray(m[2]);
    const title = m[3];
    const content = m[4];
    const text = chunkTextForEmbedding({ title, topics, content });
    chunks.push({ id, text });
  }
  return chunks;
}

async function embedBatch(apiKey, inputs) {
  const res = await fetch(OPENROUTER_EMBEDDINGS_URL, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify({
      model: modelName(),
      input: inputs,
      encoding_format: "float",
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `HTTP ${res.status}`);
  }
  const list = data.data;
  if (!Array.isArray(list)) throw new Error("Invalid embeddings response");
  list.sort((a, b) => a.index - b.index);
  return list.map((x) => x.embedding);
}

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("Set OPENROUTER_API_KEY");
    process.exit(1);
  }

  const src = fs.readFileSync(CHUNKS_TS, "utf8");
  const chunks = parseChunksFromTs(src);
  if (chunks.length === 0) {
    console.error("No chunks parsed from", CHUNKS_TS);
    process.exit(1);
  }
  console.log("Parsed", chunks.length, "chunks");

  const inputs = chunks.map((c) => c.text);
  const embeddings = await embedBatch(apiKey, inputs);

  if (embeddings.length !== chunks.length) {
    throw new Error("Embedding count mismatch");
  }

  const dim = embeddings[0]?.length ?? 0;
  const model = modelName();
  const out = {
    model,
    dimensions: dim,
    entries: chunks.map((c, i) => ({
      id: c.id,
      embedding: embeddings[i],
    })),
  };

  fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 0) + "\n", "utf8");
  console.log("Wrote", OUT_JSON, "dim=", dim, "model=", model);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
