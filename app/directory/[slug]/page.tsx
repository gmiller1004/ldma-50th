import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { getCampBySlug } from "@/lib/directory-camps";
import { getDiscussionsByCamp } from "@/lib/community";
import { getClaimsByCamp, getDiscussionCountByClaim } from "@/lib/claims";
import { CampCommunityContent } from "./CampCommunityContent";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const camp = getCampBySlug(slug);
  if (!camp) return { title: "Camp Not Found" };
  return {
    title: `${camp.name} Community | LDMA Directory`,
    description: `Trip reports and discussions from members at ${camp.name}, ${camp.state}.`,
  };
}

export default async function CampCommunityPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { sort } = await searchParams;
  const camp = getCampBySlug(slug);
  if (!camp) notFound();

  const validSort = ["recent", "liked", "engagement"].includes(sort ?? "")
    ? (sort as "recent" | "liked" | "engagement")
    : "recent";

  const [discussions, claims] = await Promise.all([
    getDiscussionsByCamp(slug, { sort: validSort, limit: 25, offset: 0 }),
    getClaimsByCamp(slug),
  ]);

  const claimsWithCounts = await Promise.all(
    claims.map(async (c) => ({
      ...c,
      discussionCount: await getDiscussionCountByClaim(c.id),
    }))
  );

  return (
    <>
      <Navbar />
      <main className="pt-16 md:pt-20 min-h-screen bg-[#1a120b]">
        <CampCommunityContent
          camp={camp}
          claims={claimsWithCounts}
          initialDiscussions={discussions}
          initialSort={validSort}
          pageSize={25}
        />
      </main>
      <Footer />
    </>
  );
}
