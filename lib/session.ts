import { SignJWT, jwtVerify } from "jose";

const SESSION_COOKIE = "member_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type MemberSession = {
  memberNumber: string;
  email: string;
  contactId?: string;
  exp: number;
};

/** Returns the session secret; throws in production if unset (use for creating sessions). */
export function getSessionSecret(): string {
  const secret = process.env.MEMBER_SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "development") {
      return "dev-session-secret-change-in-production";
    }
    throw new Error("MEMBER_SESSION_SECRET is not set");
  }
  return secret;
}

/** Returns the session secret or null if unset. Use in verifySessionToken so missing env does not crash the page. */
function getSessionSecretOrNull(): string | null {
  const secret = process.env.MEMBER_SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "development") {
      return "dev-session-secret-change-in-production";
    }
    return null;
  }
  return secret;
}

export async function createSessionToken(
  payload: Omit<MemberSession, "exp">
): Promise<string> {
  const secret = new TextEncoder().encode(getSessionSecret());
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${MAX_AGE}s`)
    .setIssuedAt()
    .sign(secret);
}

export async function verifySessionToken(
  token: string
): Promise<MemberSession | null> {
  try {
    const secretValue = getSessionSecretOrNull();
    if (!secretValue) return null;
    const secret = new TextEncoder().encode(secretValue);
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as MemberSession;
  } catch {
    return null;
  }
}

export function sessionCookieName(): string {
  return SESSION_COOKIE;
}

export function sessionCookieOptions(token: string): {
  name: string;
  value: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  maxAge: number;
  path: string;
} {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  };
}
