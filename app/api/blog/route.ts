import { NextRequest, NextResponse } from "next/server";
import { getPosts } from "@/lib/blog";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("category") ?? undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 100);
    const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0);

    const posts = await getPosts({
      categoryId,
      publishedOnly: true,
      limit,
      offset,
    });

    return NextResponse.json({ posts });
  } catch (e) {
    console.error("Blog list API error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
