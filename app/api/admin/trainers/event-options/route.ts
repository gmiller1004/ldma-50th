import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/blog-admin";
import { getEventOptions } from "@/lib/trainers";

export async function GET() {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;

  const events = await getEventOptions();
  return NextResponse.json({ events });
}
