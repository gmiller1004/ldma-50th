import { PRICE_LEVEL_METAFIELD } from "@/lib/events-config";
import type { EventVariant } from "@/lib/shopify";
import type { VipUpsellProduct } from "@/lib/shopify";

function getVariantPricingType(variant: EventVariant): "member" | "general" | "unset" {
  const raw = (variant.metafields ?? []).find(
    (m) => m && m.key === PRICE_LEVEL_METAFIELD.key && m.value
  )?.value;
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "member") return "member";
  if (v === "non member" || v === "nonmember") return "general";
  return "unset";
}

/** Filter VIP product variants by member login: members see only member variants, others see only general (or unset). */
export function filterVipVariantsByMember(
  product: VipUpsellProduct | null,
  isMemberLoggedIn: boolean
): VipUpsellProduct | null {
  if (!product?.variants?.edges?.length) return product;

  const variants = product.variants.edges.map((e) => e.node);
  const types = variants.map((v) => getVariantPricingType(v));
  const hasMember = types.some((t) => t === "member");
  const hasGeneral = types.some((t) => t === "general");

  let keep: (v: EventVariant) => boolean;
  if (isMemberLoggedIn) {
    keep = hasMember ? (v) => getVariantPricingType(v) === "member" : () => true;
  } else {
    keep =
      hasGeneral
        ? (v) => getVariantPricingType(v) === "general" || getVariantPricingType(v) === "unset"
        : () => true;
  }

  const filtered = variants.filter(keep);
  if (filtered.length === variants.length) return product;

  return {
    ...product,
    variants: { edges: filtered.map((node) => ({ node })) },
  };
}
