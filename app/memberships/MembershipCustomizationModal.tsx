"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Loader2,
  MapPin,
  Users,
  Sparkles,
  Radio,
  BookOpen,
} from "lucide-react";
import { getMembershipProductsForFlow } from "@/app/actions/membership";
import { addMembershipToCart } from "@/app/actions/cart";
import { useCart } from "@/context/CartContext";
import { trackMembershipQuizComplete, trackAddToCart } from "@/lib/analytics";
import type { MembershipProductInfo } from "@/app/actions/membership";

const STEP_COPY: Record<
  string,
  {
    title: string;
    subtitle?: string;
    desc: string;
    icon: typeof MapPin;
    savingsFallback?: string;
  }
> = {
  lifetime: {
    title: "Discover Gold and Build Memories",
    subtitle: "LDMA Lifetime Membership",
    desc: "Your family's key to a gold mining & camping club like no other. Pitch a tent by a sparkling stream, pan for gold with your loved ones. Unlock a lifetime of moments across 12 exclusive locations.",
    icon: MapPin,
    savingsFallback: "Save $1,750",
  },
  companion: {
    title: "Companion & Transferability",
    subtitle: "Add-On Bundle",
    desc: "Let a spouse, child over 18, parent, or grandparent prospect on LDMA claims and visit camps independently. Transfer your membership to an heir — build a family legacy.",
    icon: Users,
    savingsFallback: "Save $1,900",
  },
  paydirt: {
    title: "Gold Paydirt Can",
    subtitle: "Practice at Home",
    desc: "Guaranteed gold in every pan — real flakes and pickers. Perfect for honing your skills before your next trip. Share the thrill with kids or grandkids.",
    icon: Sparkles,
    savingsFallback: "50% off",
  },
  minelab: {
    title: "Minelab Gold Monster 1000",
    subtitle: "Metal Detector",
    desc: "Ultra-sensitive VLF technology finds the smallest nuggets. Automatic ground balance, lightweight, built for all-day prospecting on LDMA claims.",
    icon: Radio,
    savingsFallback: "Save $349",
  },
  gpaa: {
    title: "GPAA Benefits",
    subtitle: "93,000+ Additional Acres",
    desc: "Expand beyond LDMA's 12 campgrounds. Access GPAA claims nationwide, bi-monthly Gold Prospectors Magazine, and nearly 100 GPAA chapters.",
    icon: BookOpen,
    savingsFallback: "Save $450",
  },
};

type StepStatus = "add" | "skip";

export function MembershipCustomizationModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [products, setProducts] = useState<MembershipProductInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [choices, setChoices] = useState<Record<string, StepStatus>>({});
  const [adding, setAdding] = useState(false);
  const { refreshCart, openDrawer } = useCart();

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    setStepIndex(0);
    setChoices({});
    getMembershipProductsForFlow()
      .then((list) => {
        setProducts(list);
        if (list.length > 0) {
          setChoices({ [list[0].key]: "add" });
        }
      })
      .catch(() => setError("Could not load membership options"))
      .finally(() => setLoading(false));
  }, [isOpen]);

  const current = products[stepIndex];
  const isLastProductStep = stepIndex === products.length - 1;
  const isSummaryStep = stepIndex === products.length;
  const isFirstStep = stepIndex === 0;

  const handleNext = () => {
    if (stepIndex >= products.length) return;
    const next = products[stepIndex + 1];
    if (next) {
      setChoices((c) => ({ ...c, [next.key]: "skip" }));
    }
    setStepIndex((i) => i + 1);
  };

  const handleAdd = () => {
    setChoices((c) => ({ ...c, [current.key]: "add" }));
    if (isLastProductStep) {
      setStepIndex(products.length);
    } else {
      handleNext();
    }
  };

  const handleSkip = () => {
    setChoices((c) => ({ ...c, [current.key]: "skip" }));
    if (isLastProductStep) {
      setStepIndex(products.length);
    } else {
      handleNext();
    }
  };

  const handleBack = () => {
    setStepIndex((i) => Math.max(0, i - 1));
  };

  const handleFinish = async () => {
    const toAdd = products.filter((p) => choices[p.key] === "add");
    const variantIds = toAdd.map((p) => p.variantId);
    if (variantIds.length === 0) return;
    setAdding(true);
    try {
      await addMembershipToCart(variantIds);
      trackMembershipQuizComplete();
      trackAddToCart("membership");
      await refreshCart();
      onClose();
      openDrawer();
    } catch {
      setError("Could not add to cart. Please try again.");
    } finally {
      setAdding(false);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="relative max-w-lg w-full max-h-[90vh] overflow-hidden rounded-2xl bg-[#1a120b] border border-[#d4af37]/30 shadow-xl flex flex-col"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-[#d4af37]/20 shrink-0">
            <h2 className="font-serif text-xl font-semibold text-[#f0d48f]">
              Customize Your Membership
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-[#e8e0d5]/70 hover:text-[#d4af37] rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <Loader2 className="w-10 h-10 text-[#d4af37] animate-spin" />
                <p className="text-[#e8e0d5]/70">Loading options…</p>
              </div>
            ) : error ? (
              <div className="py-8 text-center">
                <p className="text-red-400 mb-4">{error}</p>
                <p className="text-[#e8e0d5]/60 text-sm">
                  Visit our shop or contact info@myldma.com or (888) 465-3717
                </p>
              </div>
            ) : !current && !isSummaryStep ? (
              <p className="text-[#e8e0d5]/60 text-center py-8">
                No membership products available
              </p>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={isSummaryStep ? "summary" : current?.key}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  {/* Progress */}
                  <div className="flex gap-2">
                    {[...products, { key: "summary" }].map((p, i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i <= stepIndex ? "bg-[#d4af37]/60" : "bg-[#d4af37]/20"
                        }`}
                      />
                    ))}
                  </div>

                  {isSummaryStep ? (
                    <StepSummary
                      products={products}
                      choices={choices}
                      onBack={handleBack}
                    />
                  ) : current.key === "lifetime" ? (
                    <StepLifetime
                      info={current}
                      copy={STEP_COPY.lifetime}
                      onNext={handleNext}
                    />
                  ) : (
                    <StepAddOn
                      info={current}
                      copy={STEP_COPY[current.key] ?? STEP_COPY.companion}
                      choice={choices[current.key]}
                      onAdd={handleAdd}
                      onSkip={handleSkip}
                      onBack={handleBack}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </div>

          {!loading && !error && products.length > 0 && (isFirstStep || isSummaryStep) && (
            <div className="p-4 border-t border-[#d4af37]/20 shrink-0 flex flex-col gap-3">
              {isSummaryStep ? (
                <>
                  <div className="flex justify-between text-sm text-[#e8e0d5]/80">
                    <span>Your selection:</span>
                    <span>
                      {products.filter((p) => choices[p.key] === "add").length}{" "}
                      item(s)
                    </span>
                  </div>
                  <button
                    onClick={handleFinish}
                    disabled={adding}
                    className="w-full py-3 px-4 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] disabled:opacity-70 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {adding ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Adding…
                      </>
                    ) : (
                      "Go to Cart"
                    )}
                  </button>
                </>
              ) : (
                <button
                  onClick={handleNext}
                  className="w-full py-3 px-4 bg-[#d4af37]/20 text-[#d4af37] font-semibold rounded-lg hover:bg-[#d4af37]/30 transition-colors flex items-center justify-center gap-2"
                >
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}

function StepSummary({
  products,
  choices,
  onBack,
}: {
  products: MembershipProductInfo[];
  choices: Record<string, StepStatus>;
  onBack: () => void;
}) {
  const selected = products.filter((p) => choices[p.key] === "add");
  const total = selected.reduce((sum, p) => sum + parseFloat(p.price), 0);
  return (
    <div className="space-y-4">
      <h3 className="font-serif text-xl font-semibold text-[#f0d48f]">
        Your Membership Summary
      </h3>
      <p className="text-[#e8e0d5]/80 text-sm">
        Review your selection below. Click &ldquo;Go to Cart&rdquo; to add these
        items and proceed.
      </p>
      <ul className="space-y-2">
        {selected.map((p) => (
          <li
            key={p.key}
            className="flex justify-between items-center py-2 border-b border-[#d4af37]/10 last:border-0"
          >
            <span className="text-[#e8e0d5]/90 text-sm">{p.title}</span>
            <span className="text-[#d4af37] font-medium">
              ${parseFloat(p.price).toFixed(2)}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex justify-between items-center pt-2 font-semibold">
        <span className="text-[#e8e0d5]">Total</span>
        <span className="text-xl text-[#d4af37]">
          ${total.toFixed(2)}
        </span>
      </div>
      <button
        onClick={onBack}
        className="flex items-center gap-1 mt-6 text-[#e8e0d5]/60 hover:text-[#d4af37] text-sm transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back
      </button>
    </div>
  );
}

function StepLifetime({
  info,
  copy,
  onNext,
}: {
  info: MembershipProductInfo;
  copy: (typeof STEP_COPY)["lifetime"];
  onNext: () => void;
}) {
  const Icon = copy.icon;
  const savings = formatSavings(info.price, info.compareAtPrice, copy.savingsFallback);
  return (
    <div className="space-y-4">
      <span className="inline-flex w-12 h-12 rounded-xl bg-[#d4af37]/15 items-center justify-center text-[#d4af37]">
        <Icon className="w-6 h-6" strokeWidth={2} />
      </span>
      <div>
        <p className="text-[#d4af37] text-sm font-medium">{copy.subtitle}</p>
        <h3 className="font-serif text-xl font-semibold text-[#f0d48f] mt-1">
          {copy.title}
        </h3>
      </div>
      <p className="text-[#e8e0d5]/85 text-sm leading-relaxed">{copy.desc}</p>
      <div className="flex items-center justify-between py-2 gap-4 flex-wrap">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-[#d4af37]">
            ${parseFloat(info.price).toFixed(2)}
          </span>
          {info.compareAtPrice && parseFloat(info.compareAtPrice) > parseFloat(info.price) && (
            <span className="text-[#e8e0d5]/60 line-through text-sm">
              ${parseFloat(info.compareAtPrice).toFixed(2)}
            </span>
          )}
        </div>
        {savings && (
          <span className="px-2.5 py-1 rounded-md bg-[#0f3d1e] text-[#6dd472] text-sm font-semibold">
            {savings}
          </span>
        )}
      </div>
      <p className="text-[#e8e0d5]/60 text-xs leading-relaxed">
        After joining, an LDMA Member Relations specialist will reach out to send
        a digital contract for signature explaining your purchase, member
        benefits, and more. You have 30 days to cancel. LDMA Membership requires
        a $120/year maintenance fee starting after the first year.
      </p>
    </div>
  );
}

function formatSavings(price: string, compareAtPrice: string | null, fallback?: string): string | null {
  if (compareAtPrice && parseFloat(compareAtPrice) > parseFloat(price)) {
    const diff = parseFloat(compareAtPrice) - parseFloat(price);
    const pct = Math.round((diff / parseFloat(compareAtPrice)) * 100);
    return `Save $${diff.toFixed(0)}`;
  }
  return fallback ?? null;
}

function StepAddOn({
  info,
  copy,
  choice,
  onAdd,
  onSkip,
  onBack,
}: {
  info: MembershipProductInfo;
  copy: (typeof STEP_COPY)["companion"];
  choice: StepStatus | undefined;
  onAdd: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const Icon = copy.icon;
  const savings = formatSavings(info.price, info.compareAtPrice, copy.savingsFallback);
  return (
    <div className="space-y-4">
      <span className="inline-flex w-12 h-12 rounded-xl bg-[#d4af37]/15 items-center justify-center text-[#d4af37]">
        <Icon className="w-6 h-6" strokeWidth={2} />
      </span>
      <div>
        <p className="text-[#d4af37] text-sm font-medium">{copy.subtitle}</p>
        <h3 className="font-serif text-xl font-semibold text-[#f0d48f] mt-1">
          {copy.title}
        </h3>
      </div>
      <p className="text-[#e8e0d5]/85 text-sm leading-relaxed">{copy.desc}</p>
      <div className="flex items-center justify-between py-2 gap-4 flex-wrap">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-[#d4af37]">
            ${parseFloat(info.price).toFixed(2)}
          </span>
          {info.compareAtPrice && parseFloat(info.compareAtPrice) > parseFloat(info.price) && (
            <span className="text-[#e8e0d5]/60 line-through text-sm">
              ${parseFloat(info.compareAtPrice).toFixed(2)}
            </span>
          )}
        </div>
        {savings && (
          <span className="px-2.5 py-1 rounded-md bg-[#0f3d1e] text-[#6dd472] text-sm font-semibold">
            {savings}
          </span>
        )}
      </div>
      <p className="text-[#e8e0d5]/70 text-sm">
        Would you like to add this to your membership?
      </p>
      <div className="flex gap-3">
        <button
          onClick={onAdd}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-colors ${
            choice === "add"
              ? "bg-[#d4af37] text-[#1a120b]"
              : "bg-[#d4af37]/20 text-[#d4af37] hover:bg-[#d4af37]/30"
          }`}
        >
          Yes, add it
        </button>
        <button
          onClick={onSkip}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-colors ${
            choice === "skip"
              ? "bg-[#d4af37] text-[#1a120b]"
              : "bg-[#d4af37]/20 text-[#d4af37] hover:bg-[#d4af37]/30"
          }`}
        >
          No thanks
        </button>
      </div>
      <button
        onClick={onBack}
        className="flex items-center gap-1 mt-2 text-[#e8e0d5]/60 hover:text-[#d4af37] text-sm transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back
      </button>
    </div>
  );
}
