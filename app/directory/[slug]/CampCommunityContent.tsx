"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  MessageCircle,
  Mountain,
  ArrowRight,
  Plus,
  ChevronRight,
  MessageSquare,
  ChevronDown,
  Loader2,
  MapPin,
  ChevronLeft,
} from "lucide-react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import type { DirectoryCamp } from "@/lib/directory-camps";
import type { Claim } from "@/lib/claims";
import type { Discussion, DiscussionSort } from "@/lib/community";
import { formatDistanceToNow } from "date-fns";
import { CreateDiscussionForm } from "@/components/community/CreateDiscussionForm";
import { AuthorBadge } from "@/components/community/AuthorBadge";
import { ReactionButtons } from "@/components/community/ReactionButtons";

const SORT_LABELS: Record<DiscussionSort, string> = {
  recent: "Most recent",
  liked: "Most liked",
  engagement: "Most engagement",
};

type ClaimWithCount = Claim & { discussionCount: number };

export function CampCommunityContent({
  camp,
  claim,
  claims = [],
  initialDiscussions,
  initialSort,
  pageSize,
}: {
  camp: DirectoryCamp;
  claim?: Claim | null;
  claims?: ClaimWithCount[];
  initialDiscussions: Discussion[];
  initialSort: DiscussionSort;
  pageSize: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [discussions, setDiscussions] = useState(initialDiscussions);
  const [hasMore, setHasMore] = useState(initialDiscussions.length === pageSize);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    setDiscussions(initialDiscussions);
    setHasMore(initialDiscussions.length === pageSize);
  }, [initialDiscussions, pageSize]);
  const [imgError, setImgError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const sort = initialSort;

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Directory & Community", href: "/directory" },
            { label: camp.name, href: `/directory/${camp.slug}` },
            ...(claim ? [{ label: claim.name } as { label: string; href?: string }] : []),
          ]}
        />
      </div>

      <section className="py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {claim && (
            <Link
              href={`/directory/${camp.slug}`}
              className="inline-flex items-center gap-2 text-[#d4af37] hover:text-[#f0d48f] text-sm font-medium mb-6 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to {camp.name} community
            </Link>
          )}
          {claim ? (
            <div>
              <span className="inline-block px-2.5 py-0.5 rounded bg-[#d4af37]/15 text-[#d4af37] text-xs font-medium mb-2">
                {camp.name} · {camp.state}
              </span>
              <h1 className="font-serif text-4xl md:text-5xl font-bold text-[#f0d48f] mb-4">
                {claim.name}
              </h1>
              {claim.description && (
                <p className="text-[#e8e0d5]/85 mb-6 max-w-2xl">{claim.description}</p>
              )}
              {claim.member_claim_names && claim.member_claim_names.length > 0 && (
                <div className="p-4 rounded-xl bg-[#0f3d1e]/30 border border-[#d4af37]/20">
                  <p className="text-sm text-[#e8e0d5]/80 mb-2">Claims in this group:</p>
                  <ul className="flex flex-wrap gap-2">
                    {claim.member_claim_names.map((name) => (
                      <li key={name} className="px-2 py-1 rounded bg-[#1a120b] text-[#d4af37] text-sm">
                        {name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="relative w-full md:w-80 aspect-[4/3] rounded-2xl overflow-hidden border border-[#d4af37]/25 flex-shrink-0">
                {!imgError ? (
                  <Image
                    src={camp.image}
                    alt={camp.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 320px"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <div className="absolute inset-0 bg-[#0f3d1e]/50 flex items-center justify-center">
                    <Mountain className="w-16 h-16 text-[#d4af37]/40" strokeWidth={1} />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <span className="inline-block px-2.5 py-0.5 rounded bg-[#d4af37]/15 text-[#d4af37] text-xs font-medium mb-2">
                  {camp.state}
                </span>
                <h1 className="font-serif text-4xl md:text-5xl font-bold text-[#f0d48f] mb-2">
                  {camp.name}
                </h1>
                <p className="text-[#d4af37]/90 text-lg mb-4">{camp.tagline}</p>
                <p className="text-[#e8e0d5]/85 mb-6">{camp.desc}</p>
                <Link
                  href={`/campgrounds/${camp.slug}`}
                  className="inline-flex items-center gap-2 text-[#d4af37] hover:text-[#f0d48f] font-medium transition-colors"
                >
                  Full camp details
                  <ArrowRight className="w-4 h-4" />
                </Link>
                {claims.length > 0 && (
                  <div className="mt-6">
                    <p className="text-sm text-[#e8e0d5]/70 mb-2">Claims</p>
                    <div className="flex flex-wrap gap-2">
                      {claims.map((c) => (
                        <Link
                          key={c.id}
                          href={`/directory/${camp.slug}/c/${c.slug}`}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0f3d1e]/40 border border-[#d4af37]/20 text-[#e8e0d5] hover:border-[#d4af37]/40 hover:bg-[#0f3d1e]/60 transition-colors"
                        >
                          <MapPin className="w-4 h-4 text-[#d4af37]/60" />
                          {c.name}
                          <span className="text-xs text-[#e8e0d5]/60">
                            {c.discussionCount} {c.discussionCount === 1 ? "post" : "posts"}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="py-12 border-t border-[#d4af37]/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#f0d48f] flex items-center gap-2">
              <MessageCircle className="w-8 h-8" />
              Discussions
            </h2>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative">
                <select
                  value={sort}
                  onChange={(e) => {
                    const next = e.target.value as DiscussionSort;
                    const p = new URLSearchParams(searchParams.toString());
                    p.set("sort", next);
                    p.delete("offset");
                    router.push(claim ? `/directory/${camp.slug}/c/${claim.slug}?${p.toString()}` : `/directory/${camp.slug}?${p.toString()}`);
                  }}
                  className="appearance-none pl-4 pr-10 py-2.5 bg-[#1a120b] border border-[#d4af37]/30 rounded-lg text-[#e8e0d5] focus:border-[#d4af37]/60 focus:ring-1 focus:ring-[#d4af37]/30 outline-none"
                >
                  {(["recent", "liked", "engagement"] as const).map((s) => (
                    <option key={s} value={s}>
                      {SORT_LABELS[s]}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#d4af37]/60 pointer-events-none" />
              </div>
              <button
                onClick={() => setShowForm(!showForm)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors"
              >
                <Plus className="w-5 h-5" />
                New Report
              </button>
            </div>
          </div>

          {showForm && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 p-6 rounded-xl bg-[#0f3d1e]/30 border border-[#d4af37]/20"
            >
              <CreateDiscussionForm
                campSlug={camp.slug}
                claimSlug={claim?.slug}
                onSuccess={(id) => {
          setShowForm(false);
          window.location.reload();
        }}
                onCancel={() => setShowForm(false)}
              />
            </motion.div>
          )}

          {discussions.length === 0 ? (
            <div className="py-16 text-center rounded-xl bg-[#0f3d1e]/20 border border-[#d4af37]/10">
              <MessageSquare className="w-16 h-16 text-[#d4af37]/40 mx-auto mb-4" />
              <p className="text-[#e8e0d5]/80 mb-2">No discussions yet</p>
              <p className="text-[#e8e0d5]/60 text-sm mb-6">
                Be the first to share a trip report or start a conversation
              </p>
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors"
              >
                <Plus className="w-5 h-5" />
                Start a Discussion
              </button>
            </div>
          ) : (
            <>
            <ul className="space-y-4">
              {discussions.map((d, i) => (
                <motion.li
                  key={d.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link
                    href={`/directory/${camp.slug}/d/${d.id}`}
                    className="flex gap-4 p-5 rounded-xl bg-[#1a120b] border border-[#d4af37]/20 hover:border-[#d4af37]/40 transition-colors group"
                  >
                    {d.first_photo_url && (
                      <div className="w-24 h-24 shrink-0 rounded-lg overflow-hidden bg-[#0f3d1e]/30">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={d.first_photo_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                    <h3 className="font-serif text-lg font-semibold text-[#f0d48f] group-hover:text-[#f0d48f]/90 mb-2">
                      {d.title}
                    </h3>
                    <p className="text-[#e8e0d5]/75 text-sm line-clamp-2 mb-3">
                      {d.body}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-[#e8e0d5]/60 flex-wrap">
                      <AuthorBadge displayName={d.author_display_name} avatarUrl={d.author_avatar_url} />
                      <span>
                        {formatDistanceToNow(new Date(d.created_at), {
                          addSuffix: true,
                        })}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-4 h-4" />
                        {d.comment_count} {d.comment_count === 1 ? "reply" : "replies"}
                      </span>
                      <span
                        onClick={(e) => e.stopPropagation()}
                        className="ml-auto"
                      >
                        <ReactionButtons
                          targetType="discussion"
                          targetId={d.id}
                          thumbsUpCount={d.thumbs_up_count ?? 0}
                          compact
                        />
                      </span>
                      <ChevronRight className="w-4 h-4 text-[#d4af37] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    </div>
                  </Link>
                </motion.li>
              ))}
            </ul>
            {hasMore && (
              <div className="mt-8 flex justify-center">
                <button
                  onClick={async () => {
                    setLoadingMore(true);
                    try {
                      const p = new URLSearchParams({
                        camp: camp.slug,
                        sort,
                        limit: String(pageSize),
                        offset: String(discussions.length),
                      });
                    if (claim) p.set("claim", claim.id);
                      const res = await fetch(`/api/community/discussions?${p.toString()}`);
                      const more: Discussion[] = await res.json();
                      setDiscussions((prev) => [...prev, ...more]);
                      setHasMore(more.length === pageSize);
                    } finally {
                      setLoadingMore(false);
                    }
                  }}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#d4af37]/20 text-[#d4af37] font-medium rounded-lg hover:bg-[#d4af37]/30 disabled:opacity-60 transition-colors"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Loading…
                    </>
                  ) : (
                    "Load more"
                  )}
                </button>
              </div>
            )}
            </>
          )}
        </div>
      </section>
    </>
  );
}
