import { NextResponse } from "next/server";
import { parseAcademyDiscount } from "@/lib/detector-academy-discount";
import { submitAcademyDiscount } from "@/lib/detector-academy-discount-server";

/**
 * POST /api/events/detector-academy/discount
 * Apply-for-a-discount questionnaire. `website` is a honeypot.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if (typeof body.website === "string" && body.website.trim()) {
    return NextResponse.json({ ok: true, qualifies: true });
  }

  const parsed = parseAcademyDiscount(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const result = await submitAcademyDiscount(parsed.value);
    if (!result.ok) {
      return NextResponse.json(
        { error: "We couldn't submit your application. Please try again or call (888) 465-3717." },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true, qualifies: result.qualifies });
  } catch (e) {
    console.error("[detector-academy-discount] submit failed:", e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
