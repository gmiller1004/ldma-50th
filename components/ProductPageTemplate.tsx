"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Repeat } from "lucide-react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ShareButton } from "@/components/ShareButton";
import { AddToCartButton } from "@/components/AddToCartButton";
import type { ProductWithSellingPlans, ShopProduct, ShopProductVariant } from "@/lib/shopify";

function getVariants(p: ShopProduct): ShopProductVariant[] {
  return (p.variants?.edges ?? []).map((e) => e.node).filter(Boolean);
}

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

/**
 * When one option changes, the naive { ...prev, [name]: value } pair may not
 * exist as a variant. Prefer a variant that keeps other options unchanged;
 * otherwise pick the first variant that matches the changed option.
 */
function resolveVariantOnOptionChange(
  product: ShopProduct,
  previous: Record<string, string>,
  changedOptionName: string,
  newValue: string
): ShopProductVariant | null {
  const variants = getVariants(product);
  const matching = variants.filter(
    (v) =>
      v.selectedOptions?.find((o) => o.name === changedOptionName)?.value ===
      newValue
  );
  if (matching.length === 0) return null;
  const exact = matching.find((v) =>
    (v.selectedOptions ?? []).every((o) => {
      if (o.name === changedOptionName) return o.value === newValue;
      return previous[o.name] === o.value;
    })
  );
  return exact ?? matching[0] ?? null;
}

function imageUrlsMatch(a: string, b: string): boolean {
  return a.split("?")[0] === b.split("?")[0];
}

type ProductVariantSelectorProps = {
  product: ShopProduct;
  selectedVariantId: string;
  onSelect: (variantId: string) => void;
  className?: string;
};

function ProductVariantSelector({
  product,
  selectedVariantId,
  onSelect,
  className = "",
}: ProductVariantSelectorProps) {
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
              const v = resolveVariantOnOptionChange(
                product,
                selectedOptions,
                opt.name,
                e.target.value
              );
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

export type ProductPageTemplateProps = {
  product: ProductWithSellingPlans;
  relatedProducts?: ShopProduct[];
  /** Base URL for share / canonical (e.g. https://ldma50.com) */
  baseUrl?: string;
};

function getVariantsForPrice(p: ShopProduct): ShopProductVariant[] {
  return (p.variants?.edges ?? []).map((e) => e.node).filter(Boolean);
}

export function ProductPageTemplate({
  product,
  relatedProducts = [],
  baseUrl = "",
}: ProductPageTemplateProps) {
  const variants = useMemo(() => getVariants(product), [product]);
  const defaultVariant = variants[0];
  const [currentVariantId, setCurrentVariantId] = useState(defaultVariant?.id ?? "");
  const [imageIndex, setImageIndex] = useState(0);

  const images = useMemo(() => {
    const primary = product.featuredImage;
    const rest = (product.images?.edges ?? []).map((e) => e.node).filter(Boolean);
    if (primary) return [primary, ...rest.filter((img) => img?.url !== primary.url)];
    return rest;
  }, [product.featuredImage, product.images]);

  const currentVariant = variants.find((v) => v.id === currentVariantId) ?? variants[0];

  const sellingPlansFromProduct = useMemo(() => {
    const plans: Array<{ id: string; name: string }> = [];
    for (const e of product.sellingPlanGroups?.edges ?? []) {
      for (const sp of e.node.sellingPlans?.edges ?? []) {
        if (sp?.node?.id && sp?.node?.name) plans.push(sp.node);
      }
    }
    return plans;
  }, [product.sellingPlanGroups]);

  /** Prefer per-variant allocations so the subscription dropdown matches the selected variant. */
  const sellingPlansForVariant = useMemo(() => {
    const v = currentVariant;
    const edges = v?.sellingPlanAllocations?.edges;
    if (edges && edges.length > 0) {
      const from = edges
        .map((e) => e.node?.sellingPlan)
        .filter((x): x is { id: string; name: string } => !!x?.id);
      if (from.length > 0) return from;
    }
    return sellingPlansFromProduct;
  }, [currentVariant, sellingPlansFromProduct]);

  const isSubscription = sellingPlansFromProduct.length > 0;
  const [selectedSellingPlanId, setSelectedSellingPlanId] = useState("");

  useEffect(() => {
    const plans = sellingPlansForVariant;
    if (plans.length === 0) {
      setSelectedSellingPlanId("");
      return;
    }
    setSelectedSellingPlanId((prev) =>
      prev && plans.some((p) => p.id === prev) ? prev : plans[0]!.id
    );
  }, [currentVariantId, sellingPlansForVariant]);

  useEffect(() => {
    const v = variants.find((x) => x.id === currentVariantId);
    const url = v?.image?.url;
    if (!url) return;
    const idx = images.findIndex((img) => imageUrlsMatch(img.url, url));
    if (idx >= 0) setImageIndex(idx);
  }, [currentVariantId, variants, images]);
  const priceDisplay = currentVariant
    ? `$${parseFloat(currentVariant.price.amount).toFixed(2)}`
    : variants[0]
      ? `$${parseFloat(variants[0].price.amount).toFixed(2)}`
      : "";
  const productUrl = `${baseUrl}/products/${product.handle}`;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
      <Breadcrumbs
        items={[
          { label: "Shop", href: "/shop" },
          { label: product.title, href: undefined },
        ]}
        baseUrl={baseUrl}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 mt-4">
        {/* Image gallery */}
        <div className="space-y-4">
          <div className="relative aspect-square rounded-xl overflow-hidden bg-[#1a120b]">
            {images.length > 0 ? (
              <>
                <Image
                  src={images[imageIndex]!.url}
                  alt={images[imageIndex]!.altText ?? product.title}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-contain"
                  priority
                />
                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setImageIndex((i) => (i - 1 + images.length) % images.length)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                      aria-label="Previous image"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageIndex((i) => (i + 1) % images.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                      aria-label="Next image"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#e8e0d5]/40">
                No image
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {images.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setImageIndex(i)}
                  className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                    imageIndex === i
                      ? "border-[#d4af37] ring-1 ring-[#d4af37]/30"
                      : "border-transparent hover:border-[#d4af37]/50"
                  }`}
                >
                  <Image
                    src={img.url}
                    alt={img.altText ?? `Image ${i + 1}`}
                    width={64}
                    height={64}
                    className="object-cover w-full h-full"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-4">
          <h1 className="text-2xl sm:text-3xl font-serif text-[#e8e0d5]">{product.title}</h1>

          {isSubscription && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#d4af37]/15 border border-[#d4af37]/40 text-[#d4af37] text-sm font-medium">
              <Repeat className="w-4 h-4" aria-hidden />
              Subscription available
            </div>
          )}

          <p className="text-xl font-medium text-[#d4af37]">{priceDisplay}</p>

          <ProductVariantSelector
            product={product}
            selectedVariantId={currentVariantId}
            onSelect={setCurrentVariantId}
          />

          {isSubscription && (
            <div>
              <label className="block text-sm font-medium text-[#e8e0d5]/70 mb-1">
                Purchase option
              </label>
              <select
                value={selectedSellingPlanId}
                onChange={(e) => setSelectedSellingPlanId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#1a120b] border border-[#d4af37]/30 text-[#e8e0d5] text-sm focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50"
              >
                {sellingPlansForVariant.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <AddToCartButton
            variantId={currentVariantId}
            sellingPlanId={isSubscription ? selectedSellingPlanId : undefined}
            trackCategory="shop"
            disabled={
              !currentVariant?.availableForSale ||
              (isSubscription && !selectedSellingPlanId)
            }
          />

          {product.descriptionHtml && (
            <div
              className="prose prose-invert prose-sm max-w-none text-[#e8e0d5]/80"
              dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
            />
          )}

          {!product.handle.startsWith("legacy-") && (
            <ShareButton url={productUrl} title={product.title} />
          )}
        </div>
      </div>

      {relatedProducts.length > 0 && (
        <section className="mt-16 pt-12 border-t border-[#d4af37]/20" aria-labelledby="related-heading">
          <h2 id="related-heading" className="font-serif text-xl font-semibold text-[#e8e0d5] mb-6">
            You may also like
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
            {relatedProducts.map((p) => {
              const pVariants = getVariantsForPrice(p);
              const price = pVariants[0]
                ? parseFloat(pVariants[0].price.amount).toFixed(2)
                : "0.00";
              return (
                <Link
                  key={p.id}
                  href={`/products/${p.handle}`}
                  className="group flex flex-col rounded-xl border border-[#d4af37]/20 overflow-hidden hover:border-[#d4af37]/50 transition-colors"
                >
                  <div className="relative aspect-square bg-[#1a120b] overflow-hidden">
                    {p.featuredImage?.url ? (
                      <Image
                        src={p.featuredImage.url}
                        alt={p.featuredImage.altText ?? p.title}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        sizes="(max-width: 640px) 50vw, 25vw"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-[#d4af37]/30 text-4xl">
                        🪙
                      </div>
                    )}
                  </div>
                  <div className="p-3 flex flex-col flex-1">
                    <h3 className="font-medium text-[#e8e0d5] text-sm line-clamp-2 group-hover:text-[#d4af37] transition-colors">
                      {p.title}
                    </h3>
                    <span className="mt-1 text-[#d4af37] font-semibold text-sm">
                      ${price}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

