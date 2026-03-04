"use client";

import { useState } from "react";
import { addToCart } from "@/app/actions/cart";
import { useCart } from "@/context/CartContext";
import { useVipUpsell } from "@/context/VipUpsellContext";
import { ShoppingBag, Loader2 } from "lucide-react";

const VIP_UPSELL_DISMISS_KEY = "vip-upsell-dismissed";

export function AddToCartButton({
  variantId,
  sellingPlanId,
  className = "",
  label = "Add to Cart",
  addingLabel = "Adding...",
  disabled = false,
  isDirtFestEvent = false,
}: {
  variantId: string;
  sellingPlanId?: string;
  className?: string;
  label?: string;
  addingLabel?: string;
  disabled?: boolean;
  /** When true, after adding we show the VIP upsell modal instead of opening the cart (unless user dismissed it this session). */
  isDirtFestEvent?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { openDrawer, refreshCart } = useCart();
  const { openVipUpsell } = useVipUpsell();

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      await addToCart(variantId, sellingPlanId);
      await refreshCart();
      const showVipUpsell =
        isDirtFestEvent &&
        typeof window !== "undefined" &&
        !sessionStorage.getItem(VIP_UPSELL_DISMISS_KEY);
      if (showVipUpsell) {
        openVipUpsell();
      } else {
        openDrawer();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add to cart");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading || disabled}
        className={`inline-flex items-center justify-center gap-2 w-full px-4 py-3 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] disabled:opacity-70 disabled:cursor-not-allowed transition-colors ${className}`}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <ShoppingBag className="w-4 h-4" />
        )}
        {loading ? addingLabel : label}
      </button>
      {error && (
        <p className="mt-2 text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}
