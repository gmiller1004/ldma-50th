import { NextResponse } from "next/server";
import { subscribeEmailToKlaviyoMarketing } from "@/lib/klaviyo-marketing-subscribe";
import {
  MEMBERSHIP_QUOTE_EMAIL_COOKIE,
  trackMembershipQuoteSaved,
  isKlaviyoMembershipEventsConfigured,
} from "@/lib/klaviyo-membership-events";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

type Body = {
  email?: unknown;
  checkout_url?: unknown;
  subtotal?: unknown;
  currency?: unknown;
  choices?: unknown;
  line_items?: unknown;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    if (!process.env.KLAVIYO_PRIVATE_API_KEY) {
      return NextResponse.json({ error: "Membership quote save is not configured." }, { status: 503 });
    }

    const checkoutUrl = typeof body.checkout_url === "string" ? body.checkout_url : "";
    const subtotal =
      typeof body.subtotal === "number" && Number.isFinite(body.subtotal)
        ? body.subtotal
        : typeof body.subtotal === "string"
          ? parseFloat(body.subtotal)
          : 0;
    const currency = typeof body.currency === "string" ? body.currency : "USD";

    const choices: Record<string, string> = {};
    if (isRecord(body.choices)) {
      for (const [k, v] of Object.entries(body.choices)) {
        if (typeof v === "string") choices[k] = v;
      }
    }

    const line_items: Array<{
      key: string;
      title: string;
      price: string;
      variant_id?: string;
    }> = [];
    if (Array.isArray(body.line_items)) {
      for (const row of body.line_items) {
        if (!isRecord(row)) continue;
        const key = typeof row.key === "string" ? row.key : "";
        const title = typeof row.title === "string" ? row.title : "";
        const price = typeof row.price === "string" ? row.price : "";
        const variant_id =
          typeof row.variant_id === "string" && row.variant_id.trim()
            ? row.variant_id.trim()
            : undefined;
        if (key && title) line_items.push({ key, title, price, variant_id });
      }
    }

    const sub = await subscribeEmailToKlaviyoMarketing(email, "membership_quote");
    if (!sub.ok) {
      return NextResponse.json(
        { error: sub.error || "Unable to save quote. Try again later." },
        { status: sub.status && sub.status >= 400 ? sub.status : 502 }
      );
    }

    if (isKlaviyoMembershipEventsConfigured()) {
      await trackMembershipQuoteSaved(email, {
        checkout_url: checkoutUrl,
        subtotal: Number.isFinite(subtotal) ? subtotal : 0,
        currency,
        choices,
        line_items,
      });
    }

    const res = NextResponse.json({ success: true });
    res.cookies.set(MEMBERSHIP_QUOTE_EMAIL_COOKIE, email, {
      path: "/",
      maxAge: COOKIE_MAX_AGE,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
    });
    return res;
  } catch (e) {
    console.error("[membership/save-quote]", e);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
