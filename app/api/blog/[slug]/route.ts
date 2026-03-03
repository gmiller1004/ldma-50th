import { NextRequest, NextResponse } from "next/server";
import { getPostBySlug } from "@/lib/blog";

type Params = Promise<{ slug: string }>;

export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const { slug } = await params;
    const post = await getPostBySlug(slug, { publishedOnly: true });
    if (!post) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(post);
  } catch (e) {
    console.error("Blog post API error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
