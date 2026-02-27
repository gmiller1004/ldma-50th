"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import type { ShopifyProduct } from "@/lib/shopify";
import { AddToCartButton } from "./AddToCartButton";

export function MerchProductGrid({ products }: { products: ShopifyProduct[] }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
      {products.map((product, i) => {
        const variant = product.variants?.edges?.[0]?.node;
        if (!variant) return null;

        return (
          <motion.article
            key={product.id}
            className="group bg-[#0f3d1e]/20 rounded-xl overflow-hidden border border-[#d4af37]/20 hover:border-[#d4af37]/40 transition-all"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
          >
            <Link href={`/shop/${product.handle}`} className="block">
              <div className="relative aspect-square bg-[#1a120b]">
                {product.featuredImage ? (
                  <Image
                    src={product.featuredImage.url}
                    alt={product.featuredImage.altText || product.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    sizes="(max-width: 640px) 100vw, 25vw"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-[#d4af37]/40">
                    <span className="text-4xl">🪙</span>
                  </div>
                )}
              </div>
            </Link>
            <div className="p-4">
              <h3 className="font-serif text-lg font-semibold text-[#f0d48f] mb-1 line-clamp-2">
                {product.title}
              </h3>
              <p className="text-[#d4af37] font-semibold mb-4">
                {variant.price.currencyCode}{" "}
                {parseFloat(variant.price.amount).toFixed(2)}
              </p>
              <AddToCartButton variantId={variant.id} />
            </div>
          </motion.article>
        );
      })}
    </div>
  );
}
