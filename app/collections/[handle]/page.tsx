import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getCollectionByHandle } from "@/lib/shopify";
import {
  isCampgroundCollection,
  isMembersOnlyCollection,
} from "@/lib/collections-config";
import { verifySessionToken } from "@/lib/session";
import { ShopPageContent } from "@/app/shop/ShopPageContent";

export const revalidate = 300;

type Props = {
  params: Promise<{ handle: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { handle } = await params;

    if (isCampgroundCollection(handle)) {
      return { title: "Redirecting…" };
    }

    const collection = await getCollectionByHandle(handle);
    if (!collection) return { title: "Collection Not Found" };

    return {
      title: `${collection.title} | LDMA 50th Anniversary Shop`,
      description:
        collection.collectionDescription?.replace(/<[^>]*>/g, "").slice(0, 160) ??
        `Shop ${collection.title} — LDMA 50th Anniversary merchandise.`,
      openGraph: {
        title: collection.title,
        type: "website",
      },
    };
  } catch (e) {
    console.error("[collections/[handle]] generateMetadata error:", e);
    return { title: "Collection | LDMA 50th Anniversary Shop" };
  }
}

export async function generateStaticParams() {
  const { getAllCollectionHandles } = await import("@/lib/shopify");
  const { isCampgroundCollection, isMembersOnlyCollection } = await import(
    "@/lib/collections-config"
  );

  const handles = await getAllCollectionHandles();
  return handles
    .filter((h) => !isCampgroundCollection(h) && !isMembersOnlyCollection(h))
    .map((handle) => ({ handle }));
}

export default async function CollectionPage({ params }: Props) {
  try {
    const { handle } = await params;

    if (isCampgroundCollection(handle)) {
      redirect(`/campgrounds/${handle}`);
    }

    const collection = await getCollectionByHandle(handle);
    if (!collection) notFound();

    if (isMembersOnlyCollection(handle)) {
      const cookieStore = await cookies();
      const token = cookieStore.get("member_session")?.value;
      const session = token ? await verifySessionToken(token) : null;
      if (!session) {
        const loginUrl = `/members/login?redirect=${encodeURIComponent(`/collections/${handle}`)}`;
        return (
          <>
            <Navbar />
            <main className="pt-16 md:pt-20 min-h-screen bg-[#1a120b]">
              <div className="max-w-2xl mx-auto px-4 py-16">
                <Breadcrumbs
                  items={[
                    { label: "Home", href: "/" },
                    { label: "Shop", href: "/shop" },
                    { label: collection.title },
                  ]}
                />
                <div className="mt-8 p-8 rounded-xl border border-[#d4af37]/30 bg-[#1a120b]/80 text-center">
                  <h1 className="font-serif text-2xl font-semibold text-[#f0d48f] mb-3">
                    {collection.title}
                  </h1>
                  <p className="text-[#e8e0d5]/80 mb-6">
                    This collection is available to members only. Please log in to
                    your account to view these products.
                  </p>
                  <Link
                    href={loginUrl}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors"
                  >
                    Log in to view collection
                  </Link>
                </div>
              </div>
            </main>
            <Footer />
          </>
        );
      }
    }

    return (
      <>
        <Navbar />
        <main className="pt-16 md:pt-20 min-h-screen bg-[#1a120b]">
          <Suspense fallback={<div className="py-24 text-center text-[#e8e0d5]/60">Loading…</div>}>
            <ShopPageContent
              products={collection.products}
              collectionDescription={collection.collectionDescription}
              collectionHandle={collection.handle}
              collectionTitle={collection.title}
            />
          </Suspense>
        </main>
        <Footer />
      </>
    );
  } catch (e) {
    console.error("[collections/[handle]] page error:", e);
    throw e;
  }
}
