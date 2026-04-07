import { NextResponse } from "next/server";
import { subscribeEmailToKlaviyoMarketing } from "@/lib/klaviyo-marketing-subscribe";
import { sendChatTranscriptEmail } from "@/lib/sendgrid";
import { checkChatRateLimit, getClientIp } from "@/lib/chat-rate-limit";

export const maxDuration = 60;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_MESSAGES = 40;
const MAX_CONTENT = 12000;

type ClientMsg = { role?: string; content?: string };

function sanitizeMessages(raw: unknown): { role: string; content: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { role: string; content: string }[] = [];
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
  const rl = await checkChatRateLimit(ip, "finalize");
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before sending again." },
      {
        status: 429,
        headers: rl.retryAfterSeconds
          ? { "Retry-After": String(rl.retryAfterSeconds) }
          : undefined,
      }
    );
  }

  const sendgridConfigured = !!process.env.SENDGRID_API_KEY;
  const klaviyoConfigured = !!process.env.KLAVIYO_PRIVATE_API_KEY;

  if (!sendgridConfigured && process.env.NODE_ENV !== "development") {
    console.error("[chat/finalize] SENDGRID_API_KEY not set");
    return NextResponse.json(
      { error: "Transcript email is not configured." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email =
    typeof (body as { email?: string }).email === "string"
      ? (body as { email: string }).email.trim().toLowerCase()
      : "";

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "A valid email is required." },
      { status: 400 }
    );
  }

  const messages = sanitizeMessages((body as { messages?: unknown }).messages);
  if (messages.length === 0) {
    return NextResponse.json(
      { error: "Nothing to send." },
      { status: 400 }
    );
  }

  const sent = await sendChatTranscriptEmail(email, messages);
  if (!sent) {
    return NextResponse.json(
      { error: "Could not send the email. Please try again." },
      { status: 502 }
    );
  }

  if (klaviyoConfigured) {
    const kv = await subscribeEmailToKlaviyoMarketing(email, "chat");
    if (!kv.ok) {
      console.error("[chat/finalize] Klaviyo failed:", kv.error);
    }
  }

  return NextResponse.json({ success: true });
}
