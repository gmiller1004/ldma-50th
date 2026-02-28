import type { Metadata } from "next";
import { Suspense } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { getMerchProducts } from "@/lib/shopify";
import { ShopPageContent } from "./ShopPageContent";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Shop | LDMA 50th Anniversary",
  description:
    "Exclusive 50th anniversary merchandise — apparel, collectibles, and gear to celebrate five decades of LDMA.",
};

export default async function ShopPage() {
  let data: Awaited<ReturnType<typeof getMerchProducts>> = { products: [] };
  try {
    data = await getMerchProducts();
  } catch {
    data = { products: [] };
  }

  return (
    <>
      <Navbar />
      <main className="pt-16 md:pt-20 min-h-screen bg-[#1a120b]">
        <Suspense fallback={<div className="py-24 text-center text-[#e8e0d5]/60">Loading…</div>}>
          <ShopPageContent
            products={data.products}
            collectionDescription={data.collectionDescription}
          />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
