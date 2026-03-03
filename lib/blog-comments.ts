import { sql, hasDb } from "./db";
import { getAvatarUrl } from "./avatars";
import { getAuthenticatedMemberForPost } from "./community-auth";

/** Moderate profanity: whole-word match (case-insensitive). Comments containing these are stored but hidden. */
const MODERATE_PROFANITY = new Set([
  "damn", "hell", "crap", "ass", "bastard", "bitch", "shit", "piss",
  "fuck", "fucking", "fucked", "wtf", "dick", "cock", "pussy", "cunt",
  "slut", "whore", "retard", "retarded", "fag", "faggot", "nigger", "nigga",
]);

function containsProfanity(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const normalized = text.toLowerCase().replace(/[^\w\s]/g, " ");
  const words = normalized.split(/\s+/).filter(Boolean);
  return words.some((w) => MODERATE_PROFANITY.has(w));
}

export type BlogComment = {
  id: string;
  blogPostId: string;
  authorContactId: string | null;
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
  body: string;
  createdAt: string;
};

export async function getCommentsForPost(blogPostId: string): Promise<BlogComment[]> {
  if (!hasDb() || !sql) return [];
  const rows = (await sql`
    SELECT id, blog_post_id AS "blogPostId", author_contact_id AS "authorContactId",
           author_display_name AS "authorDisplayName", body, created_at AS "createdAt"
    FROM blog_comments
    WHERE blog_post_id = ${blogPostId}::uuid AND is_hidden = false
    ORDER BY created_at ASC
  `) as Array<{
    id: string;
    blogPostId: string;
    authorContactId: string | null;
    authorDisplayName: string | null;
    body: string;
    createdAt: string;
  }>;

  const withAvatars: BlogComment[] = await Promise.all(
    rows.map(async (r) => ({
      ...r,
      authorAvatarUrl: r.authorContactId ? await getAvatarUrl(r.authorContactId) : null,
    }))
  );
  return withAvatars;
}

export async function createComment(
  blogPostId: string,
  body: string,
  options: { contactId?: string | null; displayName?: string | null } = {}
): Promise<{ id: string; isHidden: boolean } | null> {
  if (!hasDb() || !sql) return null;
  const trimmed = body.trim();
  if (!trimmed) return null;

  const isHidden = containsProfanity(trimmed);
  const authorContactId = options.contactId ?? null;
  const authorDisplayName = options.displayName ?? null;

  const rows = (await sql`
    INSERT INTO blog_comments (blog_post_id, author_contact_id, author_display_name, body, is_hidden)
    VALUES (${blogPostId}::uuid, ${authorContactId}, ${authorDisplayName}, ${trimmed}, ${isHidden})
    RETURNING id
  `) as { id: string }[];
  const row = rows[0];
  return row ? { id: row.id, isHidden } : null;
}

/**
 * Get current member for attribution when posting a comment. Returns null if not logged in.
 */
export async function getMemberForComment(): Promise<{
  contactId: string;
  displayName: string;
} | null> {
  const member = await getAuthenticatedMemberForPost();
  if (!member?.contactId || !member.displayName) return null;
  return { contactId: member.contactId, displayName: member.displayName };
}
