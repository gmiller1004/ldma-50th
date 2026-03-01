import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { getCampBySlug } from "@/lib/directory-camps";
import { getDiscussionById, getCommentsByDiscussion, getDiscussionPhotos } from "@/lib/community";
import { getClaimById } from "@/lib/claims";
import { DiscussionThreadContent } from "./DiscussionThreadContent";

type Props = {
  params: Promise<{ slug: string; id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, id } = await params;
  const camp = getCampBySlug(slug);
  const discussion = await getDiscussionById(id);
  if (!camp || !discussion) return { title: "Not Found" };
  return {
    title: `${discussion.title} | ${camp.name} Community`,
    description: discussion.body.slice(0, 160) + (discussion.body.length > 160 ? "…" : ""),
  };
}

export default async function DiscussionThreadPage({ params }: Props) {
  const { slug, id } = await params;
  const camp = getCampBySlug(slug);
  const discussion = await getDiscussionById(id);
  if (!camp || !discussion) notFound();

  const [comments, photos, claim] = await Promise.all([
    getCommentsByDiscussion(id),
    getDiscussionPhotos(id),
    discussion.claim_id ? getClaimById(discussion.claim_id) : Promise.resolve(null),
  ]);

  return (
    <>
      <Navbar />
      <main className="pt-16 md:pt-20 min-h-screen bg-[#1a120b]">
        <DiscussionThreadContent
          camp={camp}
          discussion={discussion}
          claim={claim}
          initialComments={comments}
          photos={photos}
        />
      </main>
      <Footer />
    </>
  );
}
