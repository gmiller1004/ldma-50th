import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/blog-admin";
import { getPosts, createPost } from "@/lib/blog";
import type { CreatePostInput } from "@/lib/blog";

export async function GET(request: NextRequest) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("category") ?? undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10) || 100, 200);
    const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0);

    const posts = await getPosts({
      categoryId,
      publishedOnly: false,
      limit,
      offset,
    });

    return NextResponse.json({ posts });
  } catch (e) {
    console.error("Admin blog list error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const slug = typeof body.slug === "string" ? body.slug.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const bodyText = typeof body.body === "string" ? body.body : "";
    const categoryId = typeof body.categoryId === "string" ? body.categoryId.trim() : "";

    if (!slug || !title || !bodyText || !categoryId) {
      return NextResponse.json(
        { error: "Missing required fields: slug, title, body, categoryId" },
        { status: 400 }
      );
    }

    const tags = Array.isArray(body.tags)
      ? (body.tags as unknown[]).filter((t) => typeof t === "string").map((t) => String(t).trim()).filter(Boolean)
      : undefined;

    const input: CreatePostInput = {
      slug,
      title,
      body: bodyText,
      categoryId,
      excerpt: typeof body.excerpt === "string" ? body.excerpt.trim() || null : null,
      featuredImageUrl: typeof body.featuredImageUrl === "string" ? body.featuredImageUrl || null : null,
      authorDisplayName: typeof body.authorDisplayName === "string" ? body.authorDisplayName.trim() || null : null,
      publishedAt: typeof body.publishedAt === "string" ? body.publishedAt || null : null,
      tags,
    };

    const post = await createPost(input);
    if (!post) {
      return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
    }

    return NextResponse.json(post);
  } catch (e) {
    console.error("Admin blog create error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
