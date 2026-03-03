import { NextResponse } from "next/server";
import { getCategories } from "@/lib/blog";

export async function GET() {
  try {
    const categories = await getCategories();
    return NextResponse.json({ categories });
  } catch (e) {
    console.error("Blog categories API error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
