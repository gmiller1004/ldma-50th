import Image from "next/image";
import { Pickaxe } from "lucide-react";

/**
 * Displays author avatar (or pickaxe default), name, and LDMA Member badge for accountable community posting.
 * Shows badge only for member-attributed posts (not legacy "Anonymous").
 */
export function AuthorBadge({
  displayName,
  avatarUrl,
  showBadge = true,
  size = "sm",
}: {
  displayName: string;
  avatarUrl?: string | null;
  showBadge?: boolean;
  size?: "sm" | "md";
}) {
  const isMember = showBadge && displayName !== "Anonymous";
  const dimension = size === "sm" ? 24 : 32;

  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="flex shrink-0 rounded-full overflow-hidden bg-[#0f3d1e]/50 border border-[#d4af37]/20 flex items-center justify-center"
        style={{ width: dimension, height: dimension }}
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt=""
            width={dimension}
            height={dimension}
            className="object-cover w-full h-full"
            unoptimized
          />
        ) : (
          <Pickaxe className="w-[60%] h-[60%] text-[#d4af37]/60" strokeWidth={1.5} />
        )}
      </span>
      <span className="font-medium text-[#d4af37]">{displayName}</span>
      {isMember && (
        <span
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/40"
          title="LDMA Member"
        >
          LDMA Member
        </span>
      )}
    </span>
  );
}
