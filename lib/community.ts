import { sql, hasDb } from "./db";

export type Discussion = {
  id: string;
  camp_slug: string;
  claim_id?: string | null;
  author_member_id: string | null;
  author_contact_id: string | null;
  author_display_name: string;
  author_avatar_url?: string | null;
  title: string;
  body: string;
  first_photo_url?: string | null;
  created_at: string;
  updated_at: string;
  comment_count: number;
  thumbs_up_count: number;
};

export type Comment = {
  id: string;
  discussion_id: string;
  parent_id: string | null;
  author_member_id: string | null;
  author_contact_id: string | null;
  author_display_name: string;
  author_avatar_url?: string | null;
  body: string;
  created_at: string;
  updated_at: string;
  thumbs_up_count: number;
  replies?: Comment[];
};

export type DiscussionSort = "recent" | "liked" | "engagement";

const SELECT_FIELDS = `d.id, d.camp_slug, d.claim_id, d.author_member_id, d.author_contact_id, d.author_display_name,
  (SELECT avatar_url FROM member_avatars WHERE contact_id = d.author_contact_id) as author_avatar_url,
  d.title, d.body, d.created_at, d.updated_at,
  (SELECT blob_url FROM community_photos WHERE discussion_id = d.id ORDER BY created_at ASC LIMIT 1) as first_photo_url,
  (SELECT COUNT(*)::int FROM community_comments c WHERE c.discussion_id = d.id) as comment_count,
  (SELECT COUNT(*)::int FROM community_reactions r WHERE r.target_discussion_id = d.id AND r.reaction_type = 'up') as thumbs_up_count`;

function buildWhere(campSlug: string, claimId: string | null): string {
  if (claimId) {
    return `d.camp_slug = $1 AND d.claim_id = $2`;
  }
  return `d.camp_slug = $1 AND d.claim_id IS NULL`;
}

function buildParams(campSlug: string, claimId: string | null, limit: number, offset: number): unknown[] {
  if (claimId) {
    return [campSlug, claimId, limit, offset];
  }
  return [campSlug, limit, offset];
}

export async function getDiscussionsByCamp(
  campSlug: string,
  options?: { sort?: DiscussionSort; limit?: number; offset?: number; claimId?: string | null }
): Promise<Discussion[]> {
  if (!hasDb() || !sql) return [];
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);
  const offset = Math.max(options?.offset ?? 0, 0);
  const sort = options?.sort ?? "recent";
  const claimId = options?.claimId ?? null;

  const where = buildWhere(campSlug, claimId);
  const params = buildParams(campSlug, claimId, limit, offset);
  const orderRecent = " ORDER BY d.updated_at DESC";
  const orderLiked = " ORDER BY (SELECT COUNT(*)::int FROM community_reactions r WHERE r.target_discussion_id = d.id AND r.reaction_type = 'up') DESC, d.updated_at DESC";
  const orderEngagement = " ORDER BY ((SELECT COUNT(*)::int FROM community_comments c WHERE c.discussion_id = d.id) + (SELECT COUNT(*)::int FROM community_reactions r WHERE r.target_discussion_id = d.id AND r.reaction_type = 'up')) DESC, d.updated_at DESC";
  const limitOffset = claimId ? " LIMIT $3 OFFSET $4" : " LIMIT $2 OFFSET $3";

  let result: unknown;
  if (sort === "recent") {
    result = await sql.query(
      `SELECT ${SELECT_FIELDS} FROM community_discussions d WHERE ${where}${orderRecent}${limitOffset}`,
      params
    );
  } else if (sort === "liked") {
    result = await sql.query(
      `SELECT ${SELECT_FIELDS} FROM community_discussions d WHERE ${where}${orderLiked}${limitOffset}`,
      params
    );
  } else {
    result = await sql.query(
      `SELECT ${SELECT_FIELDS} FROM community_discussions d WHERE ${where}${orderEngagement}${limitOffset}`,
      params
    );
  }

  const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] })?.rows ?? [];
  return rows as unknown as Discussion[];
}

export async function getDiscussionById(id: string): Promise<Discussion | null> {
  if (!hasDb() || !sql) return null;

  const rows = await sql`
    SELECT d.id, d.camp_slug, d.claim_id, d.author_member_id, d.author_contact_id, d.author_display_name,
           (SELECT avatar_url FROM member_avatars WHERE contact_id = d.author_contact_id) as author_avatar_url,
           d.title, d.body, d.created_at, d.updated_at,
           (SELECT blob_url FROM community_photos WHERE discussion_id = d.id ORDER BY created_at ASC LIMIT 1) as first_photo_url,
           (SELECT COUNT(*)::int FROM community_comments c WHERE c.discussion_id = d.id) as comment_count,
           (SELECT COUNT(*)::int FROM community_reactions r WHERE r.target_discussion_id = d.id AND r.reaction_type = 'up') as thumbs_up_count
    FROM community_discussions d
    WHERE d.id = ${id}
  `;

  const arr = Array.isArray(rows) ? rows : [];
  const row = arr[0];
  return row ? (row as unknown as Discussion) : null;
}

export async function createDiscussion(params: {
  camp_slug: string;
  claim_id?: string | null;
  author_member_id?: string | null;
  author_contact_id?: string | null;
  author_display_name: string;
  title: string;
  body: string;
}): Promise<{ id: string } | null> {
  if (!hasDb() || !sql) return null;

  const rows = await sql`
    INSERT INTO community_discussions (camp_slug, claim_id, author_member_id, author_contact_id, author_display_name, title, body)
    VALUES (${params.camp_slug}, ${params.claim_id ?? null}, ${params.author_member_id ?? null}, ${params.author_contact_id ?? null}, ${params.author_display_name}, ${params.title}, ${params.body})
    RETURNING id
  `;

  const arr = Array.isArray(rows) ? rows : [];
  const row = arr[0];
  return row ? { id: (row as { id: string }).id } : null;
}

export async function addDiscussionPhoto(
  discussionId: string,
  blobUrl: string,
  caption?: string | null
): Promise<void> {
  if (!hasDb() || !sql) return;
  await sql`
    INSERT INTO community_photos (discussion_id, blob_url, caption)
    VALUES (${discussionId}, ${blobUrl}, ${caption ?? null})
  `;
}

export type DiscussionPhoto = { id: string; blob_url: string; caption: string | null };

export async function getDiscussionPhotos(discussionId: string): Promise<DiscussionPhoto[]> {
  if (!hasDb() || !sql) return [];
  const rows = await sql`
    SELECT id, blob_url, caption FROM community_photos
    WHERE discussion_id = ${discussionId}
    ORDER BY created_at ASC
  `;
  const arr = Array.isArray(rows) ? rows : [];
  return arr as unknown as DiscussionPhoto[];
}

export async function getCommentsByDiscussion(discussionId: string): Promise<Comment[]> {
  if (!hasDb() || !sql) return [];

  const rows = await sql`
    SELECT c.id, c.discussion_id, c.parent_id, c.author_member_id, c.author_contact_id, c.author_display_name,
           (SELECT avatar_url FROM member_avatars WHERE contact_id = c.author_contact_id) as author_avatar_url,
           c.body, c.created_at, c.updated_at,
           (SELECT COUNT(*)::int FROM community_reactions r WHERE r.target_comment_id = c.id AND r.reaction_type = 'up') as thumbs_up_count
    FROM community_comments c
    WHERE c.discussion_id = ${discussionId}
    ORDER BY c.created_at ASC
  `;

  const flat = rows as unknown as Comment[];
  return buildCommentTree(flat);
}

function buildCommentTree(flat: Comment[]): Comment[] {
  const byId = new Map<string, Comment>();
  flat.forEach((c) => byId.set(c.id, { ...c, replies: [] }));

  const roots: Comment[] = [];
  flat.forEach((c) => {
    const node = byId.get(c.id)!;
    if (!c.parent_id) {
      roots.push(node);
    } else {
      const parent = byId.get(c.parent_id);
      if (parent) parent.replies!.push(node);
      else roots.push(node);
    }
  });

  return roots;
}

export async function createComment(params: {
  discussion_id: string;
  parent_id?: string | null;
  author_member_id?: string | null;
  author_contact_id?: string | null;
  author_display_name: string;
  body: string;
}): Promise<{ id: string } | null> {
  if (!hasDb() || !sql) return null;

  const rows = await sql`
    INSERT INTO community_comments (discussion_id, parent_id, author_member_id, author_contact_id, author_display_name, body)
    VALUES (${params.discussion_id}, ${params.parent_id ?? null}, ${params.author_member_id ?? null}, ${params.author_contact_id ?? null}, ${params.author_display_name}, ${params.body})
    RETURNING id
  `;

  const arr = Array.isArray(rows) ? rows : [];
  const row = arr[0];
  return row ? { id: (row as { id: string }).id } : null;
}

export async function updateDiscussion(
  id: string,
  updates: { title?: string; body?: string },
  authorContactId: string
): Promise<boolean> {
  if (!hasDb() || !sql) return false;
  const existing = await sql`
    SELECT author_contact_id FROM community_discussions WHERE id = ${id}
  `;
  const arr = Array.isArray(existing) ? existing : [];
  const row = arr[0] as { author_contact_id: string | null } | undefined;
  if (!row || row.author_contact_id !== authorContactId) return false;
  await sql`
    UPDATE community_discussions
    SET title = COALESCE(${updates.title ?? null}, title),
        body = COALESCE(${updates.body ?? null}, body),
        updated_at = NOW()
    WHERE id = ${id}
  `;
  return true;
}

export async function updateComment(
  id: string,
  updates: { body: string },
  authorContactId: string
): Promise<boolean> {
  if (!hasDb() || !sql) return false;
  const existing = await sql`
    SELECT author_contact_id FROM community_comments WHERE id = ${id}
  `;
  const arr = Array.isArray(existing) ? existing : [];
  const row = arr[0] as { author_contact_id: string | null } | undefined;
  if (!row || row.author_contact_id !== authorContactId) return false;
  await sql`
    UPDATE community_comments
    SET body = ${updates.body},
        updated_at = NOW()
    WHERE id = ${id}
  `;
  return true;
}

export type ReactionTarget = "discussion" | "comment";

export async function toggleReaction(
  targetType: ReactionTarget,
  targetId: string,
  voterContactId: string,
  reactionType: "up" | "down"
): Promise<{ thumbs_up_count: number; user_reaction: "up" | "down" | null }> {
  if (!hasDb() || !sql) return { thumbs_up_count: 0, user_reaction: null };
  const discVal = targetType === "discussion" ? targetId : null;
  const commentVal = targetType === "comment" ? targetId : null;

  const existing = await sql`
    SELECT id, reaction_type FROM community_reactions
    WHERE voter_contact_id = ${voterContactId}
      AND target_discussion_id IS NOT DISTINCT FROM ${discVal}
      AND target_comment_id IS NOT DISTINCT FROM ${commentVal}
  `;
  const arr = Array.isArray(existing) ? existing : [];
  const prev = arr[0] as { id: string; reaction_type: string } | undefined;

  if (prev) {
    if (prev.reaction_type === reactionType) {
      await sql`DELETE FROM community_reactions WHERE id = ${prev.id}`;
      const count = await getThumbsUpCount(targetType, targetId);
      return { thumbs_up_count: count, user_reaction: null };
    }
    await sql`
      UPDATE community_reactions SET reaction_type = ${reactionType} WHERE id = ${prev.id}
    `;
  } else {
    await sql`
      INSERT INTO community_reactions (target_discussion_id, target_comment_id, voter_contact_id, reaction_type)
      VALUES (${discVal}, ${commentVal}, ${voterContactId}, ${reactionType})
    `;
  }
  const count = await getThumbsUpCount(targetType, targetId);
  return { thumbs_up_count: count, user_reaction: reactionType };
}

async function getThumbsUpCount(targetType: ReactionTarget, targetId: string): Promise<number> {
  if (!sql) return 0;
  const rows =
    targetType === "discussion"
      ? await sql`
          SELECT COUNT(*)::int as c FROM community_reactions
          WHERE target_discussion_id = ${targetId} AND reaction_type = 'up'
        `
      : await sql`
          SELECT COUNT(*)::int as c FROM community_reactions
          WHERE target_comment_id = ${targetId} AND reaction_type = 'up'
        `;
  const arr = Array.isArray(rows) ? rows : [];
  const row = arr[0] as { c: number } | undefined;
  return row?.c ?? 0;
}

export async function getUserReaction(
  targetType: ReactionTarget,
  targetId: string,
  voterContactId: string
): Promise<"up" | "down" | null> {
  if (!hasDb() || !sql) return null;
  const discVal = targetType === "discussion" ? targetId : null;
  const commentVal = targetType === "comment" ? targetId : null;
  const rows = await sql`
    SELECT reaction_type FROM community_reactions
    WHERE voter_contact_id = ${voterContactId}
      AND target_discussion_id IS NOT DISTINCT FROM ${discVal}
      AND target_comment_id IS NOT DISTINCT FROM ${commentVal}
  `;
  const arr = Array.isArray(rows) ? rows : [];
  const row = arr[0] as { reaction_type: string } | undefined;
  if (!row) return null;
  return row.reaction_type === "up" ? "up" : row.reaction_type === "down" ? "down" : null;
}
