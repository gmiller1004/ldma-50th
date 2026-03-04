"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, ShoppingBag } from "lucide-react";
import { useVipUpsell } from "@/context/VipUpsellContext";
import { useCart } from "@/context/CartContext";
import { addToCart } from "@/app/actions/cart";
import { trackVipUpsellAddToCart, trackVipUpsellMaybeLater } from "@/lib/analytics";
import type { VipUpsellProduct } from "@/lib/shopify";
import type { EventVariant } from "@/lib/shopify";

const DISMISS_STORAGE_KEY = "vip-upsell-dismissed";

function getVariants(product: VipUpsellProduct | null): EventVariant[] {
  if (!product?.variants?.edges?.length) return [];
  return product.variants.edges.map((e) => e.node).filter(Boolean);
}

function getVariantOptions(product: VipUpsellProduct | null): Array<{ name: string; values: string[] }> {
  if (!product?.options?.length) return [];
  return product.options
    .filter((opt) => {
      const vals = opt.optionValues?.map((v) => v.name) ?? [];
      return vals.length > 1;
    })
    .map((opt) => ({
      name: opt.name,
      values: opt.optionValues?.map((v) => v.name) ?? [],
    }));
}

function getOptionValuesFromVariants(
  variants: EventVariant[],
  optionName: string,
  productOptionValues: string[]
): string[] {
  const inVariants = new Set(
    variants
      .map((v) =>
        (v.selectedOptions ?? []).find((o) => o.name === optionName)?.value
      )
      .filter(Boolean)
  );
  return productOptionValues.filter((val) => inVariants.has(val));
}

function findVariant(
  product: VipUpsellProduct,
  selected: Record<string, string>
): EventVariant | null {
  const variants = getVariants(product);
  for (const v of variants) {
    const match = (v.selectedOptions ?? []).every(
      (opt) => selected[opt.name] === opt.value
    );
    if (match) return v;
  }
  return variants[0] ?? null;
}

export function VipUpsellModal() {
  const { isOpen, closeVipUpsell } = useVipUpsell();
  const { openDrawer, refreshCart } = useCart();
  const [product, setProduct] = useState<VipUpsellProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);

  const fetchProduct = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/products/vip-upsell");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setProduct(data.product ?? null);
      if (data.product?.variants?.edges?.length) {
        const first = data.product.variants.edges[0]?.node;
        const initial: Record<string, string> = {};
        (first?.selectedOptions ?? []).forEach((o: { name: string; value: string }) => {
          initial[o.name] = o.value;
        });
        setSelectedOptions(initial);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchProduct();
  }, [isOpen, fetchProduct]);

  async function handleAddToCart() {
    if (!product) return;
    const variant = findVariant(product, selectedOptions);
    if (!variant) return;
    setAdding(true);
    try {
      await addToCart(variant.id, undefined, quantity);
      await refreshCart();
      closeVipUpsell();
      openDrawer();
    } catch {
      setError("Could not add to cart. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  function handleMaybeLater() {
    trackVipUpsellMaybeLater();
    try {
      if (typeof window !== "undefined") {
        sessionStorage.setItem(DISMISS_STORAGE_KEY, "1");
      }
    } catch {}
    closeVipUpsell();
    openDrawer();
  }

  if (!isOpen) return null;

  const variants = getVariants(product);
  const options = getVariantOptions(product);
  const selectedVariant = product ? findVariant(product, selectedOptions) : null;
  const canAdd = selectedVariant && selectedVariant.availableForSale !== false;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleMaybeLater}
      >
        <div className="absolute inset-0 bg-black/80" aria-hidden="true" />
        <motion.div
          className="relative w-full max-w-lg bg-[#1a120b] border border-[#d4af37]/30 rounded-2xl shadow-2xl overflow-hidden"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleMaybeLater}
            className="absolute top-4 right-4 z-10 p-2 rounded-lg text-[#e8e0d5]/80 hover:text-[#e8e0d5] hover:bg-[#d4af37]/10 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="max-h-[90vh] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-[#d4af37]" />
              </div>
            ) : error ? (
              <div className="p-8 text-center">
                <p className="text-red-400 mb-4">{error}</p>
                <button
                  onClick={handleMaybeLater}
                  className="px-4 py-2 rounded-lg bg-[#d4af37]/20 text-[#d4af37] font-medium"
                >
                  Maybe later
                </button>
              </div>
            ) : product && variants.length > 0 ? (
              <>
                <div className="p-6 pb-0">
                  <h2 className="font-serif text-xl md:text-2xl font-semibold text-[#f0d48f] mb-4 pr-10">
                    Would you like to upgrade to the ultimate Dirt Fest experience?
                  </h2>

                  <div className="flex gap-4">
                    {product.featuredImage?.url && (
                      <div className="relative w-28 h-28 flex-shrink-0 rounded-lg overflow-hidden bg-[#0f3d1e]/30">
                        <Image
                          src={product.featuredImage.url}
                          alt={product.featuredImage.altText || product.title}
                          fill
                          className="object-cover"
                          sizes="112px"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-[#e8e0d5]">{product.title}</h3>
                      {product.descriptionHtml && (
                        <p className="mt-2 text-sm text-[#e8e0d5]/80 line-clamp-3">
                          {product.descriptionHtml
                            .replace(/<[^>]+>/g, " ")
                            .replace(/\s+/g, " ")
                            .trim()
                            .slice(0, 180)}
                          {product.descriptionHtml.length > 180 ? "…" : ""}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  {options.map((opt) => {
                    const valuesToShow = getOptionValuesFromVariants(
                      variants,
                      opt.name,
                      opt.values
                    );
                    if (valuesToShow.length <= 1) return null;
                    return (
                      <div key={opt.name}>
                        <label
                          htmlFor={`vip-${opt.name}`}
                          className="block text-sm font-medium text-[#e8e0d5]/70 mb-1"
                        >
                          {opt.name}
                        </label>
                        <select
                          id={`vip-${opt.name}`}
                          value={selectedOptions[opt.name] ?? valuesToShow[0]}
                          onChange={(e) =>
                            setSelectedOptions((prev) => ({
                              ...prev,
                              [opt.name]: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 rounded-lg bg-[#0f3d1e]/30 border border-[#d4af37]/30 text-[#e8e0d5] text-sm focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50"
                        >
                          {valuesToShow.map((val) => (
                            <option key={val} value={val}>
                              {val}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}

                  <div>
                    <label
                      htmlFor="vip-qty"
                      className="block text-sm font-medium text-[#e8e0d5]/70 mb-1"
                    >
                      Quantity
                    </label>
                    <input
                      id="vip-qty"
                      type="number"
                      min={1}
                      max={20}
                      value={quantity}
                      onChange={(e) =>
                        setQuantity(Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)))
                      }
                      className="w-full px-3 py-2 rounded-lg bg-[#0f3d1e]/30 border border-[#d4af37]/30 text-[#e8e0d5] text-sm focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50"
                    />
                  </div>

                  {selectedVariant && (
                    <p className="text-[#d4af37] font-medium">
                      ${parseFloat(selectedVariant.price.amount).toFixed(2)}{" "}
                      <span className="text-[#e8e0d5]/70 font-normal text-sm">
                        each
                      </span>
                    </p>
                  )}

                  <p className="text-sm text-[#e8e0d5]/70">
                    Your Dirt Fest ticket covers everyone in your vehicle. The VIP package is per
                    person—add one only for each person who wants this upgrade.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      onClick={handleAddToCart}
                      disabled={!canAdd || adding}
                      className="inline-flex items-center justify-center gap-2 flex-1 px-4 py-3 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
                    >
                      {adding ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ShoppingBag className="w-4 h-4" />
                      )}
                      {adding ? "Adding…" : "Add to cart"}
                    </button>
                    <button
                      onClick={handleMaybeLater}
                      className="px-4 py-3 border border-[#d4af37]/40 text-[#e8e0d5]/90 rounded-lg hover:bg-[#d4af37]/10 transition-colors font-medium"
                    >
                      Maybe later
                    </button>
                  </div>
                </div>
              </>
            ) : product && variants.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-[#e8e0d5]/80 mb-4">No options available for your pricing level.</p>
                <button
                  onClick={handleMaybeLater}
                  className="px-4 py-2 rounded-lg bg-[#d4af37]/20 text-[#d4af37] font-medium"
                >
                  Maybe later
                </button>
              </div>
            ) : null}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
