"use client";

import { useState, useEffect } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";

type Props = {
  targetType: "discussion" | "comment";
  targetId: string;
  thumbsUpCount: number;
  compact?: boolean;
};

export function ReactionButtons({
  targetType,
  targetId,
  thumbsUpCount,
  compact,
}: Props) {
  const [count, setCount] = useState(thumbsUpCount);
  const [userReaction, setUserReaction] = useState<"up" | "down" | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(
      `/api/community/reactions?target_type=${targetType}&target_id=${encodeURIComponent(targetId)}`
    )
      .then((res) => res.json())
      .then((data) => setUserReaction(data.user_reaction ?? null))
      .catch(() => {});
  }, [targetType, targetId]);

  async function handleClick(reactionType: "up" | "down") {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/community/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_type: targetType,
          target_id: targetId,
          reaction_type: reactionType,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCount(data.thumbs_up_count);
        setUserReaction(data.user_reaction);
      }
    } finally {
      setLoading(false);
    }
  }

  const size = compact ? "w-4 h-4" : "w-5 h-5";

  return (
    <span className="inline-flex items-center gap-1 text-[#e8e0d5]/70">
      <button
        type="button"
        onClick={() => handleClick("up")}
        disabled={loading}
        className={`p-1 rounded hover:bg-[#d4af37]/20 transition-colors ${
          userReaction === "up" ? "text-[#d4af37]" : "hover:text-[#d4af37]"
        } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
        aria-label="Thumbs up"
      >
        <ThumbsUp className={size} strokeWidth={2} fill={userReaction === "up" ? "currentColor" : "none"} />
      </button>
      {count > 0 && (
        <span className="text-sm tabular-nums">{count}</span>
      )}
      <button
        type="button"
        onClick={() => handleClick("down")}
        disabled={loading}
        className={`p-1 rounded hover:bg-[#d4af37]/20 transition-colors ${
          userReaction === "down" ? "text-[#d4af37]" : "hover:text-[#d4af37]"
        } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
        aria-label="Thumbs down"
      >
        <ThumbsDown className={size} strokeWidth={2} fill={userReaction === "down" ? "currentColor" : "none"} />
      </button>
    </span>
  );
}
