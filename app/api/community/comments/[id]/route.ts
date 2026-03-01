import { NextRequest, NextResponse } from "next/server";
import { updateComment } from "@/lib/community";
import { getAuthenticatedMemberForPost } from "@/lib/community-auth";

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
  const bodyText = body.body;

  if (typeof bodyText !== "string" || !bodyText.trim()) {
    return NextResponse.json({ error: "Body is required" }, { status: 400 });
  }

  const ok = await updateComment(id, { body: bodyText.trim().slice(0, 5000) }, member.contactId);
  if (!ok) {
    return NextResponse.json(
      { error: "Not found or you don't have permission to edit" },
      { status: 403 }
    );
  }

  return NextResponse.json({ ok: true });
}
