"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRightLeft,
  BadgeCheck,
  CalendarClock,
  Check,
  ChevronDown,
  FileText,
  Loader2,
  MapPin,
  Phone,
  Shield,
  Sparkles,
  Tent,
  Users,
} from "lucide-react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getBundleMembershipProducts, type MembershipBundleProductInfo } from "@/app/actions/membership-bundles";
import { addMembershipToCart } from "@/app/actions/cart";
import { useCart } from "@/context/CartContext";
import { trackAddToCart } from "@/lib/analytics";
import { MEMBERSHIP_METRICS, trackMembershipMetricOnsite } from "@/lib/klaviyo-membership-browser";

const HERO_PHOTO = {
  src: "/images/home/member-john-m.jpg",
};

const AXIOM_CUTOUT = {
  src: "/images/memberships/axiom-lite.jpg",
  alt: "Garrett Axiom Lite gold detector with its large flat search coil",
};

const PAYDIRT_CUTOUT = {
  src: "/images/memberships/diggers-concentrates-paydirt-cutout.webp",
  alt: "Digger's Concentrates PayDirt, a bag of paydirt for panning at home",
};

const CAMP_PHOTO = {
  src: "/images/campgrounds/stanton-arizona/camp-stanton.jpg",
};

const DETECTOR_RETAIL = "$2,299";
const PAYDIRT_VALUE = "$50";
const PHONE_DISPLAY = "(888) 465-3717";

const DETECTOR_FEATURES = [
  "Pulse induction, a detector type built for mineral-rich gold country",
  "4.2 lb with the included 11×7\" search coil, light enough to swing all day",
  "Folds from 61.5\" down to 25\" to fit in a truck or carry-on",
  "About 16 hours per charge on the built-in battery, charged over USB-C",
];

const DETECTOR_SPECS = [
  "Ground balance for mineralized ground and salt",
  "Carbon fiber shaft; optional AA booster pack",
  "Built-in Z-Lynk wireless audio, about 17 ms latency",
  "Includes search coil, coil cover, charger, and carry bag",
  "Rainproof control box and waterproof coil",
  "3-year warranty, made in the USA",
];

const FAMILY_LEGACY_ITEMS = [
  {
    title: "Companion",
    value: "$1,250 value",
    story: "An additional membership to share with anyone.",
    plain: "Give it to a friend, a partner, or a neighbor, whoever you want to camp and prospect with. It does not have to be family.",
    Icon: Users,
  },
  {
    title: "Transferability",
    value: "$1,250 value",
    story: "Pass your membership on to a person of your choice.",
    plain: "A lifetime membership does not have to end with you. When you are ready, you decide who gets it.",
    Icon: ArrowRightLeft,
  },
  {
    title: "Pre-Paid Transfer",
    value: "$750 value",
    story: "The transfer fee is already covered.",
    plain: "Passing a membership on normally carries a fee. Yours is paid in advance, so there is nothing to pay when the time comes.",
    Icon: BadgeCheck,
  },
];

const BEFORE_YOU_BUY = [
  {
    title: "30-day cancellation policy",
    body: "Changed your mind? There is a 30-day cancellation policy. Call us with any questions about how it works.",
    Icon: Shield,
  },
  {
    title: "Contract before activation",
    body: "We email your contract right after you buy. Review it and sign it before your membership is finalized.",
    Icon: FileText,
  },
  {
    title: "$120 a year after year one",
    body: "Annual maintenance is $120, starting after your first year. Camping is billed separately at the nightly rate.",
    Icon: CalendarClock,
  },
  {
    title: "A real person to talk to",
    body: `Questions, or want to ask about payment plans? Call ${PHONE_DISPLAY}.`,
    Icon: Phone,
  },
];

const LEGACY = {
  text: "#ff8a5c",
  tag: "#d9532f",
  bg: "#30160c",
};

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
  const [heroCtaVisible, setHeroCtaVisible] = useState(true);
  const [closingVisible, setClosingVisible] = useState(false);
  const heroCtaRef = useRef<HTMLDivElement | null>(null);
  const closingRef = useRef<HTMLElement | null>(null);
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
          setError(`Online checkout is not available right now. Please call ${PHONE_DISPLAY} and we will help you join.`);
        }
      })
      .catch(() => {
        if (!active) return;
        setError(`We could not load the membership price right now. Please call ${PHONE_DISPLAY} and we will help you join.`);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Sticky mobile CTA: show once the hero CTA scrolls away, hide again at the closing section.
  useEffect(() => {
    const heroEl = heroCtaRef.current;
    const closingEl = closingRef.current;
    if (!heroEl || !closingEl || typeof IntersectionObserver === "undefined") return;
    const heroObserver = new IntersectionObserver(([entry]) => setHeroCtaVisible(entry.isIntersecting));
    const closingObserver = new IntersectionObserver(([entry]) => setClosingVisible(entry.isIntersecting));
    heroObserver.observe(heroEl);
    closingObserver.observe(closingEl);
    return () => {
      heroObserver.disconnect();
      closingObserver.disconnect();
    };
    // The hero CTA only renders after the product finishes loading.
  }, [loading]);

  const savings = useMemo(() => {
    if (!product?.compareAtPrice) return null;
    const compare = Number.parseFloat(product.compareAtPrice);
    const price = Number.parseFloat(product.price);
    if (!Number.isFinite(compare) || !Number.isFinite(price) || compare <= price) return null;
    return compare - price;
  }, [product]);

  const priceLabel = product ? formatMoney(product.price) : null;

  const faqs = useMemo(
    () => [
      {
        q: "What exactly do I get?",
        a: `${priceLabel ? `For ${priceLabel}, you` : "You"} get lifetime membership in the Lost Dutchman’s Mining Association (LDMA) and the Gold Prospectors Association of America (GPAA); the Family Legacy benefits (a Companion membership to share with anyone, Transferability to pass your membership on to a person of your choice, and a Pre-Paid Transfer so the transfer fee is already covered); a Garrett Axiom Lite gold detector (${DETECTOR_RETAIL} retail); and a bag of Digger’s Concentrates PayDirt to pan at home (${PAYDIRT_VALUE} value). Member camping is billed separately at the nightly rate.`,
      },
      {
        q: "Who is behind this, and how long have you been around?",
        a: "The Lost Dutchman’s Mining Association has been getting prospectors onto gold-bearing land since 1976. This is our 50th anniversary year. The Gold Prospectors Association of America is a national prospecting organization with claims and leases across the country, and your purchase includes a lifetime membership in both.",
      },
      {
        q: "What happens after I pay?",
        a: `We email you the full contract right after your purchase. You review it and sign it, so you can see every term before your membership is finalized. If you have questions about the contract or about when your detector and PayDirt will arrive, call ${PHONE_DISPLAY}.`,
      },
      {
        q: "Are there ongoing costs?",
        a: "Yes, and we want you to know up front. Annual maintenance is $120, starting after your first year. Camping is billed separately at the member nightly rate of $6 dry or $12 with RV hookups.",
      },
      {
        q: "What if I change my mind?",
        a: `There is a 30-day cancellation policy. Call ${PHONE_DISPLAY} with any questions about how it works.`,
      },
      {
        q: "Can I pay over time?",
        a: `Payment plans may be available. Call ${PHONE_DISPLAY} to ask about them before you buy.`,
      },
      {
        q: "Who can I share the Companion membership with?",
        a: "Anyone you choose. It is an additional membership, and it does not have to go to a family member.",
      },
      {
        q: "What do Transferability and Pre-Paid Transfer mean?",
        a: "Transferability means you can pass your membership on to a person of your choice. Pre-Paid Transfer means the transfer fee is already covered, so you will not pay it when you do.",
      },
      {
        q: "What does camping cost?",
        a: "Members pay $6 a night for dry camping and $12 a night with RV hookups. Nightly rates vary by camp, and hookups are available at select camps. At those rates, a seven-night stay is $42 dry or $84 with hookups.",
      },
      {
        q: "Is it worth it if I only camp a few times a year?",
        a: "Your lifetime membership covers more than camping: access to 12 private campgrounds, additional GPAA claims and leases nationwide, the Garrett Axiom Lite detector, and PayDirt to pan at home. When you do camp, compare the member nightly rate with what you usually pay for a campsite.",
      },
      {
        q: "What is the Garrett Axiom Lite?",
        a: `A gold detector from Garrett. It uses pulse induction, a type that works well in mineral-rich ground. It weighs 4.2 lb with the included 11×7" search coil, folds down to 25" for travel, and runs on a built-in rechargeable battery. Manufacturer retail is ${DETECTOR_RETAIL}.`,
      },
      {
        q: "Can I talk to someone before I buy?",
        a: `Yes. Call ${PHONE_DISPLAY}.`,
      },
    ],
    [priceLabel]
  );

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
      setError(`We could not add this membership to your cart. Please try again or call ${PHONE_DISPLAY}.`);
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
          Adding to cart...
        </>
      ) : product?.availableForSale ? (
        `Join for ${priceLabel}`
      ) : (
        "Currently unavailable"
      )}
    </button>
  );

  const showStickyBar = !heroCtaVisible && !closingVisible && !!product;

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0" aria-hidden="true">
          <Image
            src={HERO_PHOTO.src}
            alt=""
            fill
            className="object-cover object-[25%_center] opacity-45"
            sizes="100vw"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#1a120b]/85 via-[#1a120b]/90 to-[#1a120b]" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#1a120b] to-transparent" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-10 md:pb-14">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Membership" }]} />

          <div className="mt-6 grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] gap-x-10 gap-y-7 items-start">
            <div>
              <p className="text-[#d4af37] text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase">
                Lifetime membership · Since 1976
              </p>
              <h1 className="mt-3 font-serif text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.05] text-[#f5efe4]">
                Camp and prospect on private gold ground,{" "}
                <em className="text-[#d4af37] font-medium">for life.</em>
              </h1>
              <p className="mt-4 text-[#e8e0d5]/85 max-w-xl text-base sm:text-lg leading-relaxed">
                Join the Lost Dutchman&apos;s Mining Association (LDMA) and the Gold Prospectors Association of America
                (GPAA) for life. You get 12 private campgrounds from $6 a night, a Garrett Axiom Lite gold detector,
                and a bag of paydirt to pan, so your first trip is covered.
              </p>
            </div>

            {/* Price card */}
            <div
              id="bundle-offer"
              className="lg:row-span-2 scroll-mt-24 rounded-2xl border border-[#d4af37]/40 bg-gradient-to-b from-[#1e1809] to-[#0d0a04] p-5 sm:p-7 shadow-[0_12px_34px_rgba(0,0,0,0.45)]"
            >
              <p className="text-center text-[#e8e0d5] text-xs font-semibold tracking-[0.16em] uppercase">
                Lifetime membership + detector
              </p>
              {loading ? (
                <div className="mt-6 mb-4 flex items-center justify-center gap-2 text-[#e8e0d5]/70">
                  <Loader2 className="w-5 h-5 animate-spin text-[#d4af37]" />
                  Loading price...
                </div>
              ) : product ? (
                <>
                  <p className="mt-2 text-center font-serif text-6xl sm:text-7xl font-bold leading-none text-[#d4af37]">
                    {priceLabel}
                  </p>
                  {product.compareAtPrice && (
                    <p className="mt-2 text-center text-sm text-[#cfc6b8]">
                      Everything included, bought separately: <s>{formatMoney(product.compareAtPrice)}</s>
                    </p>
                  )}
                  {savings != null && (
                    <p className="mt-3 text-center">
                      <span className="inline-block rounded-full bg-[#d4af37] px-4 py-1 text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[#1a120b]">
                        You save {formatMoney(String(savings))}
                      </span>
                    </p>
                  )}
                  <div ref={heroCtaRef} className="mt-5">
                    {addToCartButton}
                  </div>
                </>
              ) : (
                <div ref={heroCtaRef} className="mt-5">
                  <a
                    href="tel:8884653717"
                    className="inline-flex w-full items-center justify-center py-3.5 px-4 rounded-lg bg-[#d4af37] text-[#1a120b] font-semibold hover:bg-[#f0d48f] transition-colors"
                  >
                    Call {PHONE_DISPLAY} to join
                  </a>
                </div>
              )}
              {error && <p className="mt-3 text-center text-sm text-red-300">{error}</p>}

              <div className="mt-4 rounded-lg border border-[#d4af37]/60 bg-[#2c210d] px-3 py-2 text-center text-sm text-[#f5efe4]">
                <p className="flex items-center justify-center gap-2">
                  <Tent className="w-4 h-4 shrink-0 text-[#d4af37]" />
                  <span>
                    Member camping: <strong className="text-[#d4af37]">$6</strong>/night dry ·{" "}
                    <strong className="text-[#d4af37]">$12</strong>/night with RV hookups
                  </span>
                </p>
                <p className="mt-0.5 text-[11px] text-[#e8e0d5]/65">Rates vary by camp; hookups at select camps.</p>
              </div>

              <ul className="mt-4 space-y-1.5 text-xs sm:text-sm text-[#e8e0d5]/80">
                <li className="flex items-start gap-2">
                  <Shield className="w-4 h-4 mt-0.5 text-[#6dd472] shrink-0" />
                  30-day cancellation policy
                </li>
                <li className="flex items-start gap-2">
                  <FileText className="w-4 h-4 mt-0.5 text-[#6dd472] shrink-0" />
                  Contract emailed after purchase. Review and sign before activation.
                </li>
                <li className="flex items-start gap-2">
                  <CalendarClock className="w-4 h-4 mt-0.5 text-[#6dd472] shrink-0" />
                  $120 a year maintenance starts after year one
                </li>
                <li className="flex items-start gap-2">
                  <Phone className="w-4 h-4 mt-0.5 text-[#6dd472] shrink-0" />
                  <span>
                    Questions or payment plans?{" "}
                    <a className="text-[#f0d48f] font-semibold whitespace-nowrap" href="tel:8884653717">
                      {PHONE_DISPLAY}
                    </a>
                  </span>
                </li>
              </ul>
            </div>

            {/* Product visual */}
            <div className="relative overflow-hidden rounded-2xl border border-[#d4af37]/25 bg-black">
              <div className="relative aspect-[16/8] sm:aspect-[2.1/1]">
                <div className="absolute inset-y-0 left-0 w-[68%]">
                  <Image
                    src={AXIOM_CUTOUT.src}
                    alt={AXIOM_CUTOUT.alt}
                    fill
                    className="object-contain"
                    sizes="(max-width: 1024px) 70vw, 460px"
                    priority
                  />
                </div>
                <div
                  className="absolute right-[3%] top-1/2 h-[96%] aspect-square -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.38)_0%,rgba(212,175,55,0.1)_55%,transparent_70%)]"
                  aria-hidden="true"
                />
                <div className="absolute right-[7%] top-[8%] bottom-[8%] w-[24%]">
                  <Image
                    src={PAYDIRT_CUTOUT.src}
                    alt={PAYDIRT_CUTOUT.alt}
                    fill
                    className="object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.6)]"
                    sizes="(max-width: 1024px) 24vw, 150px"
                  />
                </div>
              </div>
              <p className="border-t border-[#d4af37]/15 px-4 py-2.5 text-center text-[11px] sm:text-xs font-bold uppercase tracking-[0.08em] text-[#e8e0d5]">
                Included: Garrett Axiom Lite gold detector <span className="text-[#d4af37]">+</span> Digger&apos;s
                Concentrates PayDirt
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Family Legacy */}
      <section className="py-10 md:py-14">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div
            className="relative overflow-hidden rounded-3xl border-2 p-5 sm:p-8 lg:p-10 shadow-[0_0_60px_rgba(217,83,47,0.18)]"
            style={{ borderColor: LEGACY.tag, backgroundColor: LEGACY.bg }}
          >
            <div
              className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full opacity-30 blur-3xl"
              style={{ backgroundColor: LEGACY.tag }}
              aria-hidden="true"
            />
            <div className="relative flex flex-wrap items-center gap-3">
              <span
                className="inline-flex rounded-full px-4 py-1.5 text-xs font-extrabold uppercase tracking-[0.14em] text-white"
                style={{ backgroundColor: LEGACY.tag }}
              >
                Family Legacy included
              </span>
              <span className="text-lg sm:text-xl font-extrabold" style={{ color: LEGACY.text }}>
                $3,250 value
              </span>
            </div>
            <h2 className="relative mt-4 font-serif text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight text-[#f5efe4]">
              Your membership does not have to{" "}
              <em className="font-medium" style={{ color: LEGACY.text }}>
                stop with you.
              </em>
            </h2>
            <p className="relative mt-3 max-w-3xl text-[#f5efe4]/85 sm:text-lg leading-relaxed">
              Family Legacy is our name for three benefits that come with your lifetime membership at no extra cost.
              Share one membership, pass yours on, and skip the transfer fee. None of it is limited to family.
            </p>

            <div className="relative mt-7 grid gap-4 md:grid-cols-3">
              {FAMILY_LEGACY_ITEMS.map(({ title, value, story, plain, Icon }) => (
                <div
                  key={title}
                  className="flex flex-col rounded-2xl border bg-[#1a0c06]/70 p-5"
                  style={{ borderColor: `${LEGACY.tag}99` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className="flex h-11 w-11 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${LEGACY.tag}33`, color: LEGACY.text }}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span
                      className="rounded-full border px-3 py-1 text-xs font-extrabold"
                      style={{ borderColor: LEGACY.tag, color: LEGACY.text }}
                    >
                      {value}
                    </span>
                  </div>
                  <h3 className="mt-4 font-serif text-2xl font-semibold" style={{ color: LEGACY.text }}>
                    {title}
                  </h3>
                  <p className="mt-1.5 font-semibold text-[#f5efe4] leading-snug">{story}</p>
                  <p className="mt-2 text-sm text-[#f5efe4]/75 leading-relaxed">{plain}</p>
                </div>
              ))}
            </div>
            <p className="relative mt-5 text-sm font-semibold" style={{ color: LEGACY.text }}>
              $1,250 + $1,250 + $750 = $3,250 in Family Legacy value, included in your membership price.
            </p>
          </div>
        </div>
      </section>

      {/* Member camping */}
      <section className="py-4 md:py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl border-2 border-[#d4af37]/60">
            <Image
              src={CAMP_PHOTO.src}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 1152px) 100vw, 1152px"
              aria-hidden="true"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#1a120b]/95 via-[#1a120b]/85 to-[#1a120b]/60" />
            <div className="relative grid gap-6 p-6 sm:p-9 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full bg-[#d4af37] px-3 py-1 text-xs font-extrabold uppercase tracking-[0.12em] text-[#1a120b]">
                  <Tent className="w-4 h-4" />
                  Member camping
                </p>
                <h2 className="mt-3 font-serif text-3xl sm:text-4xl font-semibold text-[#f5efe4]">
                  Camp on private gold ground from $6 a night.
                </h2>
                <p className="mt-2 max-w-xl text-[#e8e0d5]/85 leading-relaxed">
                  Members have 12 private campgrounds in 8 states, set on patented mining claims. Patented claims are
                  privately owned land with full legal title, not public land, and members camp and prospect on them.
                  Come for a weekend or stay for weeks.
                </p>
                <a
                  href="/campgrounds"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#f0d48f] hover:text-[#d4af37]"
                >
                  <MapPin className="w-4 h-4" />
                  See the campgrounds
                </a>
              </div>
              <div className="grid grid-cols-2 gap-3 md:w-[22rem]">
                <div className="rounded-2xl border border-[#d4af37]/50 bg-black/55 p-4 text-center">
                  <p className="font-serif text-5xl sm:text-6xl font-bold leading-none text-[#d4af37]">$6</p>
                  <p className="mt-1.5 text-sm font-semibold text-[#f5efe4]">/night dry</p>
                </div>
                <div className="rounded-2xl border border-[#d4af37]/50 bg-black/55 p-4 text-center">
                  <p className="font-serif text-5xl sm:text-6xl font-bold leading-none text-[#d4af37]">$12</p>
                  <p className="mt-1.5 text-sm font-semibold text-[#f5efe4]">/night with RV hookups*</p>
                </div>
              </div>
            </div>
            <p className="relative px-6 pb-4 sm:px-9 text-xs text-[#e8e0d5]/70">
              *Nightly rates vary by camp; hookups available at select camps.
            </p>
          </div>
        </div>
      </section>

      {/* What you get and what it's worth */}
      <section className="mt-10 md:mt-14 py-12 md:py-16 bg-[#0f3d1e]/30 border-y border-[#d4af37]/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-10">
          <div>
            <p className="text-[#d4af37] text-xs font-semibold tracking-[0.2em] uppercase">What you get</p>
            <h2 className="mt-2 font-serif text-3xl md:text-4xl text-[#f0d48f] font-bold">
              Here is everything, and what it is worth.
            </h2>
            <ul className="mt-6 space-y-3 text-[#e8e0d5]/90">
              <li className="flex gap-3">
                <Check className="w-5 h-5 text-[#d4af37] mt-0.5 shrink-0" />
                <span>
                  <strong className="text-white">LDMA lifetime membership</strong>: 12 private campgrounds across 8
                  states.
                </span>
              </li>
              <li className="flex gap-3">
                <Check className="w-5 h-5 text-[#d4af37] mt-0.5 shrink-0" />
                <span>
                  <strong className="text-white">GPAA lifetime membership</strong>: 93,000+ more acres of mining claims
                  and leases across the country.
                </span>
              </li>
              <li className="flex gap-3">
                <Check className="w-5 h-5 mt-0.5 shrink-0" style={{ color: LEGACY.text }} />
                <span>
                  <strong style={{ color: LEGACY.text }}>Family Legacy</strong>: a Companion membership to share,
                  Transferability to pass yours on, and a Pre-Paid Transfer.{" "}
                  <span className="whitespace-nowrap font-bold" style={{ color: LEGACY.text }}>
                    $3,250 value
                  </span>
                </span>
              </li>
              <li className="flex gap-3">
                <Check className="w-5 h-5 text-[#d4af37] mt-0.5 shrink-0" />
                <span>
                  <strong className="text-white">Garrett Axiom Lite gold detector</strong>: 4.2 lb, with 11×7&quot;
                  search coil.{" "}
                  <span className="whitespace-nowrap font-bold text-[#d4af37]">{DETECTOR_RETAIL} retail</span>
                </span>
              </li>
              <li className="flex gap-3">
                <Check className="w-5 h-5 text-[#d4af37] mt-0.5 shrink-0" />
                <span>
                  <strong className="text-white">Digger&apos;s Concentrates PayDirt</strong>: a bag of paydirt to pan at
                  home.{" "}
                  <span className="whitespace-nowrap font-bold text-[#d4af37]">{PAYDIRT_VALUE} value</span>
                </span>
              </li>
            </ul>

            {product && (
              <div className="mt-6 rounded-xl border border-[#d4af37]/40 bg-[#1a120b]/80 p-4">
                {product.compareAtPrice && (
                  <p className="flex items-baseline justify-between gap-3 text-[#e8e0d5]/85">
                    <span>Everything above, bought separately</span>
                    <s className="font-semibold">{formatMoney(product.compareAtPrice)}</s>
                  </p>
                )}
                <p className="mt-1.5 flex items-baseline justify-between gap-3 text-[#f0d48f]">
                  <span className="font-semibold">Your price</span>
                  <span className="font-serif text-3xl font-bold text-[#d4af37]">{priceLabel}</span>
                </p>
                {savings != null && (
                  <p className="mt-1.5 flex items-baseline justify-between gap-3 border-t border-[#d4af37]/20 pt-2 text-[#6dd472]">
                    <span className="font-semibold">You save</span>
                    <span className="text-lg font-bold">{formatMoney(String(savings))}</span>
                  </p>
                )}
                {product.compareAtPrice && (
                  <p className="mt-3 text-xs leading-relaxed text-[#e8e0d5]/60">
                    The separate price is the typical retail price of everything above bought on its own, including both
                    lifetime memberships. Camping is billed separately at the nightly rate, and $120 annual maintenance
                    starts after your first year.
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <h2 className="font-serif text-3xl text-[#f0d48f] font-bold">Two clubs, one lifetime membership</h2>
            <p className="mt-3 text-[#e8e0d5]/84 text-sm sm:text-base leading-relaxed">
              The Lost Dutchman&apos;s Mining Association has been bringing prospectors to the gold since 1976, and this
              is our 50th anniversary year. Your purchase also makes you a lifetime member of the Gold Prospectors
              Association of America.
            </p>

            <div className="mt-5 rounded-xl border border-[#d4af37]/20 bg-[#1a120b]/60 p-4">
              <p className="text-[#d4af37] font-semibold text-sm">With your LDMA lifetime membership</p>
              <ul className="mt-2 space-y-2 text-[#e8e0d5]/84 text-sm">
                <li className="flex gap-2">
                  <MapPin className="w-4 h-4 text-[#d4af37] mt-0.5 shrink-0" />
                  <span>12 private campgrounds across 8 states, on patented, gold-bearing mining claims.</span>
                </li>
                <li className="flex gap-2">
                  <MapPin className="w-4 h-4 text-[#d4af37] mt-0.5 shrink-0" />
                  <span>Weekend trips or long stays, in a community of prospectors that goes back 50 years.</span>
                </li>
              </ul>
            </div>

            <div className="mt-4 rounded-xl border border-[#d4af37]/20 bg-[#1a120b]/60 p-4">
              <p className="text-[#d4af37] font-semibold text-sm">With your GPAA lifetime membership</p>
              <ul className="mt-2 space-y-2 text-[#e8e0d5]/84 text-sm">
                <li className="flex gap-2">
                  <MapPin className="w-4 h-4 text-[#d4af37] mt-0.5 shrink-0" />
                  <span>
                    93,000+ additional acres and 200+ mining claims and leases nationwide, in addition to the LDMA
                    camps.
                  </span>
                </li>
                <li className="flex gap-2">
                  <MapPin className="w-4 h-4 text-[#d4af37] mt-0.5 shrink-0" />
                  <span>Local chapters, events, and resources to help you pick your next place to prospect.</span>
                </li>
                <li className="flex gap-2">
                  <MapPin className="w-4 h-4 text-[#d4af37] mt-0.5 shrink-0" />
                  <span>Publications and member programs to keep you prospecting all year.</span>
                </li>
              </ul>
            </div>

            <div className="mt-4 rounded-xl border border-[#d4af37]/20 bg-[#1a120b]/60 p-4">
              <p className="text-[#d4af37] font-semibold text-sm">Events, gear, and partner perks</p>
              <p className="mt-1 text-[#e8e0d5]/82 text-sm">
                Come to Digger&apos;s Dirt Parties, Gold Diggin&apos;s, and camp gatherings, with member pricing on
                select events when offered. Members also get equipment offers from partners.
              </p>
            </div>

            <p className="mt-5 text-sm text-[#e8e0d5]/70">
              Only want the national club? Gold Prospectors Association of America lifetime membership is also available
              on its own at{" "}
              <a
                href="https://gpaalifetime.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#f0d48f] font-semibold underline underline-offset-2"
              >
                gpaalifetime.com
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      {/* Gear: Axiom Lite + PayDirt */}
      <section className="py-12 md:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="font-serif text-3xl md:text-4xl text-[#f0d48f] font-bold text-center">
            Gear for your first trip, included
          </h2>
          <p className="mt-3 text-center text-[#e8e0d5]/78 max-w-3xl mx-auto">
            A gold detector light enough to swing all day, and a bag of paydirt to pan when you get home.
          </p>

          <div className="mt-8 grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-5">
            <div className="rounded-2xl border border-[#d4af37]/20 bg-[#1a120b]/65 overflow-hidden">
              <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[#d4af37] text-xs uppercase tracking-wider">Included gold detector</p>
                  <h3 className="font-serif text-2xl text-[#f0d48f] font-semibold mt-1">Garrett Axiom Lite</h3>
                </div>
                <span className="inline-flex items-center px-2.5 py-1 rounded bg-[#d4af37]/20 text-[#d4af37] text-xs font-semibold">
                  {DETECTOR_RETAIL} retail
                </span>
              </div>
              <div className="relative aspect-[2.3/1] bg-black border-t border-[#d4af37]/15">
                <Image
                  src={AXIOM_CUTOUT.src}
                  alt={AXIOM_CUTOUT.alt}
                  fill
                  className="object-contain"
                  sizes="(max-width: 1024px) 100vw, 700px"
                />
              </div>
              <div className="px-5 py-5">
                <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2">
                  {DETECTOR_FEATURES.map((spec) => (
                    <p key={spec} className="flex gap-2 text-[#e8e0d5]/86 text-sm">
                      <Sparkles className="w-4 h-4 text-[#d4af37] mt-0.5 shrink-0" />
                      <span>{spec}</span>
                    </p>
                  ))}
                </div>
                <details className="group mt-4 border-t border-[#d4af37]/15 pt-3">
                  <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-[#f0d48f]">
                    More details
                    <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-3 grid sm:grid-cols-2 gap-x-8 gap-y-2">
                    {DETECTOR_SPECS.map((spec) => (
                      <p key={spec} className="flex gap-2 text-[#e8e0d5]/86 text-sm">
                        <Sparkles className="w-4 h-4 text-[#d4af37] mt-0.5 shrink-0" />
                        <span>{spec}</span>
                      </p>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-[#e8e0d5]/55">
                    Details from Garrett (garrett.com). Extra coils are sold separately by Garrett.
                  </p>
                </details>
              </div>
            </div>

            <div className="rounded-2xl border border-[#d4af37]/20 bg-[#1a120b]/65 overflow-hidden flex flex-col">
              <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[#d4af37] text-xs uppercase tracking-wider">Included to pan at home</p>
                  <h3 className="font-serif text-2xl text-[#f0d48f] font-semibold mt-1">
                    Digger&apos;s Concentrates PayDirt
                  </h3>
                </div>
                <span className="inline-flex items-center px-2.5 py-1 rounded bg-[#d4af37]/20 text-[#d4af37] text-xs font-semibold">
                  {PAYDIRT_VALUE} value
                </span>
              </div>
              <div className="relative flex-1 min-h-[220px] border-t border-[#d4af37]/15 bg-[radial-gradient(circle_at_50%_55%,rgba(212,175,55,0.22),transparent_65%)]">
                <Image
                  src={PAYDIRT_CUTOUT.src}
                  alt={PAYDIRT_CUTOUT.alt}
                  fill
                  className="object-contain p-4 drop-shadow-[0_8px_18px_rgba(0,0,0,0.6)]"
                  sizes="(max-width: 1024px) 100vw, 380px"
                />
              </div>
              <p className="px-5 py-4 text-sm text-[#e8e0d5]/84">
                Paydirt is gravel you pan to look for gold. This bag is yours to pan at home, no trip required.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Before you buy + closing CTA + FAQ */}
      <section
        id="membership-cta"
        ref={closingRef}
        className="py-14 md:py-20 border-t border-[#d4af37]/10 pb-28 md:pb-20"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#f0d48f]">Before you buy</h2>
          <p className="text-[#e8e0d5]/80 mt-4 max-w-3xl mx-auto">
            This is a real commitment, so here is what happens next and what it costs.
          </p>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-left">
            {BEFORE_YOU_BUY.map(({ title, body, Icon }) => (
              <div key={title} className="rounded-xl border border-[#d4af37]/20 bg-[#1a120b]/60 p-4">
                <Icon className="w-5 h-5 text-[#6dd472]" />
                <p className="mt-2 font-semibold text-[#f0d48f] text-sm">{title}</p>
                <p className="mt-1 text-sm text-[#e8e0d5]/78 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <a
              href="#bundle-offer"
              className="inline-flex items-center justify-center gap-2 px-7 py-3 rounded-lg bg-[#d4af37] text-[#1a120b] font-semibold hover:bg-[#f0d48f] transition-colors"
            >
              Become a lifetime member
            </a>
          </div>
          <p className="mt-5 text-xs leading-relaxed text-[#e8e0d5]/55 max-w-3xl mx-auto">
            *Nightly rates vary by camp; hookups available at select camps. 30-day cancellation policy · Contract
            emailed after purchase for signature · $120 annual maintenance after year one · Prices and terms may change.
            The included detector is offered while supplies last.
          </p>
          <div className="mt-10 text-left">
            <h3 className="font-serif text-2xl font-bold text-[#f0d48f] text-center">Questions we hear a lot</h3>
            <div className="mt-4 space-y-3">
              {faqs.map((item) => (
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

      {/* Sticky mobile CTA */}
      {product && (
        <div
          className={`md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-[#d4af37]/40 bg-[#1a120b]/95 backdrop-blur-md py-3 pl-4 pr-20 transition-transform duration-300 ${
            showStickyBar ? "translate-y-0" : "translate-y-full"
          }`}
          aria-hidden={!showStickyBar}
        >
          <div className="flex items-center gap-3">
            <div className="shrink-0 leading-tight">
              <p className="font-serif text-2xl font-bold text-[#d4af37]">{priceLabel}</p>
              <p className="text-[10px] uppercase tracking-wider text-[#e8e0d5]/70">Lifetime membership</p>
            </div>
            <div className="flex-1" inert={!showStickyBar}>
              {addToCartButton}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
