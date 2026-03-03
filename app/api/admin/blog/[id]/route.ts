import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/blog-admin";
import { getPostById, updatePost, deletePost } from "@/lib/blog";
import type { UpdatePostInput } from "@/lib/blog";

type Params = Promise<{ id: string }>;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Params }
) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;

  try {
    const { id } = await params;
    const existing = await getPostById(id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const input: UpdatePostInput = {};
    if (typeof body.slug === "string") input.slug = body.slug.trim();
    if (typeof body.title === "string") input.title = body.title.trim();
    if (typeof body.body === "string") input.body = body.body;
    if (typeof body.categoryId === "string") input.categoryId = body.categoryId.trim();
    if (body.excerpt !== undefined) input.excerpt = typeof body.excerpt === "string" ? body.excerpt.trim() || null : null;
    if (body.featuredImageUrl !== undefined) input.featuredImageUrl = typeof body.featuredImageUrl === "string" ? body.featuredImageUrl || null : null;
    if (body.authorDisplayName !== undefined) input.authorDisplayName = typeof body.authorDisplayName === "string" ? body.authorDisplayName.trim() || null : null;
    if (body.publishedAt !== undefined) input.publishedAt = typeof body.publishedAt === "string" ? body.publishedAt || null : null;
    if (body.tags !== undefined) input.tags = Array.isArray(body.tags) ? (body.tags as unknown[]).filter((t) => typeof t === "string").map((t) => String(t).trim()).filter(Boolean) : [];

    const post = await updatePost(id, input);
    if (!post) {
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
    return NextResponse.json(post);
  } catch (e) {
    console.error("Admin blog update error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Params }
) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;

  try {
    const { id } = await params;
    const existing = await getPostById(id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await deletePost(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Admin blog delete error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
