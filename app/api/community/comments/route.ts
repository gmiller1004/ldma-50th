import { NextRequest, NextResponse } from "next/server";
import { getCommentsByDiscussion, createComment } from "@/lib/community";
import { getAuthenticatedMemberForPost } from "@/lib/community-auth";
import { awardPointsForNewComment } from "@/lib/rewards";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const discussionId = searchParams.get("discussion_id");

  if (!discussionId) {
    return NextResponse.json(
      { error: "Missing discussion_id query parameter" },
      { status: 400 }
    );
  }

  const comments = await getCommentsByDiscussion(discussionId);
  return NextResponse.json(comments);
}

export async function POST(request: NextRequest) {
  const member = await getAuthenticatedMemberForPost();
  if (!member) {
    return NextResponse.json(
      { error: "You must be signed in to comment. Please sign in and try again." },
      { status: 401 }
    );
  }

  const body = await request.json();
  const { discussion_id, parent_id, body: bodyText } = body;

  if (!discussion_id || !bodyText) {
    return NextResponse.json(
      { error: "Missing required fields: discussion_id, body" },
      { status: 400 }
    );
  }

  const result = await createComment({
    discussion_id,
    parent_id: parent_id || null,
    author_member_id: null,
    author_contact_id: member.contactId ?? null,
    author_display_name: member.displayName,
    body: String(bodyText).trim().slice(0, 5000),
  });

  if (!result) {
    return NextResponse.json(
      { error: "Database not configured or insert failed" },
      { status: 500 }
    );
  }

  if (member.contactId) {
    awardPointsForNewComment(member.contactId, result.id).catch(() => {});
  }

  return NextResponse.json({ id: result.id });
}
