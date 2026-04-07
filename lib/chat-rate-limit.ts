import { getRedis } from "@/lib/redis";

const WINDOW_SEC = 60;

function limitFor(kind: "chat" | "finalize"): number {
  if (kind === "finalize") {
    const raw = process.env.CHAT_RATE_LIMIT_FINALIZE_PER_MINUTE;
    if (raw && /^\d+$/.test(raw.trim())) return parseInt(raw.trim(), 10);
    return 12;
  }
  const raw = process.env.CHAT_RATE_LIMIT_CHAT_PER_MINUTE;
  if (raw && /^\d+$/.test(raw.trim())) return parseInt(raw.trim(), 10);
  return 24;
}

type MemEntry = { count: number; resetAt: number };
const memory = new Map<string, MemEntry>();

/**
 * Sliding-window–style limit using Redis INCR + TTL or in-memory fallback.
 */
export async function checkChatRateLimit(
  ip: string,
  kind: "chat" | "finalize"
): Promise<{ ok: boolean; retryAfterSeconds?: number }> {
  if (process.env.CHAT_RATE_LIMIT_DISABLED === "1") {
    return { ok: true };
  }

  const limit = limitFor(kind);
  const key = `chat:rl:${kind}:${ip}`;
  const redis = getRedis();

  if (redis) {
    try {
      const n = await redis.incr(key);
      if (n === 1) {
        await redis.expire(key, WINDOW_SEC);
      }
      if (n > limit) {
        return { ok: false, retryAfterSeconds: WINDOW_SEC };
      }
      return { ok: true };
    } catch (e) {
      console.error("[chat-rate-limit] Redis error:", e);
    }
  }

  const now = Date.now();
  const memKey = `${kind}:${ip}`;
  let entry = memory.get(memKey);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_SEC * 1000 };
    memory.set(memKey, entry);
  }
  entry.count += 1;
  if (entry.count > limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }
  return { ok: true };
}

export function getClientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first.slice(0, 128);
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim().slice(0, 128);
  return "unknown";
}
