import type { Metadata } from "next";
import { getProductById, shopifyVariantMatchingPrice } from "@/lib/shopify";
import {
  buildGpaaUpgradeOptions,
  GPAA_LIFETIME_UPGRADE_PRODUCT_GID,
  GPAA_LIFETIME_UPGRADE_PRICE_DUAL,
  GPAA_LIFETIME_UPGRADE_PRICE_DUAL_LEGACY,
} from "@/lib/gpaa-lifetime-upgrade-config";
import { GpaaLifetimeUpgradeContent } from "./GpaaLifetimeUpgradeContent";

export const metadata: Metadata = {
  title: "GPAA Lifetime → Dual LDMA Upgrade | Exclusive Offer",
  description:
    "Exclusive upgrade for GPAA Lifetime members: dual GPAA/LDMA Lifetime from $500, optional Legacy bundle. Paydirt bag included.",
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export const dynamic = "force-dynamic";

export default async function GpaaLifetimeLdmaUpgradePage() {
  const product = await getProductById(GPAA_LIFETIME_UPGRADE_PRODUCT_GID);

  const variant500 = product
    ? shopifyVariantMatchingPrice(product, GPAA_LIFETIME_UPGRADE_PRICE_DUAL)?.id ?? null
    : null;
  const variant900 = product
    ? shopifyVariantMatchingPrice(product, GPAA_LIFETIME_UPGRADE_PRICE_DUAL_LEGACY)?.id ?? null
    : null;

  const options = buildGpaaUpgradeOptions(variant500, variant900);

  return <GpaaLifetimeUpgradeContent options={options} />;
}
