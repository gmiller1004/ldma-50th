import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { getProductByHandle, getRelatedProducts, SHOP_COLLECTION_HANDLE } from "@/lib/shopify";
import { ProductPageTemplate } from "@/components/ProductPageTemplate";
import { verifySessionToken } from "@/lib/session";

export const revalidate = 300;

type Props = {
  params: Promise<{ handle: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const product = await getProductByHandle(handle);
  if (!product) return { title: "Product Not Found" };

  const description = product.descriptionHtml
    ? product.descriptionHtml.replace(/<[^>]*>/g, "").slice(0, 160)
    : `Shop ${product.title} — LDMA 50th Anniversary merchandise.`;

  return {
    title: `${product.title} | LDMA 50th Anniversary Shop`,
    description,
    openGraph: {
      title: product.title,
      description,
      type: "website",
    },
  };
}

const EXCLUSIVE_OFFERS_HANDLE = "exclusive-offers-for-ldma-members";

function productInExclusiveOffers(product: { collections?: { edges: Array<{ node: { handle: string } }> } }): boolean {
  const handles = (product.collections?.edges ?? []).map((e) => e.node.handle);
  return handles.includes(EXCLUSIVE_OFFERS_HANDLE);
}

export default async function ProductPage({ params }: Props) {
  const { handle } = await params;
  const product = await getProductByHandle(handle);
  if (!product) notFound();

  if (productInExclusiveOffers(product)) {
    const cookieStore = await cookies();
    const token = cookieStore.get("member_session")?.value;
    const session = token ? await verifySessionToken(token) : null;
    if (!session) {
      const loginUrl = `/members/login?redirect=${encodeURIComponent(`/products/${handle}`)}`;
      return (
        <>
          <Navbar />
          <main className="pt-16 md:pt-20 min-h-screen bg-[#1a120b]">
            <div className="max-w-2xl mx-auto px-4 py-16">
              <div className="mt-8 p-8 rounded-xl border border-[#d4af37]/30 bg-[#1a120b]/80 text-center">
                <h1 className="font-serif text-2xl font-semibold text-[#f0d48f] mb-3">
                  Member-only product
                </h1>
                <p className="text-[#e8e0d5]/80 mb-6">
                  This product is part of our exclusive offers for LDMA members. Please log in to view it.
                </p>
                <Link
                  href={loginUrl}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors"
                >
                  Log in to view product
                </Link>
              </div>
            </div>
          </main>
          <Footer />
        </>
      );
    }
  }

  const collectionHandle =
    (product as { collections?: { edges: Array<{ node: { handle: string } }> } })
      ?.collections?.edges?.[0]?.node?.handle ?? SHOP_COLLECTION_HANDLE;
  const relatedProducts = await getRelatedProducts(collectionHandle, handle, 4);

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://ldma-50th.vercel.app";

  return (
    <>
      <Navbar />
      <main className="pt-16 md:pt-20 min-h-screen bg-[#1a120b]">
        <ProductPageTemplate
          product={product}
          relatedProducts={relatedProducts}
          baseUrl={baseUrl}
        />
      </main>
      <Footer />
    </>
  );
}
