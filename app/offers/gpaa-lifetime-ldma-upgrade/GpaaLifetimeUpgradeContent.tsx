"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Loader2, Phone } from "lucide-react";
import { addMembershipToCart } from "@/app/actions/cart";
import { useCart } from "@/context/CartContext";
import {
  buildGpaaUpgradeOptions,
  GPAA_LIFETIME_UPGRADE_LDMA_RETAIL,
  GPAA_LIFETIME_UPGRADE_PAYDIRT_IMAGE,
  GPAA_LIFETIME_UPGRADE_PAYDIRT_VALUE,
  GPAA_LIFETIME_UPGRADE_PRICE_DUAL,
  type GpaaUpgradeOfferOption,
} from "@/lib/gpaa-lifetime-upgrade-config";

type Props = {
  options: GpaaUpgradeOfferOption[];
};

export function GpaaLifetimeUpgradeContent({ options }: Props) {
  const { refreshCart, openDrawer } = useCart();
  const [addingAnchor, setAddingAnchor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(option: GpaaUpgradeOfferOption) {
    if (!option.variantId) {
      setError("Online checkout is temporarily unavailable. Please call (888) 465-3717.");
      return;
    }
    setAddingAnchor(option.anchorId);
    setError(null);
    try {
      await addMembershipToCart([option.variantId]);
      await refreshCart();
      openDrawer();
    } catch {
      setError("Could not add to cart. Please call (888) 465-3717 and mention the GPAA dual Lifetime offer.");
    } finally {
      setAddingAnchor(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F6F0] text-[#1C2526]">
      <header className="border-b border-[#E0DCC8] bg-white">
        <div className="max-w-3xl mx-auto px-4 py-5 flex justify-center sm:justify-start">
          <Link href="/" className="inline-block">
            <Image
              src="/images/global/50th-logo.png"
              alt="LDMA 50th Anniversary"
              width={280}
              height={80}
              className="h-12 w-auto object-contain"
              unoptimized
            />
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 sm:py-12 space-y-10">
        <section className="text-center space-y-4">
          <p className="text-xs font-bold tracking-widest uppercase text-[#B8860B]">
            Exclusive offer &middot; longtime GPAA Lifetime members
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold leading-tight text-[#1C2526]">
            Upgrade to dual GPAA + LDMA Lifetime
          </h1>
          <p className="text-lg sm:text-xl text-[#444444] leading-relaxed max-w-2xl mx-auto">
            One combined Lifetime Membership for both organizations • LDMA retails for{" "}
            <strong>${GPAA_LIFETIME_UPGRADE_LDMA_RETAIL.toLocaleString()}</strong> • yours from{" "}
            <strong className="text-[#B8860B]">${GPAA_LIFETIME_UPGRADE_PRICE_DUAL}</strong>
          </p>
        </section>

        <section className="rounded-xl border border-[#E0DCC8] bg-white p-6 sm:p-8">
          <h2 className="text-xl font-bold mb-3">What you are upgrading to</h2>
          <p className="text-base sm:text-lg leading-relaxed text-[#333333]">
            Your GPAA Lifetime Membership becomes a <strong>dual GPAA/LDMA Lifetime Membership</strong>.
            You keep GPAA benefits and gain LDMA Lifetime access • private campgrounds, patented claims,
            member events, and the LDMA camp community.
          </p>
        </section>

        <section className="rounded-xl border border-[#E0DCC8] bg-[#F5F6F0] p-6 sm:p-8 text-center">
          <Image
            src={GPAA_LIFETIME_UPGRADE_PAYDIRT_IMAGE}
            alt="Digger's Concentrates Paydirt bag"
            width={220}
            height={280}
            className="mx-auto mb-4 rounded-lg"
            unoptimized
          />
          <p className="text-lg font-bold text-[#1C2526]">
            Includes ${GPAA_LIFETIME_UPGRADE_PAYDIRT_VALUE} LDMA Paydirt Bag
          </p>
          <p className="text-sm text-[#555555] mt-1">
            Celebrating 250 years of the USA and 50 years of LDMA
          </p>
        </section>

        <ul className="space-y-3 text-base sm:text-lg text-[#333333] list-none pl-0">
          <li>• Dual GPAA/LDMA Lifetime Membership • full benefits of both under one membership</li>
          <li>• ${GPAA_LIFETIME_UPGRADE_PAYDIRT_VALUE} paydirt bag included with the $500 upgrade</li>
          <li>• $10 monthly maintenance begins January 2027 • not billed before then</li>
          <li>• LDMA campgrounds and claims nationwide</li>
        </ul>

        <div className="space-y-6">
          {options.map((option) => (
            <section
              key={option.anchorId}
              id={option.anchorId}
              className={`rounded-xl border-2 p-6 sm:p-8 scroll-mt-6 ${
                option.highlight
                  ? "border-[#B8860B] bg-[#FFF9EB]"
                  : "border-[#E0DCC8] bg-white"
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                <h2 className="text-xl sm:text-2xl font-bold">{option.title}</h2>
                {option.retailCompare != null && (
                  <p className="text-sm text-[#666666]">
                    <span className="line-through">${option.retailCompare.toLocaleString()}</span>
                    {" → "}
                    <span className="text-2xl font-bold text-[#B8860B]">${option.price}</span>
                  </p>
                )}
              </div>
              <p className="text-[#444444] mb-4">{option.subtitle}</p>
              <ul className="space-y-2 mb-6 text-[#333333]">
                {option.bullets.map((b) => (
                  <li key={b}>• {b}</li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => handleAdd(option)}
                disabled={addingAnchor !== null}
                className={`w-full sm:w-auto min-w-[240px] py-4 px-8 rounded-lg font-bold text-lg transition-colors disabled:opacity-70 ${
                  option.highlight
                    ? "bg-[#1C2526] text-white hover:bg-[#2a3536]"
                    : "bg-[#B8860B] text-white hover:bg-[#9a7209]"
                }`}
              >
                {addingAnchor === option.anchorId ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Adding…
                  </span>
                ) : (
                  `Upgrade now • $${option.price}`
                )}
              </button>
            </section>
          ))}
        </div>

        {error && (
          <p className="text-center text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        <section className="rounded-xl border border-[#E0DCC8] bg-white p-6 sm:p-8 text-center space-y-4">
          <p className="text-lg font-bold">Prefer to order by phone?</p>
          <a
            href="tel:8884653717"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 border-2 border-[#B8860B] text-[#B8860B] font-bold text-lg rounded-lg hover:bg-[#FFF9EB] transition-colors"
          >
            <Phone className="w-5 h-5" />
            Call (888) 465-3717
          </a>
          <p className="text-sm text-[#666666]">
            Mention the <strong>$500 dual GPAA/LDMA Lifetime offer</strong>
          </p>
        </section>

        <p className="text-xs text-[#777777] leading-relaxed pb-8">
          Offer for qualifying GPAA Lifetime members while this promotion is active. Upgrade converts
          active. Upgrade converts membership to dual GPAA/LDMA Lifetime status. $10 monthly maintenance
          begins January 2027; keeping maintenance current is required to remain in good standing. Legacy
          bundle optional at time of upgrade. Full membership contract and terms provided at purchase.
        </p>
      </main>
    </div>
  );
}
