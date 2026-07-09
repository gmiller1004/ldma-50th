import { SignJWT, jwtVerify } from "jose";

const PAY_TOKEN_MAX_AGE_SEC = 60 * 60 * 24 * 120; // 120 days

function getPayTokenSecret(): string {
  const secret =
    process.env.RESERVATION_PAY_TOKEN_SECRET ||
    process.env.MEMBER_SESSION_SECRET ||
    (process.env.NODE_ENV === "development" ? "dev-session-secret-change-in-production" : "");
  if (!secret) {
    throw new Error("RESERVATION_PAY_TOKEN_SECRET or MEMBER_SESSION_SECRET is not set");
  }
  return secret;
}

export async function createReservationPayToken(reservationId: string): Promise<string> {
  const secret = new TextEncoder().encode(getPayTokenSecret());
  return new SignJWT({ reservationId, purpose: "reservation_pay" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${PAY_TOKEN_MAX_AGE_SEC}s`)
    .setIssuedAt()
    .sign(secret);
}

export async function verifyReservationPayToken(
  token: string
): Promise<{ reservationId: string } | null> {
  try {
    const secret = new TextEncoder().encode(getPayTokenSecret());
    const { payload } = await jwtVerify(token, secret);
    if (payload.purpose !== "reservation_pay") return null;
    const reservationId = payload.reservationId;
    if (typeof reservationId !== "string" || !reservationId.trim()) return null;
    return { reservationId: reservationId.trim() };
  } catch {
    return null;
  }
}
