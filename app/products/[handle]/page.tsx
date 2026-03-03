import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { getProductByHandle, getRelatedProducts, SHOP_COLLECTION_HANDLE } from "@/lib/shopify";
import { ProductPageTemplate } from "@/components/ProductPageTemplate";

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

export default async function ProductPage({ params }: Props) {
  const { handle } = await params;
  const product = await getProductByHandle(handle);
  if (!product) notFound();

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
