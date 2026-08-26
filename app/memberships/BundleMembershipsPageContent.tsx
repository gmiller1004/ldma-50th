"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Shield, Sparkles, Phone, MapPin, Check, Gift } from "lucide-react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getBundleMembershipProducts, type MembershipBundleProductInfo } from "@/app/actions/membership-bundles";
import { addMembershipToCart } from "@/app/actions/cart";
import { useCart } from "@/context/CartContext";
import { trackAddToCart } from "@/lib/analytics";
import { MEMBERSHIP_METRICS, trackMembershipMetricOnsite } from "@/lib/klaviyo-membership-browser";

const HERO_FALLBACK = {
  src: "/images/memberships/axiom-lite-bundle-hero.jpg",
  alt: "Garrett Axiom Lite, LDMA 50th Anniversary, and The Founder Bag",
};

const AXIOM_CUTOUT = {
  src: "/images/memberships/axiom-lite.jpg",
  alt: "Garrett Axiom Lite pulse induction gold detector with 11-inch mono coil",
};

const FOUNDER_BAG_IMAGE = {
  src: "/images/memberships/founder-bag.jpg",
  alt: "The Founder Bag paydirt pouch on a wooden table with gold nuggets",
};

const DETECTOR_RETAIL = "$2,299";

const DETECTOR_FEATURES = [
  "Pulse induction built for mineralized gold ground",
  "Lightest in its class: 4.2 lb with the included 11\" coil",
  "Folds from 61.5\" down to 25\" for the truck or the plane",
  "About 16 hours on the built-in battery, charged over USB-C",
];

const DETECTOR_SPECS = [
  "Terra-Scan dual-channel ground balance for mineralized ground and salt",
  "Carbon fiber shaft; optional AA booster pack",
  "Integrated Z-Lynk wireless audio, about 17 ms latency",
  "Includes 11×7\" mono coil, coil cover, charger, and carry bag",
  "Rainproof control box and waterproof coil",
  "PWM or VCO audio, four timing modes",
  "3-year warranty, made in the USA",
];

const FAMILY_EXTRAS = [
  {
    title: "Bring a companion",
    value: "$1,250 value",
    story:
      "An eligible family member gets their own membership — so they can camp and prospect even when you cannot make the trip.",
  },
  {
    title: "Keep it in the family",
    value: "$1,250 value",
    story: "When the time comes, your membership can pass to an heir instead of ending with you.",
  },
  {
    title: "Transfer fee already paid",
    value: "$750 value",
    story: "The transfer fee is covered now, so your family does not have to pay it later.",
  },
];

const INCLUDED_ITEMS = [
  "LDMA Lifetime — 12 private campgrounds on patented gold-bearing claims",
  "GPAA Lifetime — 93,000+ additional acres of claims and leases nationwide",
  "A companion membership, plus the ability to pass yours on — with the transfer fee already paid",
  `Garrett Axiom Lite detector (${DETECTOR_RETAIL} retail) with 11×7" mono coil, cover, charger, and bag`,
  "The Founder Bag, free with new membership through September 30",
];

const BUNDLE_FAQS = [
  {
    q: "What is included?",
    a: `Lifetime membership in both LDMA and GPAA, a companion membership, the ability to pass your membership to an heir with the transfer fee already paid, and a Garrett Axiom Lite detector. Through September 30, new members also receive The Founder Bag.`,
  },
  {
    q: "What is The Founder Bag?",
    a: "The Founder Bag is a commemorative paydirt bag in memory of GPAA founder George “Buzzard” Massie. It is included free with new LDMA memberships on this site — and with GPAA Lifetime memberships at gpaalifetime.com — during the GPAA SeptMember $250,000 Gold Giveaway, August 26 through September 30. It cannot be purchased on its own. Each day of the giveaway, one Founder Bag includes a bonus mystery gold nugget.",
  },
  {
    q: "What is the Garrett Axiom Lite?",
    a: `Garrett’s lighter pulse-induction gold detector. It is built for mineralized ground, weighs 4.2 lb with the included 11" coil, folds down to 25" for travel, and includes built-in rechargeable power plus Z-Lynk wireless audio. Manufacturer retail is ${DETECTOR_RETAIL}.`,
  },
  {
    q: "Can I review the terms before my membership is activated?",
    a: "Yes. After you purchase, LDMA sends the full contract for your signature so you can review everything before final activation.",
  },
  {
    q: "Is there a cancellation policy and a maintenance fee?",
    a: "Yes. There is a 30-day cancellation policy. A $120 annual maintenance fee applies after the first year.",
  },
];

function formatMoney(amount: string): string {
  const value = Number.parseFloat(amount);
  if (!Number.isFinite(value)) return amount;
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function BundleMembershipsPageContent() {
  const [product, setProduct] = useState<MembershipBundleProductInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const { refreshCart, openDrawer } = useCart();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getBundleMembershipProducts()
      .then((list) => {
        if (!active) return;
        setProduct(list[0] ?? null);
        if (!list[0]) {
          setError("This offer is not available online right now. Please call (888) 465-3717.");
        }
      })
      .catch(() => {
        if (!active) return;
        setError("Could not load this membership offer right now. Please call (888) 465-3717.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const savings = useMemo(() => {
    if (!product?.compareAtPrice) return null;
    const compare = Number.parseFloat(product.compareAtPrice);
    const price = Number.parseFloat(product.price);
    if (!Number.isFinite(compare) || !Number.isFinite(price) || compare <= price) return null;
    return compare - price;
  }, [product]);

  const heroSrc = product?.imageUrl || HERO_FALLBACK.src;
  const heroAlt = product?.imageAlt || HERO_FALLBACK.alt;

  async function handleAddToCart() {
    if (!product) return;
    setAdding(true);
    setError(null);
    trackMembershipMetricOnsite(MEMBERSHIP_METRICS.bundleInterest, {
      source: "memberships_page_add_to_cart",
      bundle_interest: true,
      primary_bundle_key: product.key,
      bundle_keys: [product.key],
      bundle_titles: [product.title],
      line_count: 1,
      subtotal: Number.parseFloat(product.price),
      $value: Number.parseFloat(product.price),
      currency: "USD",
    });
    try {
      await addMembershipToCart([product.variantId]);
      await refreshCart();
      trackAddToCart("membership", Number.parseFloat(product.price));
      openDrawer();
    } catch {
      setError("Could not add this membership to cart. Please try again or call (888) 465-3717.");
    } finally {
      setAdding(false);
    }
  }

  const addToCartButton = (
    <button
      type="button"
      onClick={handleAddToCart}
      disabled={adding || !product?.availableForSale}
      className="w-full py-3.5 px-4 rounded-lg bg-[#d4af37] text-[#1a120b] font-semibold hover:bg-[#f0d48f] transition-colors disabled:opacity-70 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
    >
      {adding ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Adding...
        </>
      ) : product?.availableForSale ? (
        "Join now"
      ) : (
        "Currently unavailable"
      )}
    </button>
  );

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Membership" }]} />
      </div>

      <section className="pt-6 pb-12 md:pt-8 md:pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div
            id="bundle-offer"
            className="relative overflow-hidden rounded-2xl border border-[#d4af37]/25 shadow-[0_12px_34px_rgba(0,0,0,0.35)]"
          >
            <div className="relative aspect-[16/11] sm:aspect-[16/9] lg:aspect-[2/1] min-h-[240px]">
              <Image
                src={heroSrc}
                alt={heroAlt}
                fill
                className="object-cover object-[center_58%]"
                sizes="(max-width: 1152px) 100vw, 1152px"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1a120b] via-[#1a120b]/25 to-transparent" />
            </div>
            <div className="bg-[#1a120b] px-5 py-7 sm:px-8 sm:py-9">
              <p className="inline-flex items-center gap-2 px-3 py-1 rounded bg-[#d4af37]/20 text-[#d4af37] text-sm font-medium">
                Free Founder Bag through September 30
              </p>
              <h1 className="mt-4 font-serif text-3xl sm:text-5xl font-bold text-[#f0d48f] max-w-4xl">
                A lifetime on the gold — and a Garrett Axiom Lite to hunt it
              </h1>
              <p className="mt-4 text-[#e8e0d5]/88 max-w-3xl text-base sm:text-lg leading-relaxed">
                Become an LDMA and GPAA lifetime member. Bring a companion. Keep the membership in the family. Take
                home Garrett&apos;s lightest pulse-induction gold detector. Join during SeptMember and The Founder Bag
                comes with you.
              </p>

              {loading ? (
                <div className="mt-6 flex items-center gap-2 text-[#e8e0d5]/70">
                  <Loader2 className="w-5 h-5 animate-spin text-[#d4af37]" />
                  Loading current price...
                </div>
              ) : product ? (
                <div className="mt-6 max-w-md">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-4xl font-bold text-[#d4af37]">{formatMoney(product.price)}</span>
                    {product.compareAtPrice && (
                      <span className="text-[#e8e0d5]/55 line-through text-lg">
                        {formatMoney(product.compareAtPrice)}
                      </span>
                    )}
                  </div>
                  {savings != null && (
                    <p className="mt-1 text-sm text-[#6dd472] font-semibold">
                      Save about {formatMoney(String(savings))} versus buying it all separately
                    </p>
                  )}
                  <p className="mt-2 text-xs text-[#e8e0d5]/55">
                    Axiom Lite retail is {DETECTOR_RETAIL}. Memberships, family extras, and The Founder Bag are included
                    in this price.
                  </p>
                  <div className="mt-5">{addToCartButton}</div>
                </div>
              ) : (
                <a
                  href="tel:8884653717"
                  className="mt-6 inline-flex items-center justify-center max-w-md w-full py-3.5 px-4 rounded-lg bg-[#d4af37] text-[#1a120b] font-semibold hover:bg-[#f0d48f] transition-colors"
                >
                  Call (888) 465-3717 to join
                </a>
              )}
              <p className="mt-4 text-[#e8e0d5]/70 text-sm">
                Questions? Call{" "}
                <a className="text-[#f0d48f] font-semibold" href="tel:8884653717">
                  (888) 465-3717
                </a>
              </p>
            </div>
          </div>

          {error && <p className="text-red-300 mt-5 text-center">{error}</p>}
        </div>
      </section>

      <section className="py-14 md:py-18">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-[1.05fr_0.95fr] gap-8 items-center">
          <div className="relative aspect-[3/4] max-h-[620px] rounded-2xl overflow-hidden border border-[#d4af37]/25 shadow-[0_12px_34px_rgba(0,0,0,0.35)]">
            <Image
              src={FOUNDER_BAG_IMAGE.src}
              alt={FOUNDER_BAG_IMAGE.alt}
              fill
              className="object-cover object-center"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
          <div>
            <p className="inline-flex items-center gap-2 text-[#d4af37] text-xs uppercase tracking-[0.16em] font-semibold">
              <Gift className="w-4 h-4" />
              GPAA SeptMember · August 26 – September 30
            </p>
            <h2 className="mt-3 font-serif text-3xl md:text-4xl text-[#f0d48f] font-bold">
              The Founder Bag comes free with new membership
            </h2>
            <p className="mt-4 text-[#e8e0d5]/86 text-sm sm:text-base leading-relaxed">
              During the GPAA SeptMember $250,000 Gold Giveaway, every new LDMA membership on this site includes The
              Founder Bag — a commemorative paydirt bag in memory of GPAA founder George &quot;Buzzard&quot; Massie.
            </p>
            <ul className="mt-5 space-y-3 text-[#e8e0d5]/86 text-sm sm:text-base">
              <li className="flex gap-2">
                <Check className="w-4 h-4 text-[#d4af37] mt-1 shrink-0" />
                <span>It is a gift with membership. It cannot be purchased on its own.</span>
              </li>
              <li className="flex gap-2">
                <Check className="w-4 h-4 text-[#d4af37] mt-1 shrink-0" />
                <span>
                  Available only with new LDMA memberships here, and with GPAA Lifetime memberships at{" "}
                  <a
                    href="https://gpaalifetime.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#f0d48f] font-semibold underline underline-offset-2"
                  >
                    gpaalifetime.com
                  </a>
                  .
                </span>
              </li>
              <li className="flex gap-2">
                <Check className="w-4 h-4 text-[#d4af37] mt-1 shrink-0" />
                <span>Each day of the giveaway, one Founder Bag includes a bonus mystery gold nugget.</span>
              </li>
            </ul>
            <p className="mt-5 text-[#e8e0d5]/65 text-sm">
              The giveaway runs August 26 through September 30. Join during that window to receive The Founder Bag with
              this membership.
            </p>
          </div>
        </div>
      </section>

      <section className="py-14 md:py-18 bg-[#0f3d1e]/30 border-y border-[#d4af37]/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-10">
          <div>
            <h2 className="font-serif text-3xl text-[#f0d48f] font-bold">Everything that comes with you</h2>
            <p className="mt-4 text-[#e8e0d5]/84 text-sm leading-relaxed">
              This is the membership families actually use: a place to camp, gold to hunt, someone to bring along, and
              a plan for the next generation — plus a detector that is ready for the first trip.
            </p>
            <ul className="mt-5 space-y-2 text-[#e8e0d5]/88 text-sm">
              {INCLUDED_ITEMS.map((item) => (
                <li key={item} className="flex gap-2">
                  <Check className="w-4 h-4 text-[#d4af37] mt-0.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 space-y-3">
              {FAMILY_EXTRAS.map((item) => (
                <div key={item.title} className="rounded-lg border border-[#d4af37]/20 bg-[#1a120b]/60 p-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-[#d4af37] font-semibold text-sm">{item.title}</p>
                    <span className="text-[#6dd472] text-xs font-semibold">{item.value}</span>
                  </div>
                  <p className="text-[#e8e0d5]/80 text-sm mt-1">{item.story}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h2 className="font-serif text-3xl text-[#f0d48f] font-bold">Private camps. Nationwide claims.</h2>
            <p className="mt-4 text-[#e8e0d5]/84 text-sm leading-relaxed">
              You are not just buying a detector. You are joining two lifetime clubs that open the ground — LDMA for
              private campgrounds on patented gold properties, and GPAA for claims and leases all over the country.
            </p>

            <div className="mt-5 rounded-xl border border-[#d4af37]/20 bg-[#1a120b]/60 p-4">
              <p className="text-[#d4af37] font-semibold text-sm">With LDMA Lifetime</p>
              <ul className="mt-2 space-y-2 text-[#e8e0d5]/84 text-sm">
                <li className="flex gap-2">
                  <MapPin className="w-4 h-4 text-[#d4af37] mt-0.5 shrink-0" />
                  <span>12 private campgrounds across 8 states, on patented, gold-bearing properties.</span>
                </li>
                <li className="flex gap-2">
                  <MapPin className="w-4 h-4 text-[#d4af37] mt-0.5 shrink-0" />
                  <span>Weekend trips or long stays, with a community that has been doing this since 1976.</span>
                </li>
                <li className="flex gap-2">
                  <MapPin className="w-4 h-4 text-[#d4af37] mt-0.5 shrink-0" />
                  <span>A membership that can stay in the family when you are ready to pass it on.</span>
                </li>
              </ul>
            </div>

            <div className="mt-4 rounded-xl border border-[#d4af37]/20 bg-[#1a120b]/60 p-4">
              <p className="text-[#d4af37] font-semibold text-sm">With GPAA Lifetime</p>
              <ul className="mt-2 space-y-2 text-[#e8e0d5]/84 text-sm">
                <li className="flex gap-2">
                  <MapPin className="w-4 h-4 text-[#d4af37] mt-0.5 shrink-0" />
                  <span>93,000+ additional acres and 200+ claims and leases nationwide, beyond the LDMA camps.</span>
                </li>
                <li className="flex gap-2">
                  <MapPin className="w-4 h-4 text-[#d4af37] mt-0.5 shrink-0" />
                  <span>Chapters, claim reports, events, and the resources that help you pick the next hunt.</span>
                </li>
                <li className="flex gap-2">
                  <MapPin className="w-4 h-4 text-[#d4af37] mt-0.5 shrink-0" />
                  <span>Publications and member programs that keep you in the field all year.</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 p-4 rounded-xl border border-[#d4af37]/25 bg-[#1a120b]/70">
              <p className="text-[#e8e0d5]/80 text-xs uppercase tracking-[0.16em]">Also at GPAA</p>
              <p className="mt-2 text-[#f0d48f] font-serif text-2xl font-bold">GPAA Lifetime membership</p>
              <p className="mt-2 text-[#e8e0d5]/78 text-sm">
                Want GPAA Lifetime on its own? The Founder Bag is included there too during SeptMember.
              </p>
              <a
                href="https://gpaalifetime.com"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-[#d4af37] text-[#1a120b] font-semibold hover:bg-[#f0d48f] transition-colors"
              >
                Visit gpaalifetime.com
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="py-14 md:py-18">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-[1.15fr_0.85fr] gap-8">
          <div className="rounded-2xl border border-[#d4af37]/20 bg-[#1a120b]/65 p-6 md:p-7">
            <p className="text-[#d4af37] text-xs uppercase tracking-[0.16em]">Life at camp</p>
            <h2 className="mt-2 font-serif text-3xl text-[#f0d48f] font-bold">
              Built for real trips, not a one-weekend hobby
            </h2>
            <p className="mt-4 text-[#e8e0d5]/86 text-sm leading-relaxed">
              LDMA is how families actually get on the gold: a long weekend, a month at camp, a favorite site you return
              to until you know the ground. Private access, people who will show you the ropes, and nights that cost
              less than a hotel.
            </p>
            <p className="mt-4 text-[#e8e0d5]/82 text-sm leading-relaxed">
              This membership puts the detector, the camps, and the family extras together so your first trip is the
              start of the habit — not a pile of separate purchases.
            </p>
            <a
              href="/campgrounds"
              className="mt-5 inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-[#d4af37] text-[#1a120b] font-semibold hover:bg-[#f0d48f] transition-colors"
            >
              See the campgrounds
            </a>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-[#d4af37]/20 bg-[#1a120b]/60 p-4">
              <p className="text-[#d4af37] font-semibold text-sm">Member camping rates</p>
              <p className="mt-1 text-[#e8e0d5]/82 text-sm">
                Typical member rates are about <strong>$6/night dry</strong> and <strong>$12/night full hookups</strong>
                (varies by camp).
              </p>
            </div>
            <div className="rounded-xl border border-[#d4af37]/20 bg-[#1a120b]/60 p-4">
              <p className="text-[#d4af37] font-semibold text-sm">Events and member pricing</p>
              <p className="mt-1 text-[#e8e0d5]/82 text-sm">
                Come for DirtFest, Gold Diggin&apos;s, and camp gatherings — with member pricing on select events when
                it is offered.
              </p>
            </div>
            <div className="rounded-xl border border-[#d4af37]/20 bg-[#1a120b]/60 p-4">
              <p className="text-[#d4af37] font-semibold text-sm">Gear discounts and partner perks</p>
              <p className="mt-1 text-[#e8e0d5]/82 text-sm">
                Members get equipment offers and partner promotions that make it easier to kit out the next trip.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-14 md:py-18">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="font-serif text-3xl text-[#f0d48f] font-bold text-center">Meet the Garrett Axiom Lite</h2>
          <p className="mt-4 text-center text-[#e8e0d5]/78 max-w-3xl mx-auto">
            A pulse-induction gold detector that is light enough to swing all day and compact enough to throw in the
            truck. It ships with the 11×7&quot; mono coil; extra coils are available from Garrett.
          </p>
          <div className="mt-8 rounded-2xl border border-[#d4af37]/20 bg-[#1a120b]/65 overflow-hidden">
            <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[#d4af37] text-xs uppercase tracking-wider">Included detector</p>
                <h3 className="font-serif text-xl text-[#f0d48f] font-semibold mt-1">Garrett Axiom Lite</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="inline-flex items-center px-2.5 py-1 rounded bg-[#d4af37]/20 text-[#d4af37] text-xs font-semibold">
                    Detector retail: {DETECTOR_RETAIL}
                  </span>
                  {product && (
                    <>
                      <span className="inline-flex items-center px-2.5 py-1 rounded bg-[#f0d48f]/20 text-[#f0d48f] text-xs font-semibold">
                        Membership price: {formatMoney(product.price)}
                      </span>
                      {savings != null && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded bg-[#6dd472]/20 text-[#6dd472] text-xs font-semibold">
                          You save about {formatMoney(String(savings))}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="relative aspect-[2.3/1] bg-black border-t border-[#d4af37]/15">
              <Image
                src={AXIOM_CUTOUT.src}
                alt={AXIOM_CUTOUT.alt}
                fill
                className="object-contain"
                sizes="(max-width: 1152px) 100vw, 1152px"
              />
            </div>
            <div className="px-5 py-5 grid sm:grid-cols-2 gap-x-8 gap-y-2">
              {DETECTOR_FEATURES.concat(DETECTOR_SPECS).map((spec) => (
                <p key={spec} className="flex gap-2 text-[#e8e0d5]/86 text-sm">
                  <Sparkles className="w-4 h-4 text-[#d4af37] mt-0.5 shrink-0" />
                  <span>{spec}</span>
                </p>
              ))}
              <p className="sm:col-span-2 mt-3 text-xs text-[#e8e0d5]/55">Sources: garrett.com.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="membership-cta" className="py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#f0d48f]">Come join us</h2>
          <p className="text-[#e8e0d5]/80 mt-4 max-w-3xl mx-auto">
            Add this membership to cart and check out. We send the full contract after purchase so you can review the
            terms before it is activated. The Founder Bag is included with new memberships through September 30.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-6 text-sm text-[#e8e0d5]/70">
            <span className="inline-flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#6dd472]" />
              30-day cancellation policy
            </span>
            <span className="inline-flex items-center gap-2">
              <Phone className="w-4 h-4 text-[#6dd472]" />
              (888) 465-3717
            </span>
          </div>
          <div className="mt-7">
            <a
              href="#bundle-offer"
              className="inline-flex items-center justify-center gap-2 px-7 py-3 rounded-lg bg-[#d4af37] text-[#1a120b] font-semibold hover:bg-[#f0d48f] transition-colors"
            >
              Get this membership
            </a>
          </div>
          <p className="mt-5 text-xs text-[#e8e0d5]/50">
            Offers are available for a limited time while supplies last. The Founder Bag is a SeptMember gift from
            August 26 through September 30 and is not sold separately.
          </p>
          <div className="mt-10 text-left">
            <h3 className="font-serif text-2xl font-bold text-[#f0d48f] text-center">Questions we hear a lot</h3>
            <div className="mt-4 space-y-3">
              {BUNDLE_FAQS.map((item) => (
                <details
                  key={item.q}
                  className="rounded-xl border border-[#d4af37]/20 bg-[#1a120b]/60 overflow-hidden"
                >
                  <summary className="cursor-pointer list-none px-4 py-3 text-[#f0d48f] font-semibold text-sm">
                    {item.q}
                  </summary>
                  <p className="px-4 pb-4 text-[#e8e0d5]/80 text-sm leading-relaxed">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
