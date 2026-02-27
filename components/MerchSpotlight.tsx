import Link from "next/link";
import { getFeaturedProducts } from "@/lib/shopify";
import { MerchProductGrid } from "./MerchProductGrid";

export async function MerchSpotlight() {
  const products = await getFeaturedProducts(4);

  if (products.length === 0) {
    return (
      <section className="py-20 md:py-28 bg-[#1a120b]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#f0d48f] mb-4">
            50th Anniversary Merch Spotlight
          </h2>
          <p className="text-[#e8e0d5]/70 mb-8">
            Commemorative gear coming soon. Check back for exclusive 50th
            anniversary apparel and collectibles.
          </p>
          <Link
            href="/shop"
            className="inline-block px-6 py-3 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors"
          >
            Visit Shop
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 md:py-28 bg-[#1a120b]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#f0d48f] text-center mb-4">
          50th Anniversary Merch Spotlight
        </h2>
        <p className="text-center text-[#e8e0d5]/70 mb-16">
          Exclusive gear to celebrate five decades
        </p>

        <MerchProductGrid products={products} />

        <div className="text-center mt-12">
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 text-[#d4af37] font-medium hover:text-[#f0d48f] transition-colors"
          >
            View All Products
          </Link>
        </div>
      </div>
    </section>
  );
}
