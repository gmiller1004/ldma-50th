"use client";

import Link from "next/link";
import { AddToCartButton } from "@/components/AddToCartButton";
import { PRICE_LEVEL_METAFIELD } from "@/lib/events-config";
import { isVipUpsellEvent } from "@/lib/event-display";
import type { EventProduct, EventVariant } from "@/lib/shopify";

export function getEventVariants(product: EventProduct): EventVariant[] {
  return (product.variants?.edges ?? []).map((e) => e.node).filter(Boolean);
}

function getVariantPricingType(variant: EventVariant): "member" | "general" | "unset" {
  const raw = (variant.metafields ?? []).find(
    (m) => m && m.key === PRICE_LEVEL_METAFIELD.key && m.value
  )?.value;
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "member") return "member";
  if (v === "non member" || v === "nonmember") return "general";
  return "unset";
}

export function filterEventVariantsByMember(
  event: EventProduct,
  isMemberLoggedIn: boolean
): EventProduct {
  const allVariants = getEventVariants(event);
  if (allVariants.length === 0) return event;

  const types = allVariants.map((v) => getVariantPricingType(v));
  const hasMember = types.some((t) => t === "member");
  const hasGeneral = types.some((t) => t === "general");

  let keep: (v: EventVariant) => boolean;
  if (isMemberLoggedIn) {
    if (hasMember) keep = (v) => getVariantPricingType(v) === "member";
    else keep = () => true;
  } else {
    if (hasGeneral) keep = (v) => getVariantPricingType(v) === "general" || getVariantPricingType(v) === "unset";
    else keep = () => true;
  }

  const filtered = allVariants.filter(keep);
  if (filtered.length === allVariants.length) return event;

  return {
    ...event,
    variants: { edges: filtered.map((node) => ({ node })) },
  } as EventProduct;
}

function getVariantOptions(product: EventProduct): Array<{ name: string; values: string[] }> {
  const opts = product.options ?? [];
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

function getOptionValuesFromVariants(
  variants: EventVariant[],
  optionName: string,
  productOptionValues: string[]
): string[] {
  const inVariants = new Set(
    variants
      .map((v) => (v.selectedOptions ?? []).find((o) => o.name === optionName)?.value)
      .filter(Boolean)
  );
  return productOptionValues.filter((val) => inVariants.has(val));
}

function findVariantByOptions(
  product: EventProduct,
  selected: Record<string, string>
): EventVariant | null {
  const variants = getEventVariants(product);
  for (const v of variants) {
    if ((v.selectedOptions ?? []).every((opt) => selected[opt.name] === opt.value)) return v;
  }
  return variants[0] ?? null;
}

function EventVariantSelector({
  event,
  selectedVariantId,
  onSelect,
  className = "",
}: {
  event: EventProduct;
  selectedVariantId: string;
  onSelect: (variantId: string) => void;
  className?: string;
}) {
  const variants = getEventVariants(event);
  const options = getVariantOptions(event);
  if (variants.length <= 1) return null;

  const isAvailable = (v: EventVariant) => v.availableForSale !== false;

  if (options.length === 0) {
    const label = (v: EventVariant) =>
      (v.selectedOptions ?? []).map((o) => o.value).filter(Boolean).join(" / ") || "Option";
    return (
      <div className={className}>
        <label className="block text-sm font-medium text-[#e8e0d5]/70 mb-1">Option</label>
        <select
          value={selectedVariantId}
          onChange={(e) => onSelect(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg bg-[#0f0a06] border border-[#d4af37]/30 text-[#e8e0d5] text-sm focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50"
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
    const valuesToShow = getOptionValuesFromVariants(variants, opt.name, opt.values);
    const selectedVariant = variants.find((v) => v.id === selectedVariantId);
    const currentValue =
      selectedVariant?.selectedOptions?.find((o) => o.name === opt.name)?.value ?? valuesToShow[0];

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
          className="w-full px-3 py-2.5 rounded-lg bg-[#0f0a06] border border-[#d4af37]/30 text-[#e8e0d5] text-sm focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50"
        >
          {valuesToShow.map((val) => {
            const v = variants.find(
              (x) => x.selectedOptions?.find((o) => o.name === opt.name)?.value === val
            );
            return (
              <option key={val} value={val} disabled={v ? !isAvailable(v) : false}>
                {val}
                {v && !isAvailable(v) ? " (Sold out)" : ""}
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
      {options.map((opt) => {
        const valuesToShow = getOptionValuesFromVariants(variants, opt.name, opt.values);
        return (
          <div key={opt.name}>
            <label className="block text-sm font-medium text-[#e8e0d5]/70 mb-1">{opt.name}</label>
            <select
              value={selectedOptions[opt.name] ?? valuesToShow[0]}
              onChange={(e) => {
                const next = { ...selectedOptions, [opt.name]: e.target.value };
                const v = findVariantByOptions(event, next);
                if (v) onSelect(v.id);
              }}
              className="w-full px-3 py-2.5 rounded-lg bg-[#0f0a06] border border-[#d4af37]/30 text-[#e8e0d5] text-sm focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50"
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
    </div>
  );
}

export function EventPurchaseSection({
  event,
  isMemberLoggedIn,
  selectedVariantId,
  onSelectVariant,
  loginRedirectPath,
  compact = false,
}: {
  event: EventProduct;
  isMemberLoggedIn: boolean;
  selectedVariantId: string;
  onSelectVariant: (id: string) => void;
  loginRedirectPath: string;
  compact?: boolean;
}) {
  const variants = getEventVariants(event);
  const selectedVariant = variants.find((v) => v.id === selectedVariantId) ?? variants[0];
  const isSoldOut = selectedVariant ? selectedVariant.availableForSale === false : false;
  const memberPricingOnly = variants.length === 0 && !isMemberLoggedIn;

  if (memberPricingOnly) {
    return (
      <div className="rounded-xl border border-[#d4af37]/30 bg-[#d4af37]/10 p-5 text-center">
        <p className="text-[#e8e0d5]/90 text-sm mb-3">
          Member pricing is available for this event. Log in to see options and register.
        </p>
        <Link
          href={`/members/login?redirect=${encodeURIComponent(loginRedirectPath)}`}
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors"
        >
          Log in to view pricing
        </Link>
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-4" : "rounded-xl border border-[#d4af37]/25 bg-[#0f0a06]/80 p-6 space-y-5 shadow-[0_8px_40px_rgba(0,0,0,0.35)]"}>
      <EventVariantSelector
        event={event}
        selectedVariantId={selectedVariantId}
        onSelect={onSelectVariant}
      />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2 border-t border-[#d4af37]/15">
        <div>
          <p className="text-xs text-[#e8e0d5]/55 uppercase tracking-wide mb-0.5">From</p>
          <p className="text-3xl font-bold text-[#d4af37]">
            ${selectedVariant ? parseFloat(selectedVariant.price.amount).toFixed(2) : "0.00"}
          </p>
        </div>
        {isSoldOut ? (
          <span className="inline-flex items-center justify-center px-8 py-3.5 font-semibold text-[#e8e0d5]/60 bg-[#d4af37]/10 rounded-lg border border-[#d4af37]/20 cursor-not-allowed">
            Sold out
          </span>
        ) : (
          <AddToCartButton
            variantId={selectedVariant?.id ?? ""}
            className="!py-3.5 !px-8 text-base w-full sm:w-auto"
            label="Register now"
            addingLabel="Registering…"
            disabled={!selectedVariant}
            isDirtFestEvent={isVipUpsellEvent(event)}
            trackCategory="event"
          />
        )}
      </div>
      {!isMemberLoggedIn && (
        <p className="text-xs text-[#e8e0d5]/50 text-center">
          <Link href={`/members/login?redirect=${encodeURIComponent(loginRedirectPath)}`} className="text-[#d4af37] hover:underline">
            Log in
          </Link>
          {" "}for member pricing if available.
        </p>
      )}
    </div>
  );
}
