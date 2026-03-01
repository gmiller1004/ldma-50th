"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import type { ShopifyProduct, ProductVariant } from "@/lib/shopify";
import { AddToCartButton } from "./AddToCartButton";

function findMatchingVariant(
  product: ShopifyProduct,
  selected: Record<string, string>
): ProductVariant | null {
  const variants = product.variants?.edges?.map((e) => e.node) ?? [];
  for (const v of variants) {
    const opts = v.selectedOptions ?? [];
    if (opts.every((o) => selected[o.name] === o.value)) {
      return v;
    }
  }
  return variants[0] ?? null;
}

function formatPrice(amount: string): string {
  return `$${parseFloat(amount).toFixed(2)}`;
}

function ProductCard({
  product,
  index,
}: {
  product: ShopifyProduct;
  index: number;
}) {
  const variants = product.variants?.edges?.map((e) => e.node) ?? [];
  const firstVariant = variants[0];
  const options =
    product.options?.filter(
      (o) => o.optionValues && o.optionValues.length > 1
    ) ?? [];

  const initialSelected = useMemo(() => {
    const sel: Record<string, string> = {};
    if (firstVariant?.selectedOptions) {
      for (const o of firstVariant.selectedOptions) {
        sel[o.name] = o.value;
      }
    }
    return sel;
  }, [firstVariant]);

  const [selected, setSelected] = useState<Record<string, string>>(initialSelected);

  const variant = findMatchingVariant(product, selected);
  const price = variant ? formatPrice(variant.price.amount) : null;

  const handleOptionChange = (optionName: string, value: string) => {
    setSelected((prev) => ({ ...prev, [optionName]: value }));
  };

  return (
    <motion.article
      className="group bg-[#0f3d1e]/20 rounded-xl overflow-hidden border border-[#d4af37]/20 hover:border-[#d4af37]/40 transition-all"
      initial={false}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Link href={`/shop?product=${encodeURIComponent(product.handle)}`} className="block">
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
        {price && (
          <p className="text-[#d4af37] font-semibold mb-3">{price}</p>
        )}
        {options.length > 0 && (
          <div className="space-y-2 mb-3">
            {options.map((opt) => (
              <div key={opt.name}>
                <label
                  htmlFor={`${product.id}-${opt.name}`}
                  className="block text-xs text-[#e8e0d5]/70 mb-1"
                >
                  {opt.name}
                </label>
                <select
                  id={`${product.id}-${opt.name}`}
                  value={selected[opt.name] ?? ""}
                  onChange={(e) =>
                    handleOptionChange(opt.name, e.target.value)
                  }
                  className="w-full px-3 py-2 rounded-md bg-[#1a120b] border border-[#d4af37]/30 text-[#e8e0d5] text-sm focus:outline-none focus:ring-1 focus:ring-[#d4af37]/50"
                >
                  {opt.optionValues.map((ov) => (
                    <option key={ov.name} value={ov.name}>
                      {ov.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
        {variant && <AddToCartButton variantId={variant.id} />}
      </div>
    </motion.article>
  );
}

export function MerchProductGrid({ products }: { products: ShopifyProduct[] }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
      {products.map((product, i) => (
        <ProductCard key={product.id} product={product} index={i} />
      ))}
    </div>
  );
}
