import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { getCampBySlug } from "@/lib/directory-camps";
import { getDiscussionsByCamp } from "@/lib/community";
import { getClaimBySlug, getDiscussionCountByClaim } from "@/lib/claims";
import { CampCommunityContent } from "../../CampCommunityContent";

type Props = {
  params: Promise<{ slug: string; claimSlug: string }>;
  searchParams: Promise<{ sort?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, claimSlug } = await params;
  const camp = getCampBySlug(slug);
  const claim = await getClaimBySlug(slug, claimSlug);
  if (!camp || !claim) return { title: "Not Found" };
  return {
    title: `${claim.name} | ${camp.name} Community | LDMA Directory`,
    description: `Trip reports and discussions from members at ${claim.name}, ${camp.name}, ${camp.state}.`,
  };
}

export default async function ClaimCommunityPage({ params, searchParams }: Props) {
  const { slug, claimSlug } = await params;
  const { sort } = await searchParams;
  const camp = getCampBySlug(slug);
  const claim = await getClaimBySlug(slug, claimSlug);
  if (!camp || !claim) notFound();

  const validSort = ["recent", "liked", "engagement"].includes(sort ?? "")
    ? (sort as "recent" | "liked" | "engagement")
    : "recent";

  const discussions = await getDiscussionsByCamp(slug, {
    sort: validSort,
    limit: 25,
    offset: 0,
    claimId: claim.id,
  });

  return (
    <>
      <Navbar />
      <main className="pt-16 md:pt-20 min-h-screen bg-[#1a120b]">
        <CampCommunityContent
          camp={camp}
          claim={claim}
          claims={[]}
          initialDiscussions={discussions}
          initialSort={validSort}
          pageSize={25}
        />
      </main>
      <Footer />
    </>
  );
}
