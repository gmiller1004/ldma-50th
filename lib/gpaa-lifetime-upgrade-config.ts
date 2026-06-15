/** GPAA Lifetime → dual GPAA/LDMA upgrade. Hidden offer page + email. */

export const GPAA_LIFETIME_UPGRADE_PRODUCT_ID = "7578275774535";

export const GPAA_LIFETIME_UPGRADE_PRODUCT_GID = `gid://shopify/Product/${GPAA_LIFETIME_UPGRADE_PRODUCT_ID}`;

export const GPAA_LIFETIME_UPGRADE_PAGE_PATH = "/offers/gpaa-lifetime-ldma-upgrade";

export const GPAA_LIFETIME_UPGRADE_PAGE_URL = `https://myldma.com${GPAA_LIFETIME_UPGRADE_PAGE_PATH}`;

export const GPAA_LIFETIME_UPGRADE_PAYDIRT_IMAGE =
  "https://cdn.shopify.com/s/files/1/0554/1914/2215/files/DiggersConcentrates_Large_e013b13c-9bfd-409a-9e34-1448a18486d9.jpg?v=1781564930";

/** Shopify variant prices for this product (match by amount). */
export const GPAA_LIFETIME_UPGRADE_PRICE_DUAL = 500;
export const GPAA_LIFETIME_UPGRADE_PRICE_DUAL_LEGACY = 900;

export const GPAA_LIFETIME_UPGRADE_LDMA_RETAIL = 4750;
export const GPAA_LIFETIME_UPGRADE_LEGACY_RETAIL = 3250;
export const GPAA_LIFETIME_UPGRADE_PAYDIRT_VALUE = 250;

export type GpaaUpgradeOfferOption = {
  anchorId: string;
  price: number;
  retailCompare?: number;
  title: string;
  subtitle: string;
  bullets: string[];
  variantId: string | null;
  highlight?: boolean;
};

/** Offer cards for the hidden upgrade page (variant ids resolved server-side). */
export function buildGpaaUpgradeOptions(
  variant500: string | null,
  variant900: string | null
): GpaaUpgradeOfferOption[] {
  return [
    {
      anchorId: "dual-500",
      price: GPAA_LIFETIME_UPGRADE_PRICE_DUAL,
      retailCompare: GPAA_LIFETIME_UPGRADE_LDMA_RETAIL,
      title: "Dual Lifetime upgrade",
      subtitle: "GPAA + LDMA Lifetime, paydirt bag included.",
      bullets: [
        "Dual GPAA/LDMA Lifetime Membership",
        `$${GPAA_LIFETIME_UPGRADE_PAYDIRT_VALUE} Digger's Concentrates paydirt bag`,
        "Maintenance begins January 2027",
      ],
      variantId: variant500,
    },
    {
      anchorId: "dual-900",
      price: GPAA_LIFETIME_UPGRADE_PRICE_DUAL_LEGACY,
      retailCompare: GPAA_LIFETIME_UPGRADE_LDMA_RETAIL + GPAA_LIFETIME_UPGRADE_LEGACY_RETAIL,
      title: "Dual upgrade + Legacy bundle",
      subtitle: `Everything in the $${GPAA_LIFETIME_UPGRADE_PRICE_DUAL} offer, plus Companion, Transferability, and Pre-Paid Transfer Fee.`,
      bullets: [
        "Companion Add-On • eligible family can use camps and claims on their schedule",
        "Transferability • name who receives your dual membership in the future",
        "Pre-Paid Transfer Fee • transfer fee covered now for your family",
        `Legacy bundle alone retails for $${GPAA_LIFETIME_UPGRADE_LEGACY_RETAIL.toLocaleString()}`,
      ],
      variantId: variant900,
      highlight: true,
    },
  ];
}
