import { NextResponse } from "next/server";
import {
  LDMA_CHAT_MODEL,
  LDMA_CHAT_SYSTEM_PROMPT,
  LDMA_CHAT_TEMPERATURE,
} from "@/lib/ldma-chat-system-prompt";
import {
  buildSearchQueryFromMessages,
  searchKnowledge,
} from "@/lib/search-knowledge";
import { checkChatRateLimit, getClientIp } from "@/lib/chat-rate-limit";

export const maxDuration = 120;

const XAI_URL = "https://api.x.ai/v1/chat/completions";
const MAX_MESSAGES = 24;
const MAX_CONTENT = 12000;

type ClientMsg = { role?: string; content?: string };

function sanitizeMessages(raw: unknown): { role: "user" | "assistant"; content: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of raw.slice(-MAX_MESSAGES)) {
    if (!m || typeof m !== "object") continue;
    const role = (m as ClientMsg).role;
    const content = (m as ClientMsg).content;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string") continue;
    const trimmed = content.slice(0, MAX_CONTENT);
    if (!trimmed.trim()) continue;
    out.push({ role, content: trimmed });
  }
  return out;
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await checkChatRateLimit(ip, "chat");
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many messages. Please wait a minute and try again." },
      {
        status: 429,
        headers: rl.retryAfterSeconds
          ? { "Retry-After": String(rl.retryAfterSeconds) }
          : undefined,
      }
    );
  }

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    console.error("[chat] XAI_API_KEY not set");
    return NextResponse.json(
      { error: "Chat is not available right now." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const messages = sanitizeMessages(
    (body as { messages?: unknown })?.messages
  );
  if (messages.length === 0) {
    return NextResponse.json(
      { error: "Send at least one message." },
      { status: 400 }
    );
  }

  const model =
    typeof process.env.XAI_CHAT_MODEL === "string" &&
    process.env.XAI_CHAT_MODEL.trim()
      ? process.env.XAI_CHAT_MODEL.trim()
      : LDMA_CHAT_MODEL;

  const searchQuery = buildSearchQueryFromMessages(messages);
  const { contextBlock } = await searchKnowledge(searchQuery);

  const systemContent = contextBlock
    ? `${LDMA_CHAT_SYSTEM_PROMPT}\n\n---\n\n${contextBlock}`
    : LDMA_CHAT_SYSTEM_PROMPT;

  try {
    const res = await fetch(XAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemContent },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
        temperature: LDMA_CHAT_TEMPERATURE,
        max_tokens: 4096,
      }),
    });

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    if (!res.ok) {
      console.error("[chat] xAI error:", res.status, JSON.stringify(data).slice(0, 500));
      return NextResponse.json(
        { error: "The assistant could not reply. Please try again." },
        { status: 502 }
      );
    }

    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) {
      console.error("[chat] empty completion", JSON.stringify(data).slice(0, 300));
      return NextResponse.json(
        { error: "Empty response from assistant." },
        { status: 502 }
      );
    }

    return NextResponse.json({ message: text });
  } catch (e) {
    console.error("[chat] fetch error:", e);
    return NextResponse.json(
      { error: "Chat request failed. Please try again." },
      { status: 500 }
    );
  }
}
