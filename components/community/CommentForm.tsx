"use client";

import { useState } from "react";

type Props = {
  discussionId: string;
  parentId?: string;
  onSuccess: () => void;
};

export function CommentForm({
  discussionId,
  parentId,
  onSuccess,
}: Props) {
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/community/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discussion_id: discussionId,
          parent_id: parentId || null,
          body: body.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to post comment");
        setLoading(false);
        return;
      }

      setBody("");
      onSuccess();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={parentId ? "Write a reply…" : "Add a reply…"}
        required
        rows={3}
        maxLength={5000}
        className="w-full px-4 py-3 rounded-lg bg-[#1a120b] border border-[#d4af37]/30 text-[#e8e0d5] placeholder-[#e8e0d5]/40 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50 resize-y"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={loading || !body.trim()}
          className="px-5 py-2 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Posting…" : "Post"}
        </button>
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </form>
  );
}
