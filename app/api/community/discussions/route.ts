import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import {
  getDiscussionsByCamp,
  createDiscussion,
  addDiscussionPhoto,
  type DiscussionSort,
} from "@/lib/community";
import { getValidCampSlugs } from "@/lib/directory-camps";
import { getAuthenticatedMemberForPost } from "@/lib/community-auth";
import { getClaimBySlug } from "@/lib/claims";

const MAX_PHOTO_SIZE = 4 * 1024 * 1024; // 4MB per photo
const MAX_PHOTOS = 5;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const VALID_SORT: DiscussionSort[] = ["recent", "liked", "engagement"];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const campSlug = searchParams.get("camp");
  const claimIdParam = searchParams.get("claim");
  const sortParam = searchParams.get("sort");
  const limitParam = searchParams.get("limit");
  const offsetParam = searchParams.get("offset");

  if (!campSlug) {
    return NextResponse.json(
      { error: "Missing camp query parameter" },
      { status: 400 }
    );
  }

  const validSlugs = getValidCampSlugs();
  if (!validSlugs.includes(campSlug)) {
    return NextResponse.json({ error: "Invalid camp slug" }, { status: 400 });
  }

  const sort: DiscussionSort = VALID_SORT.includes(sortParam as DiscussionSort)
    ? (sortParam as DiscussionSort)
    : "recent";
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 50, 1), 100) : 50;
  const offset = offsetParam ? Math.max(parseInt(offsetParam, 10) || 0, 0) : 0;
  const claimId = claimIdParam && /^[0-9a-f-]{36}$/i.test(claimIdParam) ? claimIdParam : null;

  const discussions = await getDiscussionsByCamp(campSlug, { sort, limit, offset, claimId });
  return NextResponse.json(discussions);
}

export async function POST(request: NextRequest) {
  const member = await getAuthenticatedMemberForPost();
  if (!member) {
    return NextResponse.json(
      { error: "You must be signed in to post. Please sign in and try again." },
      { status: 401 }
    );
  }

  const validSlugs = getValidCampSlugs();
  const contentType = request.headers.get("content-type") ?? "";
  let camp_slug: string;
  let claim_id: string | null = null;
  let title: string;
  let bodyText: string;
  let photoFiles: File[] = [];

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    camp_slug = String(formData.get("camp_slug") ?? "").trim();
    const claimSlug = String(formData.get("claim_slug") ?? "").trim();
    if (claimSlug) {
      const claim = await getClaimBySlug(camp_slug, claimSlug);
      if (claim) claim_id = claim.id;
    }
    title = String(formData.get("title") ?? "").trim();
    bodyText = String(formData.get("body") ?? "").trim();
    const photos = formData.getAll("photos");
    for (const p of photos) {
      if (p instanceof File && p.size > 0) photoFiles.push(p);
    }
    if (photoFiles.length > MAX_PHOTOS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_PHOTOS} photos per post` },
        { status: 400 }
      );
    }
    for (const f of photoFiles) {
      if (f.size > MAX_PHOTO_SIZE) {
        return NextResponse.json(
          { error: "Each photo must be under 4MB" },
          { status: 400 }
        );
      }
      if (!ALLOWED_TYPES.includes(f.type)) {
        return NextResponse.json(
          { error: "Photos must be JPEG, PNG, WebP, or GIF" },
          { status: 400 }
        );
      }
    }
  } else {
    const body = await request.json();
    camp_slug = String(body.camp_slug ?? "").trim();
    const claimSlug = String(body.claim_slug ?? "").trim();
    if (claimSlug) {
      const claim = await getClaimBySlug(camp_slug, claimSlug);
      if (claim) claim_id = claim.id;
    }
    title = String(body.title ?? "").trim();
    bodyText = String(body.body ?? "").trim();
  }

  if (!camp_slug || !title || !bodyText) {
    return NextResponse.json(
      { error: "Missing required fields: camp_slug, title, body" },
      { status: 400 }
    );
  }

  if (!validSlugs.includes(camp_slug)) {
    return NextResponse.json({ error: "Invalid camp slug" }, { status: 400 });
  }

  const result = await createDiscussion({
    camp_slug,
    claim_id,
    author_member_id: null,
    author_contact_id: member.contactId ?? null,
    author_display_name: member.displayName,
    title: title.slice(0, 200),
    body: bodyText.slice(0, 10000),
  });

  if (!result) {
    return NextResponse.json(
      { error: "Database not configured or insert failed" },
      { status: 500 }
    );
  }

  for (let i = 0; i < photoFiles.length; i++) {
    try {
      const file = photoFiles[i];
      const ext = file.type.split("/")[1] || "jpg";
      const pathname = `discussions/${result.id}/${Date.now()}-${i}.${ext}`;
      const blob = await put(pathname, file, {
        access: "public",
        addRandomSuffix: false,
      });
      await addDiscussionPhoto(result.id, blob.url);
    } catch (e) {
      console.error("Photo upload error:", e);
      // Continue - discussion was created; photos are best-effort
    }
  }

  return NextResponse.json({ id: result.id });
}
