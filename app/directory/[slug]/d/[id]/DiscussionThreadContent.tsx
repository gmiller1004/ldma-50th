"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { MessageSquare, Reply, ChevronLeft } from "lucide-react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import type { DirectoryCamp } from "@/lib/directory-camps";
import type { Claim } from "@/lib/claims";
import type { Discussion, Comment, DiscussionPhoto } from "@/lib/community";
import { formatDistanceToNow } from "date-fns";
import { CommentForm } from "@/components/community/CommentForm";
import { AuthorBadge } from "@/components/community/AuthorBadge";
import { EditableDiscussion } from "@/components/community/EditableDiscussion";
import { EditableComment } from "@/components/community/EditableComment";
import { ReactionButtons } from "@/components/community/ReactionButtons";
import { useCurrentMember } from "@/hooks/useCurrentMember";

export function DiscussionThreadContent({
  camp,
  discussion,
  claim,
  initialComments,
  photos,
}: {
  camp: DirectoryCamp;
  discussion: Discussion;
  claim?: Claim | null;
  initialComments: Comment[];
  photos: DiscussionPhoto[];
}) {
  const [comments, setComments] = useState(initialComments);
  const member = useCurrentMember();
  const canEditDiscussion =
    Boolean(member?.contactId && discussion.author_contact_id) &&
    member!.contactId === discussion.author_contact_id;

  const handleCommentAdded = () => {
    window.location.reload();
  };

  return (
    <>
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Directory & Community", href: "/directory" },
            { label: camp.name, href: `/directory/${camp.slug}` },
            ...(claim ? [{ label: claim.name, href: `/directory/${camp.slug}/c/${claim.slug}` }] : []),
            { label: discussion.title },
          ]}
        />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <Link
          href={claim ? `/directory/${camp.slug}/c/${claim.slug}` : `/directory/${camp.slug}`}
          className="inline-flex items-center gap-2 text-[#d4af37] hover:text-[#f0d48f] text-sm font-medium mb-8 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to {claim ? `${claim.name}` : `${camp.name} community`}
        </Link>

        <article className="mb-12 p-8 rounded-2xl bg-[#1a120b] border border-[#d4af37]/25">
          <EditableDiscussion
            discussionId={discussion.id}
            title={discussion.title}
            body={discussion.body}
            canEdit={canEditDiscussion}
            onSave={() => window.location.reload()}
            renderDisplay={(t, b) => (
              <>
                <h1 className="font-serif text-3xl md:text-4xl font-bold text-[#f0d48f] mb-4">
                  {t}
                </h1>
                <div className="flex items-center gap-4 text-sm text-[#e8e0d5]/70 mb-6 flex-wrap">
            <AuthorBadge displayName={discussion.author_display_name} avatarUrl={discussion.author_avatar_url} size="md" />
            <span>
              {formatDistanceToNow(new Date(discussion.created_at), {
                addSuffix: true,
              })}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="w-4 h-4" />
              {discussion.comment_count} {discussion.comment_count === 1 ? "reply" : "replies"}
            </span>
            <ReactionButtons
              targetType="discussion"
              targetId={discussion.id}
              thumbsUpCount={discussion.thumbs_up_count ?? 0}
            />
          </div>
          <div className="text-[#e8e0d5]/90 whitespace-pre-wrap leading-relaxed">
            {b}
          </div>
          {photos.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-3">
              {photos.map((p) => (
                <a
                  key={p.id}
                  href={p.blob_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg overflow-hidden border border-[#d4af37]/20 hover:border-[#d4af37]/40 transition-colors max-w-xs"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.blob_url}
                    alt={p.caption ?? "Discussion photo"}
                    className="w-full h-40 object-cover"
                  />
                  {p.caption && (
                    <p className="p-2 text-xs text-[#e8e0d5]/70 bg-[#0f3d1e]/30">
                      {p.caption}
                    </p>
                  )}
                </a>
              ))}
            </div>
          )}
              </>
            )}
          />
        </article>

        <section>
          <h2 className="font-serif text-2xl font-bold text-[#f0d48f] mb-6 flex items-center gap-2">
            <Reply className="w-6 h-6" />
            Replies
          </h2>
          <div className="mb-8">
            <CommentForm
              discussionId={discussion.id}
              onSuccess={handleCommentAdded}
            />
          </div>
          <ul className="space-y-6">
            {comments.map((c) => (
              <CommentItem
                key={c.id}
                comment={c}
                onReplyAdded={handleCommentAdded}
                currentUserContactId={member?.contactId ?? null}
              />
            ))}
          </ul>
          {comments.length === 0 && (
            <p className="text-[#e8e0d5]/60 text-center py-8">
              No replies yet. Be the first to chime in!
            </p>
          )}
        </section>
      </div>
    </>
  );
}

function CommentItem({
  comment,
  onReplyAdded,
  currentUserContactId,
}: {
  comment: Comment;
  onReplyAdded: () => void;
  currentUserContactId: string | null;
}) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const canEdit =
    Boolean(currentUserContactId && comment.author_contact_id) &&
    currentUserContactId === comment.author_contact_id;

  return (
    <li
      className={`${comment.parent_id ? "ml-6 md:ml-12 border-l-2 border-[#d4af37]/20 pl-6" : ""}`}
    >
      <div className="p-4 rounded-xl bg-[#0f3d1e]/20 border border-[#d4af37]/10">
        <div className="flex items-center gap-3 text-sm text-[#e8e0d5]/70 mb-2 flex-wrap">
          <AuthorBadge displayName={comment.author_display_name} avatarUrl={comment.author_avatar_url} />
          <span>
            {formatDistanceToNow(new Date(comment.created_at), {
              addSuffix: true,
            })}
          </span>
          {!comment.parent_id && (
            <button
              onClick={() => setShowReplyForm(!showReplyForm)}
              className="text-[#d4af37] hover:text-[#f0d48f] flex items-center gap-1"
            >
              <Reply className="w-4 h-4" />
              Reply
            </button>
          )}
          <ReactionButtons
            targetType="comment"
            targetId={comment.id}
            thumbsUpCount={comment.thumbs_up_count ?? 0}
            compact
          />
        </div>
        <EditableComment
          commentId={comment.id}
          body={comment.body}
          canEdit={canEdit}
          onSave={onReplyAdded}
        >
          <p className="text-[#e8e0d5]/90 whitespace-pre-wrap">{comment.body}</p>
        </EditableComment>
      </div>
      {showReplyForm && (
        <div className="mt-4 ml-4">
          <CommentForm
            discussionId={comment.discussion_id}
            parentId={comment.id}
            onSuccess={() => {
              setShowReplyForm(false);
              onReplyAdded();
            }}
          />
        </div>
      )}
      {comment.replies && comment.replies.length > 0 && (
        <ul className="mt-4 space-y-4">
          {comment.replies.map((r) => (
            <CommentItem
              key={r.id}
              comment={r}
              onReplyAdded={onReplyAdded}
              currentUserContactId={currentUserContactId}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
