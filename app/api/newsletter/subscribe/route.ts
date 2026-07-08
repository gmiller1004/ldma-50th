import { NextResponse } from "next/server";
import { subscribeEmailToKlaviyoMarketing } from "@/lib/klaviyo-marketing-subscribe";

const ALLOWED_SOURCES = new Set(["home", "events", "discover_events"]);

function normalizeSignupSource(raw: unknown): "home" | "events" | "discover_events" {
  if (typeof raw !== "string") return "home";
  const s = raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return ALLOWED_SOURCES.has(s) ? (s as "home" | "events" | "discover_events") : "home";
}

function sanitizeProperty(raw: unknown, maxLen = 64): string | undefined {
  if (typeof raw !== "string") return undefined;
  const s = raw.trim().slice(0, maxLen);
  return s.length > 0 ? s : undefined;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const signupSource = normalizeSignupSource(body.signup_source);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
        { status: 400 }
      );
    }

    if (!process.env.KLAVIYO_PRIVATE_API_KEY) {
      console.error("[newsletter] KLAVIYO_PRIVATE_API_KEY not set");
      return NextResponse.json(
        { error: "Newsletter signup is not configured" },
        { status: 503 }
      );
    }

    const extra: Record<string, string> = {};
    const interestPath = sanitizeProperty(body.interest_path);
    const referrerCta = sanitizeProperty(body.referrer_cta);
    const campInterest = sanitizeProperty(body.camp_interest);
    const eventTypeInterest = sanitizeProperty(body.event_type_interest);
    if (interestPath) extra.interest_path = interestPath;
    if (referrerCta) extra.referrer_cta = referrerCta;
    if (campInterest) extra.camp_interest = campInterest;
    if (eventTypeInterest) extra.event_type_interest = eventTypeInterest;

    const result = await subscribeEmailToKlaviyoMarketing(
      email,
      signupSource,
      Object.keys(extra).length > 0 ? extra : undefined
    );
    if (!result.ok) {
      const status =
        result.status === 429 ? 429 : result.status === 503 ? 503 : 502;
      return NextResponse.json(
        { error: result.error || "Unable to subscribe. Please try again later." },
        { status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[newsletter] Subscribe error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
