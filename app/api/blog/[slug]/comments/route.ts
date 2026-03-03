import { NextRequest, NextResponse } from "next/server";
import { getPostBySlug } from "@/lib/blog";
import {
  getCommentsForPost,
  createComment,
  getMemberForComment,
} from "@/lib/blog-comments";

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
    const comments = await getCommentsForPost(post.id);
    return NextResponse.json({ comments });
  } catch (e) {
    console.error("Blog comments GET error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const { slug } = await params;
    const post = await getPostBySlug(slug, { publishedOnly: true });
    if (!post) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const text = typeof body.body === "string" ? body.body.trim() : "";
    if (!text) {
      return NextResponse.json(
        { error: "Comment body is required" },
        { status: 400 }
      );
    }

    const member = await getMemberForComment();
    if (!member) {
      const loginUrl = `/members/login?redirect=${encodeURIComponent(`/blog/${slug}`)}`;
      return NextResponse.json(
        { error: "Sign in to comment", requireAuth: true, loginUrl },
        { status: 401 }
      );
    }

    const result = await createComment(post.id, text, {
      contactId: member.contactId,
      displayName: member.displayName,
    });
    if (!result) {
      return NextResponse.json(
        { error: "Failed to save comment" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { id: result.id, isHidden: result.isHidden },
      { status: 201 }
    );
  } catch (e) {
    console.error("Blog comments POST error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
