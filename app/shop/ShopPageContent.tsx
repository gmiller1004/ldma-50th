"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Info, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ShareButton } from "@/components/ShareButton";
import { AddToCartButton } from "@/components/AddToCartButton";
import type { ShopProduct, ShopProductVariant } from "@/lib/shopify";

/** Get flat array of variants */
function getVariants(p: ShopProduct): ShopProductVariant[] {
  return (p.variants?.edges ?? []).map((e) => e.node).filter(Boolean);
}

/** Get displayable options for variant selection */
function getVariantOptions(p: ShopProduct): Array<{ name: string; values: string[] }> {
  const opts = p.options ?? [];
  return opts
    .filter((opt) => {
      const vals = opt.optionValues?.map((v) => v.name) ?? [];
      if (opt.name === "Title" && vals.length <= 1) return false;
      return vals.length > 1;
    })
    .map((opt) => ({
      name: opt.name,
      values: opt.optionValues?.map((v) => v.name) ?? [],
    }));
}

function findVariantByOptions(
  p: ShopProduct,
  selected: Record<string, string>
): ShopProductVariant | null {
  const variants = getVariants(p);
  for (const v of variants) {
    if ((v.selectedOptions ?? []).every((o) => selected[o.name] === o.value))
      return v;
  }
  return variants[0] ?? null;
}

function ProductVariantSelector({
  product,
  selectedVariantId,
  onSelect,
  className = "",
}: {
  product: ShopProduct;
  selectedVariantId: string;
  onSelect: (variantId: string) => void;
  className?: string;
}) {
  const variants = getVariants(product);
  const options = getVariantOptions(product);
  const isAvailable = (v: ShopProductVariant) => v.availableForSale !== false;

  if (variants.length <= 1) return null;

  if (options.length === 0) {
    const label = (v: ShopProductVariant) =>
      (v.selectedOptions ?? []).map((o) => o.value).filter(Boolean).join(" / ") || "Option";
    return (
      <div className={className}>
        <label className="block text-sm font-medium text-[#e8e0d5]/70 mb-1">Option</label>
        <select
          value={selectedVariantId}
          onChange={(e) => onSelect(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-[#1a120b] border border-[#d4af37]/30 text-[#e8e0d5] text-sm focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50"
        >
          {variants.map((v) => (
            <option key={v.id} value={v.id} disabled={!isAvailable(v)}>
              {label(v)} — ${parseFloat(v.price.amount).toFixed(2)}
              {!isAvailable(v) ? " (Sold out)" : ""}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (options.length === 1) {
    const opt = options[0]!;
    const selectedVariant = variants.find((v) => v.id === selectedVariantId);
    const currentValue =
      selectedVariant?.selectedOptions?.find((o) => o.name === opt.name)?.value ?? opt.values[0];

    return (
      <div className={className}>
        <label className="block text-sm font-medium text-[#e8e0d5]/70 mb-1">{opt.name}</label>
        <select
          value={currentValue}
          onChange={(e) => {
            const v = variants.find(
              (x) => x.selectedOptions?.find((o) => o.name === opt.name)?.value === e.target.value
            );
            if (v) onSelect(v.id);
          }}
          className="w-full px-3 py-2 rounded-lg bg-[#1a120b] border border-[#d4af37]/30 text-[#e8e0d5] text-sm focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50"
        >
          {opt.values.map((val) => {
            const v = variants.find(
              (x) => x.selectedOptions?.find((o) => o.name === opt.name)?.value === val
            );
            const available = v ? isAvailable(v) : true;
            return (
              <option key={val} value={val} disabled={!available}>
                {val}
                {!available ? " (Sold out)" : ""}
              </option>
            );
          })}
        </select>
      </div>
    );
  }

  const selectedVariant = variants.find((v) => v.id === selectedVariantId);
  const selectedOptions: Record<string, string> = {};
  for (const o of selectedVariant?.selectedOptions ?? []) {
    selectedOptions[o.name] = o.value;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {selectedVariant && !isAvailable(selectedVariant) && (
        <p className="text-amber-400/90 text-sm font-medium">This option is sold out</p>
      )}
      {options.map((opt) => (
        <div key={opt.name}>
          <label className="block text-sm font-medium text-[#e8e0d5]/70 mb-1">{opt.name}</label>
          <select
            value={selectedOptions[opt.name] ?? opt.values[0]}
            onChange={(e) => {
              const next = { ...selectedOptions, [opt.name]: e.target.value };
              const v = findVariantByOptions(product, next);
              if (v) onSelect(v.id);
            }}
            className="w-full px-3 py-2 rounded-lg bg-[#1a120b] border border-[#d4af37]/30 text-[#e8e0d5] text-sm focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50"
          >
            {opt.values.map((val) => (
              <option key={val} value={val}>
                {val}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

/** Product detail modal */
function ProductDetailModal({
  product,
  onClose,
  productShareUrl,
}: {
  product: ShopProduct;
  onClose: () => void;
  productShareUrl?: string;
}) {
  const variants = getVariants(product);
  const defaultVariant =
    variants.find((v) => v.availableForSale !== false) ?? variants[0];
  const [selectedVariantId, setSelectedVariantId] = useState(defaultVariant?.id ?? "");
  const selectedVariant =
    variants.find((v) => v.id === selectedVariantId) ?? defaultVariant;
  const isSoldOut = selectedVariant ? selectedVariant.availableForSale === false : false;

  const galleryImages = useMemo(() => {
    const imgs: Array<{ url: string; altText: string | null }> = [];
    if (product.featuredImage?.url) {
      imgs.push({
        url: product.featuredImage.url,
        altText: product.featuredImage.altText,
      });
    }
    for (const edge of product.images?.edges ?? []) {
      const node = edge?.node;
      if (node?.url && !imgs.some((i) => i.url === node.url)) {
        imgs.push({ url: node.url, altText: node.altText });
      }
    }
    return imgs;
  }, [product]);

  const [galleryIndex, setGalleryIndex] = useState(0);
  const touchStartX = useRef(0);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80" aria-hidden="true" />
      <motion.div
        className="relative w-full max-w-2xl bg-[#1a120b] border border-[#d4af37]/30 rounded-2xl shadow-2xl overflow-hidden"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-lg text-[#e8e0d5]/80 hover:text-[#e8e0d5] hover:bg-[#d4af37]/10 transition-colors"
          aria-label="Close"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="max-h-[90vh] overflow-y-auto">
          {galleryImages.length > 0 && (
            <div
              className="relative aspect-[16/10] bg-[#0f3d1e]/30 touch-pan-y"
              onTouchStart={(e) => {
                touchStartX.current = e.touches[0]!.clientX;
              }}
              onTouchEnd={(e) => {
                if (galleryImages.length <= 1) return;
                const diff = touchStartX.current - e.changedTouches[0]!.clientX;
                if (Math.abs(diff) > 50) {
                  if (diff > 0) {
                    setGalleryIndex((i) => (i === galleryImages.length - 1 ? 0 : i + 1));
                  } else {
                    setGalleryIndex((i) => (i === 0 ? galleryImages.length - 1 : i - 1));
                  }
                }
              }}
            >
              <Image
                src={galleryImages[galleryIndex]?.url ?? galleryImages[0]!.url}
                alt={galleryImages[galleryIndex]?.altText ?? product.title}
                fill
                className="object-cover"
                sizes="(max-width: 672px) 100vw, 672px"
              />
              {galleryImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setGalleryIndex((i) => (i === 0 ? galleryImages.length - 1 : i - 1))
                    }
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setGalleryIndex((i) => (i === galleryImages.length - 1 ? 0 : i + 1))
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                    aria-label="Next image"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {galleryImages.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setGalleryIndex(i)}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          i === galleryIndex ? "bg-[#d4af37]" : "bg-white/50"
                        }`}
                        aria-label={`View image ${i + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="p-6 md:p-8">
            <div className="flex items-start justify-between gap-4 mb-6">
              <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#f0d48f]">
                {product.title}
              </h2>
              <ShareButton
                url={productShareUrl ?? `/shop?product=${encodeURIComponent(product.handle)}`}
                title={product.title}
              />
            </div>

            {product.descriptionHtml && (
              <div
                className="mb-6 text-[#e8e0d5]/90 text-sm leading-relaxed [&_h2]:font-serif [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-[#f0d48f] [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:font-serif [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-[#f0d48f] [&_h3]:mt-3 [&_h3]:mb-1 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_li]:mb-1 [&_a]:text-[#d4af37] [&_a]:underline [&_a:hover]:no-underline [&_strong]:text-[#e8e0d5]"
                dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
              />
            )}

            <ProductVariantSelector
              product={product}
              selectedVariantId={selectedVariantId}
              onSelect={setSelectedVariantId}
              className="mb-6"
            />

            <div className="flex items-center justify-between gap-4 pt-4 border-t border-[#d4af37]/20">
              <div className="flex items-baseline gap-2">
                {selectedVariant?.compareAtPrice &&
                parseFloat(selectedVariant.compareAtPrice.amount) >
                  parseFloat(selectedVariant.price.amount) ? (
                  <>
                    <span className="text-[#e8e0d5]/60 line-through">
                      ${parseFloat(selectedVariant.compareAtPrice.amount).toFixed(2)}
                    </span>
                    <span className="text-[#6dd472] text-sm font-medium">Sale</span>
                  </>
                ) : null}
                <span className="text-[#d4af37] font-bold text-xl">
                  ${selectedVariant ? parseFloat(selectedVariant.price.amount).toFixed(2) : "0.00"}
                </span>
              </div>
              {isSoldOut ? (
                <span className="inline-flex items-center justify-center gap-2 px-6 py-3 font-semibold text-[#e8e0d5]/60 bg-[#d4af37]/10 rounded-lg cursor-not-allowed border border-[#d4af37]/20">
                  Sold out
                </span>
              ) : (
                <AddToCartButton
                  variantId={selectedVariant?.id ?? ""}
                  className="!py-3 !px-6"
                  label="Add to Cart"
                  addingLabel="Adding…"
                  disabled={!selectedVariant}
                />
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** Product card */
function ProductCard({
  product,
  index,
  onMoreInfo,
}: {
  product: ShopProduct;
  index: number;
  onMoreInfo: () => void;
}) {
  const variants = getVariants(product);
  const defaultVariant =
    variants.find((v) => v.availableForSale !== false) ?? variants[0];
  const [selectedVariantId, setSelectedVariantId] = useState(defaultVariant?.id ?? "");
  const selectedVariant =
    variants.find((v) => v.id === selectedVariantId) ?? defaultVariant;
  const isSoldOut = selectedVariant ? selectedVariant.availableForSale === false : false;

  return (
    <motion.article
      className="group flex flex-col rounded-2xl bg-[#1a120b]/80 border border-[#d4af37]/20 overflow-hidden hover:border-[#d4af37]/40 transition-colors duration-300"
      initial={false}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <div className="relative aspect-square bg-[#0f3d1e]/30 overflow-hidden">
        {selectedVariant?.compareAtPrice &&
        parseFloat(selectedVariant.compareAtPrice.amount) >
          parseFloat(selectedVariant.price.amount) ? (
          <span className="absolute top-2 right-2 z-10 px-2 py-0.5 text-xs font-semibold bg-[#6dd472] text-[#0f3d1e] rounded">
            Sale
          </span>
        ) : null}
        {product.featuredImage?.url ? (
          <Image
            src={product.featuredImage.url}
            alt={product.featuredImage.altText || product.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[#d4af37]/30 text-5xl">
            🪙
          </div>
        )}
      </div>

      <div className="flex flex-col p-5 bg-[#1a120b]/95 flex-1">
        <h3 className="font-serif text-xl font-semibold text-[#f0d48f] mb-2 line-clamp-2">
          {product.title}
        </h3>

        <ProductVariantSelector
          product={product}
          selectedVariantId={selectedVariantId}
          onSelect={setSelectedVariantId}
          className="mb-4"
        />

        <div className="mt-auto pt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-2 flex-wrap">
            {selectedVariant?.compareAtPrice &&
            parseFloat(selectedVariant.compareAtPrice.amount) >
              parseFloat(selectedVariant.price.amount) ? (
              <>
                <span className="text-[#e8e0d5]/60 line-through text-sm">
                  ${parseFloat(selectedVariant.compareAtPrice.amount).toFixed(2)}
                </span>
                <span className="text-[#6dd472] text-xs font-medium">Sale</span>
              </>
            ) : null}
            <span className="text-[#d4af37] font-bold">
              ${selectedVariant ? parseFloat(selectedVariant.price.amount).toFixed(2) : "0.00"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMoreInfo();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#e8e0d5] border border-[#d4af37]/40 rounded-lg hover:bg-[#d4af37]/10 hover:border-[#d4af37]/60 transition-colors"
            >
              <Info className="w-4 h-4" />
              More Info
            </button>
            {isSoldOut ? (
              <span className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-[#e8e0d5]/60 bg-[#d4af37]/10 rounded-lg cursor-not-allowed border border-[#d4af37]/20">
                Sold out
              </span>
            ) : (
              <AddToCartButton
                variantId={selectedVariant?.id ?? ""}
                className="!py-2 !px-4 text-sm"
                label="Add to Cart"
                addingLabel="Adding…"
                disabled={!selectedVariant}
              />
            )}
          </div>
        </div>
      </div>
    </motion.article>
  );
}

type SortOption = "default" | "price-low" | "price-high" | "newest";

export type ShopPageContentProps = {
  products: ShopProduct[];
  collectionDescription?: string;
  /** For collection pages: handle and title. Omit for main Shop page. */
  collectionHandle?: string;
  collectionTitle?: string;
};

export function ShopPageContent({
  products,
  collectionDescription,
  collectionHandle,
  collectionTitle,
}: ShopPageContentProps) {
  const isCollectionPage = Boolean(collectionHandle && collectionTitle);
  const searchParams = useSearchParams();
  const highlightHandle = searchParams.get("product");
  const productsWithVariants = useMemo(
    () => products.filter((p) => (p.variants?.edges?.length ?? 0) > 0),
    [products]
  );

  const productTypes = useMemo(() => {
    const types = new Set<string>();
    for (const p of productsWithVariants) {
      if (p.productType?.trim()) types.add(p.productType.trim());
    }
    return Array.from(types).sort();
  }, [productsWithVariants]);

  const [sort, setSort] = useState<SortOption>("default");
  const [productTypeFilter, setProductTypeFilter] = useState<string>("all");
  const initialProduct = useMemo(
    () =>
      highlightHandle
        ? productsWithVariants.find((p) => p.handle === highlightHandle) ?? null
        : null,
    [highlightHandle, productsWithVariants]
  );
  const [detailProduct, setDetailProduct] = useState<ShopProduct | null>(initialProduct);

  useEffect(() => {
    if (initialProduct && highlightHandle) setDetailProduct(initialProduct);
  }, [initialProduct, highlightHandle]);

  const filteredAndSorted = useMemo(() => {
    let list = productTypeFilter === "all"
      ? [...productsWithVariants]
      : productsWithVariants.filter((p) => p.productType?.trim() === productTypeFilter);

    if (sort === "price-low") {
      list = [...list].sort((a, b) => {
        const pa = parseFloat(getVariants(a)[0]?.price.amount ?? "0");
        const pb = parseFloat(getVariants(b)[0]?.price.amount ?? "0");
        return pa - pb;
      });
    } else if (sort === "price-high") {
      list = [...list].sort((a, b) => {
        const pa = parseFloat(getVariants(a)[0]?.price.amount ?? "0");
        const pb = parseFloat(getVariants(b)[0]?.price.amount ?? "0");
        return pb - pa;
      });
    } else if (sort === "newest") {
      list = [...list].sort((a, b) => {
        const ta = a.publishedAt ?? "";
        const tb = b.publishedAt ?? "";
        return tb.localeCompare(ta);
      });
    }

    return list;
  }, [productsWithVariants, productTypeFilter, sort]);

  const breadcrumbItems = isCollectionPage
    ? [
        { label: "Home", href: "/" },
        { label: "Shop", href: "/shop" },
        { label: collectionTitle! },
      ]
    : [
        { label: "Home", href: "/" },
        { label: "Shop" },
      ];

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        <Breadcrumbs items={breadcrumbItems} />
      </div>

      {/* Hero */}
      <section className="relative py-20 md:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f3d1e]/40 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(212,175,55,0.08)_0%,transparent_70%)]" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
          {!isCollectionPage && (
            <motion.span
              className="inline-block px-3 py-1 rounded bg-[#d4af37]/20 text-[#d4af37] text-sm font-medium mb-4"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              50th Anniversary
            </motion.span>
          )}
          <motion.h1
            className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-[#f0d48f] tracking-tight mb-4"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            {isCollectionPage ? collectionTitle : "Shop"}
          </motion.h1>
          {isCollectionPage ? (
            <motion.p
              className="text-[#e8e0d5]/90 text-lg md:text-xl max-w-2xl mx-auto"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Products in this collection.
            </motion.p>
          ) : (
            <>
              <motion.p
                className="text-[#e8e0d5]/90 text-lg md:text-xl max-w-2xl mx-auto"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                Exclusive apparel, collectibles, and gear to celebrate five decades of
                LDMA.
              </motion.p>
              <motion.div
                className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <p className="text-[#e8e0d5]/70 text-sm">
                  Looking for LDMA Membership options?
                </p>
                <Link
                  href="/memberships"
                  className="inline-flex items-center px-5 py-2.5 bg-[#d4af37]/20 text-[#d4af37] font-semibold rounded-lg border border-[#d4af37]/40 hover:bg-[#d4af37]/30 hover:border-[#d4af37]/60 transition-colors"
                >
                  View Memberships
                </Link>
              </motion.div>
            </>
          )}
        </div>
      </section>

      {/* Collection description */}
      {collectionDescription && (
        <section className="py-8 border-b border-[#d4af37]/10">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <div
              className="text-[#e8e0d5]/80 text-center text-sm leading-relaxed [&_a]:text-[#d4af37] [&_a:hover]:underline"
              dangerouslySetInnerHTML={{ __html: collectionDescription }}
            />
          </div>
        </section>
      )}

      {/* Sort & filter */}
      <section className="py-6 border-b border-[#d4af37]/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label
                htmlFor="shop-sort"
                className="block text-sm font-medium text-[#e8e0d5]/70 mb-1"
              >
                Sort by
              </label>
              <select
                id="shop-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                className="w-full px-4 py-2.5 rounded-lg bg-[#1a120b] border border-[#d4af37]/30 text-[#e8e0d5] focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50"
              >
                <option value="default">Default</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="newest">Newest</option>
              </select>
            </div>
            {productTypes.length > 0 && (
              <div className="flex-1">
                <label
                  htmlFor="shop-filter"
                  className="block text-sm font-medium text-[#e8e0d5]/70 mb-1"
                >
                  Product type
                </label>
                <select
                  id="shop-filter"
                  value={productTypeFilter}
                  onChange={(e) => setProductTypeFilter(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-[#1a120b] border border-[#d4af37]/30 text-[#e8e0d5] focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50"
                >
                  <option value="all">All types</option>
                  {productTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Product grid */}
      <section className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {productsWithVariants.length === 0 ? (
            <motion.div
              className="text-center py-16"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <p className="text-[#e8e0d5]/80 text-lg mb-4">
                No products are available yet.
              </p>
              <p className="text-[#e8e0d5]/60 text-sm max-w-lg mx-auto">
                New 50th anniversary merchandise will appear here as it&apos;s added.
                Check back soon!
              </p>
            </motion.div>
          ) : filteredAndSorted.length === 0 ? (
            <motion.div
              className="text-center py-16"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <p className="text-[#e8e0d5]/80 text-lg mb-4">
                No products match your filter.
              </p>
              <p className="text-[#e8e0d5]/60 text-sm">
                Try selecting a different product type.
              </p>
            </motion.div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {filteredAndSorted.map((product, i) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  index={i}
                  onMoreInfo={() => setDetailProduct(product)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <AnimatePresence>
        {detailProduct && (
          <ProductDetailModal
            key={detailProduct.id}
            product={detailProduct}
            onClose={() => setDetailProduct(null)}
            productShareUrl={
              isCollectionPage
                ? `/collections/${collectionHandle}?product=${encodeURIComponent(detailProduct.handle)}`
                : undefined
            }
          />
        )}
      </AnimatePresence>
    </>
  );
}
