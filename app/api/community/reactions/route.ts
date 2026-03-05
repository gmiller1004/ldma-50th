import { NextRequest, NextResponse } from "next/server";
import { toggleReaction, getUserReaction, type ReactionTarget } from "@/lib/community";
import { getAuthenticatedMemberForPost } from "@/lib/community-auth";
import { awardPointsForReaction } from "@/lib/rewards";

export async function POST(request: NextRequest) {
  const member = await getAuthenticatedMemberForPost();
  if (!member?.contactId) {
    return NextResponse.json(
      { error: "You must be signed in to react." },
      { status: 401 }
    );
  }

  const body = await request.json();
  const { target_type, target_id, reaction_type } = body;

  if (
    !target_type ||
    !target_id ||
    !reaction_type ||
    !["discussion", "comment"].includes(target_type) ||
    !["up", "down"].includes(reaction_type)
  ) {
    return NextResponse.json(
      { error: "Invalid: target_type (discussion|comment), target_id, reaction_type (up|down)" },
      { status: 400 }
    );
  }

  const result = await toggleReaction(
    target_type as ReactionTarget,
    String(target_id),
    member.contactId,
    reaction_type as "up" | "down"
  );

  if (result.user_reaction === "up" && member.contactId) {
    awardPointsForReaction(member.contactId, target_type as "discussion" | "comment", String(target_id)).catch(() => {});
  }

  return NextResponse.json(result);
}

export async function GET(request: NextRequest) {
  const member = await getAuthenticatedMemberForPost();
  if (!member?.contactId) {
    return NextResponse.json({ user_reaction: null });
  }

  const { searchParams } = new URL(request.url);
  const targetType = searchParams.get("target_type");
  const targetId = searchParams.get("target_id");

  if (!targetType || !targetId || !["discussion", "comment"].includes(targetType)) {
    return NextResponse.json({ error: "Invalid target_type or target_id" }, { status: 400 });
  }

  const user_reaction = await getUserReaction(
    targetType as ReactionTarget,
    targetId,
    member.contactId
  );

  return NextResponse.json({ user_reaction });
}
