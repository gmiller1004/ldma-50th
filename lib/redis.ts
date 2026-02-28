import { Redis } from "@upstash/redis";

const CODE_PREFIX = "member_code:";
const CODE_TTL_SECONDS = 10 * 60; // 10 minutes

// Dev fallback when Redis not configured
const devStore = new Map<
  string,
  { payload: string; expires: number }
>();

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

/** Store a 6-digit code for a member lookup result. Returns true if stored. */
export async function storeAuthCode(
  memberNumber: string,
  code: string,
  payload: { email: string; contactId?: string }
): Promise<boolean> {
  const redis = getRedis();
  const data = JSON.stringify({ memberNumber, ...payload });
  if (redis) {
    const key = `${CODE_PREFIX}${code}`;
    await redis.set(key, data, { ex: CODE_TTL_SECONDS });
    return true;
  }
  if (process.env.NODE_ENV === "development") {
    const key = `${CODE_PREFIX}${code}`;
    devStore.set(key, {
      payload: data,
      expires: Date.now() + CODE_TTL_SECONDS * 1000,
    });
    return true;
  }
  return false;
}

/** Verify code and return payload if valid. Deletes the code on success. */
export async function verifyAuthCode(
  code: string
): Promise<{ memberNumber: string; email: string; contactId?: string } | null> {
  const redis = getRedis();
  const key = `${CODE_PREFIX}${code}`;

  if (redis) {
    const raw = await redis.get<string>(key);
    if (!raw) return null;
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    await redis.del(key);
    return parsed as { memberNumber: string; email: string; contactId?: string };
  }

  if (process.env.NODE_ENV === "development") {
    const entry = devStore.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      devStore.delete(key);
      return null;
    }
    devStore.delete(key);
    return JSON.parse(entry.payload) as {
      memberNumber: string;
      email: string;
      contactId?: string;
    };
  }

  return null;
}

export function isRedisConfigured(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}
