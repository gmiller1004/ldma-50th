import { NextRequest, NextResponse } from "next/server";
import { getDiscussionById, updateDiscussion } from "@/lib/community";
import { getAuthenticatedMemberForPost } from "@/lib/community-auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const discussion = await getDiscussionById(id);

  if (!discussion) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(discussion);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const member = await getAuthenticatedMemberForPost();
  if (!member?.contactId) {
    return NextResponse.json(
      { error: "You must be signed in to edit." },
      { status: 401 }
    );
  }

  const { id } = await params;
  const body = await request.json();
  const { title, body: bodyText } = body;

  const updates: { title?: string; body?: string } = {};
  if (typeof title === "string" && title.trim()) updates.title = title.trim().slice(0, 200);
  if (typeof bodyText === "string") updates.body = bodyText.trim().slice(0, 10000);

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid updates" }, { status: 400 });
  }

  const ok = await updateDiscussion(id, updates, member.contactId);
  if (!ok) {
    return NextResponse.json(
      { error: "Not found or you don't have permission to edit" },
      { status: 403 }
    );
  }

  return NextResponse.json({ ok: true });
}
