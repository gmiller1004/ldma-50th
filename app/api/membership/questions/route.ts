import { NextResponse } from "next/server";
import { parseMembershipQuestion } from "@/lib/membership-question";
import { submitMembershipQuestion } from "@/lib/membership-question-server";

/**
 * POST /api/membership/questions
 * "Questions about LDMA Membership?" form. `website` is a honeypot field left empty by people.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if (typeof body.website === "string" && body.website.trim()) return NextResponse.json({ ok: true });

  const parsed = parseMembershipQuestion(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const result = await submitMembershipQuestion(parsed.value);
    if (!result.notified) {
      return NextResponse.json(
        { error: "We couldn't send your question. Please call (888) 465-3717." },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[membership-question] submit failed:", e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
