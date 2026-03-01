import { sql, hasDb } from "./db";

export type DigestActivity = {
  discussionId: string;
  discussionTitle: string;
  campSlug: string;
  comments: {
    authorDisplayName: string;
    body: string;
    createdAt: string;
  }[];
};

/**
 * Get discussions authored by contactId that received comments since `since`
 * (excluding comments from the author themselves).
 */
export async function getCommentActivityForContact(
  contactId: string,
  since: Date
): Promise<DigestActivity[]> {
  if (!contactId || !hasDb() || !sql) return [];

  const sinceIso = since.toISOString();

  // Single query: discussions by this author + comments on them since since, excluding author's own
  const rows = await sql.query(
    `SELECT d.id as discussion_id, d.title as discussion_title, d.camp_slug,
            c.author_display_name, c.body as comment_body, c.created_at as comment_created_at
     FROM community_discussions d
     JOIN community_comments c ON c.discussion_id = d.id
     WHERE d.author_contact_id = $1
       AND c.created_at >= $2
       AND (c.author_contact_id IS NULL OR c.author_contact_id != $1)`,
    [contactId, sinceIso]
  );

  const arr = Array.isArray(rows) ? rows : [];
  const byDiscussion = new Map<string, DigestActivity>();

  for (const r of arr as {
    discussion_id: string;
    discussion_title: string;
    camp_slug: string;
    author_display_name: string;
    comment_body: string;
    comment_created_at: string;
  }[]) {
    let activity = byDiscussion.get(r.discussion_id);
    if (!activity) {
      activity = {
        discussionId: r.discussion_id,
        discussionTitle: r.discussion_title,
        campSlug: r.camp_slug,
        comments: [],
      };
      byDiscussion.set(r.discussion_id, activity);
    }
    activity.comments.push({
      authorDisplayName: r.author_display_name || "Someone",
      body: r.comment_body,
      createdAt: r.comment_created_at,
    });
  }

  return Array.from(byDiscussion.values());
}
