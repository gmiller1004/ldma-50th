"use client";

import { useState } from "react";
import { addToCart } from "@/app/actions/cart";
import { ShoppingBag, Loader2 } from "lucide-react";

export function AddToCartButton({
  variantId,
  className = "",
}: {
  variantId: string;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const { checkoutUrl } = await addToCart(variantId);
      window.location.href = checkoutUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add to cart");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className={`inline-flex items-center justify-center gap-2 w-full px-4 py-3 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] disabled:opacity-70 disabled:cursor-not-allowed transition-colors ${className}`}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <ShoppingBag className="w-4 h-4" />
        )}
        {loading ? "Adding..." : "Add to Cart"}
      </button>
      {error && (
        <p className="mt-2 text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}
