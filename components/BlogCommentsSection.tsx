"use client";

import { useState, useEffect, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare } from "lucide-react";
import { AuthorBadge } from "@/components/community/AuthorBadge";
import { useCurrentMember } from "@/hooks/useCurrentMember";
import type { BlogPost } from "@/lib/blog";
import type { BlogComment } from "@/lib/blog-comments";

const DRAFT_KEY_PREFIX = "blog_comment_draft_";

export function BlogCommentsSection({
  post,
  initialComments,
}: {
  post: Pick<BlogPost, "id" | "slug">;
  initialComments: BlogComment[];
}) {
  const member = useCurrentMember();
  const [comments, setComments] = useState<BlogComment[]>(initialComments);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draftKey = `${DRAFT_KEY_PREFIX}${post.id}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = sessionStorage.getItem(draftKey);
      if (saved) {
        setBody(saved);
        sessionStorage.removeItem(draftKey);
      }
    } catch {
      /* ignore */
    }
  }, [draftKey]);

  const fetchComments = useCallback(async () => {
    const res = await fetch(`/api/blog/${encodeURIComponent(post.slug)}/comments`);
    const data = await res.json().catch(() => ({}));
    if (res.ok && Array.isArray(data.comments)) setComments(data.comments);
  }, [post.slug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = body.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/blog/${encodeURIComponent(post.slug)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401 && data.requireAuth && data.loginUrl) {
        sessionStorage.setItem(draftKey, trimmed);
        window.location.href = data.loginUrl;
        return;
      }

      if (!res.ok) {
        setError(data.error ?? "Failed to post comment");
        setLoading(false);
        return;
      }

      setBody("");
      await fetchComments();
      if (data.isHidden) {
        setError("Your comment was saved but is hidden by our content filter.");
        setTimeout(() => setError(null), 5000);
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-12 pt-8 border-t border-[#d4af37]/20" aria-labelledby="blog-comments-heading">
      <h2 id="blog-comments-heading" className="font-serif text-xl font-semibold text-[#f0d48f] mb-4 flex items-center gap-2">
        <MessageSquare className="w-5 h-5" />
        Comments ({comments.length})
      </h2>

      {comments.length > 0 && (
        <ul className="space-y-6 mb-8">
          {comments.map((c) => (
            <li key={c.id} className="pl-0">
              <div className="flex items-start gap-3">
                <AuthorBadge
                  displayName={c.authorDisplayName ?? "Anonymous"}
                  avatarUrl={c.authorAvatarUrl}
                  showBadge={Boolean(c.authorContactId)}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[#e8e0d5]/90 whitespace-pre-wrap break-words">{c.body}</p>
                  <time
                    dateTime={c.createdAt}
                    className="text-xs text-[#e8e0d5]/50 mt-1 block"
                  >
                    {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                  </time>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!member?.authenticated && (
        <p className="text-sm text-[#e8e0d5]/60 mb-3">
          Sign in as a member to comment. Your name and LDMA Member badge will appear with your comment.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment…"
          rows={3}
          maxLength={5000}
          className="w-full px-4 py-3 rounded-lg bg-[#0f0a06] border border-[#d4af37]/30 text-[#e8e0d5] placeholder-[#e8e0d5]/40 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50 resize-y"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={loading || !body.trim()}
            className="px-5 py-2 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Posting…" : "Post comment"}
          </button>
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </form>
    </section>
  );
}
