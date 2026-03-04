"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X, Minus, Plus, Trash2, Loader2 } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { updateCartLineQuantity, removeCartLine } from "@/app/actions/cart";
import { trackBeginCheckout } from "@/lib/analytics";

export function CartDrawer() {
  const { cart, isDrawerOpen, closeDrawer, refreshCart } = useCart();
  const [updatingLineId, setUpdatingLineId] = useState<string | null>(null);

  const handleQuantityChange = useCallback(
    async (lineId: string, delta: number) => {
      const line = cart?.lines.find((l) => l.id === lineId);
      if (!line) return;
      const newQty = Math.max(1, line.quantity + delta);
      if (newQty === line.quantity) return;
      setUpdatingLineId(lineId);
      try {
        await updateCartLineQuantity(lineId, newQty);
        await refreshCart();
      } finally {
        setUpdatingLineId(null);
      }
    },
    [cart?.lines, refreshCart]
  );

  const handleRemove = useCallback(
    async (lineId: string) => {
      setUpdatingLineId(lineId);
      try {
        await removeCartLine(lineId);
        await refreshCart();
      } finally {
        setUpdatingLineId(null);
      }
    },
    [refreshCart]
  );

  const handleCheckout = useCallback(() => {
    if (cart?.checkoutUrl) {
      trackBeginCheckout();
      window.location.href = cart.checkoutUrl;
    }
  }, [cart?.checkoutUrl]);

  const isEmpty = !cart || cart.lines.length === 0;

  return (
    <AnimatePresence>
      {isDrawerOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeDrawer}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            aria-hidden
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-[#1a120b] border-l border-[#d4af37]/20 shadow-xl flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-[#d4af37]/20">
              <h2 className="font-serif text-xl font-semibold text-[#f0d48f]">
                Your Cart
              </h2>
              <button
                onClick={closeDrawer}
                className="p-2 text-[#e8e0d5]/70 hover:text-[#d4af37] rounded-lg transition-colors"
                aria-label="Close cart"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {isEmpty ? (
                <p className="text-[#e8e0d5]/60 text-center py-12">
                  Your cart is empty
                </p>
              ) : (
                <ul className="space-y-4">
                  {cart.lines.map((line) => {
                    const isLoading = updatingLineId === line.id;
                    const img = line.merchandise.product.featuredImage?.url;
                    return (
                      <li
                        key={line.id}
                        className="flex gap-4 p-3 rounded-lg bg-[#0f3d1e]/30 border border-[#d4af37]/10"
                      >
                        <div className="relative w-16 h-16 shrink-0 rounded bg-[#1a120b] overflow-hidden">
                          {img ? (
                            <Image
                              src={img}
                              alt={line.merchandise.product.title}
                              fill
                              className="object-cover"
                              sizes="64px"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[#d4af37]/40 text-xs">
                              —
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-[#e8e0d5] truncate">
                            {line.merchandise.product.title}
                          </p>
                          {line.merchandise.title !== "Default Title" && (
                            <p className="text-sm text-[#e8e0d5]/60 truncate">
                              {line.merchandise.title}
                            </p>
                          )}
                          <div className="flex items-baseline gap-2 mt-0.5 flex-wrap">
                            {line.merchandise.compareAtPrice &&
                            parseFloat(line.merchandise.compareAtPrice.amount) >
                              parseFloat(line.cost.totalAmount.amount) ? (
                              <>
                                <span className="text-[#e8e0d5]/60 line-through text-sm">
                                  $
                                  {(
                                    parseFloat(line.merchandise.compareAtPrice.amount) *
                                    line.quantity
                                  ).toFixed(2)}
                                </span>
                                <span className="text-[#6dd472] text-xs font-medium">
                                  Save $
                                  {(
                                    parseFloat(line.merchandise.compareAtPrice.amount) *
                                      line.quantity -
                                    parseFloat(line.cost.totalAmount.amount)
                                  ).toFixed(2)}
                                </span>
                              </>
                            ) : null}
                            <span className="text-[#d4af37] font-medium">
                              ${parseFloat(line.cost.totalAmount.amount).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex items-center rounded-md border border-[#d4af37]/30 overflow-hidden">
                              <button
                                onClick={() =>
                                  handleQuantityChange(line.id, -1)
                                }
                                disabled={isLoading || line.quantity <= 1}
                                className="p-1.5 text-[#e8e0d5] hover:bg-[#d4af37]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                aria-label="Decrease quantity"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="px-2 min-w-[24px] text-center text-sm font-medium">
                                {line.quantity}
                              </span>
                              <button
                                onClick={() =>
                                  handleQuantityChange(line.id, 1)
                                }
                                disabled={isLoading}
                                className="p-1.5 text-[#e8e0d5] hover:bg-[#d4af37]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                aria-label="Increase quantity"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <button
                              onClick={() => handleRemove(line.id)}
                              disabled={isLoading}
                              className="p-1.5 text-red-400/80 hover:text-red-400 hover:bg-red-400/10 rounded"
                              aria-label="Remove item"
                            >
                              {isLoading ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {!isEmpty && cart && (
              <div className="p-4 border-t border-[#d4af37]/20 space-y-4">
                {(() => {
                  const compareAtTotal = cart.lines.reduce((sum, line) => {
                    const cap = line.merchandise.compareAtPrice;
                    if (
                      cap &&
                      parseFloat(cap.amount) > parseFloat(line.merchandise.price.amount)
                    ) {
                      return sum + parseFloat(cap.amount) * line.quantity;
                    }
                    return sum;
                  }, 0);
                  const subtotal = parseFloat(cart.cost.subtotalAmount.amount);
                  const savings = compareAtTotal > subtotal ? compareAtTotal - subtotal : 0;
                  return (
                    <div className="space-y-1">
                      {savings > 0 && (
                        <div className="flex justify-between text-[#e8e0d5]/70 text-sm">
                          <span>Compare at</span>
                          <span className="line-through">
                            ${compareAtTotal.toFixed(2)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-[#e8e0d5]">
                        <span>Subtotal</span>
                        <span className="font-semibold text-[#d4af37]">
                          ${subtotal.toFixed(2)}
                        </span>
                      </div>
                      {savings > 0 && (
                        <div className="flex justify-between text-[#6dd472] text-sm font-medium">
                          <span>You save</span>
                          <span>${savings.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
                <button
                  onClick={handleCheckout}
                  className="w-full py-3 px-4 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors"
                >
                  Proceed to Checkout
                </button>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
