"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Shield, Sparkles, Phone, Gem, MapPin } from "lucide-react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getBundleMembershipProducts, type MembershipBundleProductInfo } from "@/app/actions/membership-bundles";
import { addMembershipToCart } from "@/app/actions/cart";
import { useCart } from "@/context/CartContext";
import { trackAddToCart } from "@/lib/analytics";

const BUNDLE_CONTENT: Record<
  string,
  {
    displayName: string;
    detectorTitle: string;
    imageSrc: string;
    imageAlt: string;
    detectorSummary: string;
    detectorFeatures: string[];
    bestFor: string;
    specs: string[];
    sources: string[];
  }
> = {
  gm1000: {
    displayName: "GM1000 Bundle",
    detectorTitle: "Minelab Gold Monster 1000",
    imageSrc: "/images/LDMA-GM1000-Bundle.jpeg",
    imageAlt: "LDMA Lifetime bundle with Minelab Gold Monster 1000",
    detectorSummary:
      "A proven all-around VLF platform for small gold in mineralized ground. Easy to learn and ideal for family prospecting trips.",
    detectorFeatures: [
      "Turn-on-and-go controls with simple setup",
      "Very sensitive to small nuggets",
      "Lightweight platform for long sessions",
    ],
    bestFor: "Best for members who want easy learning and dependable performance.",
    specs: [
      "45 kHz VLF operating frequency",
      "24-bit signal processing",
      "Weight: 1.33 kg (2.94 lbs)",
      "Automatic ground balance, sensitivity, and noise cancel",
      'Waterproof 5" DD coil (to 1 m / 3.3 ft), rainproof control box',
      "Power options: rechargeable Li-ion battery or 8x AA batteries",
    ],
    sources: ["minelab.com", "usa.minelab.com"],
  },
  gm24k: {
    displayName: "Garrett 24k Bundle",
    detectorTitle: "Garrett GoldMaster 24k",
    imageSrc: "/images/LDMA-GM24K-Bundle.jpeg",
    imageAlt: "LDMA Lifetime bundle with Garrett GoldMaster 24k",
    detectorSummary:
      "Responsive and rugged gold detector tuned for long days on claims. A strong option for members who prefer the Garrett platform.",
    detectorFeatures: [
      "24kHz VLF performance tuned for gold",
      "Strong target response in tough soil",
      "Rugged build for repeated field use",
    ],
    bestFor: "Best for members who like Garrett feel and responsive field feedback.",
    specs: [
      "48 kHz operating frequency",
      "XGB automatic ground balance system",
      '6" x 10" DD waterproof searchcoil',
      "Two audio modes: 2-tone Beep and VCO Zip",
      "Sensitivity control (0-10) with frequency shift options",
      "Rainproof detector housing with waterproof coil",
    ],
    sources: ["garrett.com", "gpaalifetime.com"],
  },
  gm2000: {
    displayName: "GM2000 Bundle",
    detectorTitle: "Minelab Gold Monster 2000",
    imageSrc: "/images/LDMA-GM2000-Bundle.jpeg",
    imageAlt: "LDMA Lifetime bundle with Minelab Gold Monster 2000",
    detectorSummary:
      "Premium sensitivity and refinement for serious hunters focused on tiny targets in tough ground conditions.",
    detectorFeatures: [
      "Highest-tier sensitivity in this offer",
      "Built for advanced, detail-focused hunting",
      "Excellent for difficult ground and tiny targets",
    ],
    bestFor: "Best for members who want maximum performance and refinement.",
    specs: [
      "12-76 kHz simultaneous multi-frequency (Multi-Au)",
      "Search modes: Normal, Difficult, Benign",
      "Weight: 1.25 kg (2.75 lbs)",
      'Waterproof 5" round DD coil (to 1 m / 3.3 ft)',
      "IP55 rainproof control pod",
      "Includes two rechargeable 2700 mAh Li-ion batteries",
    ],
    sources: ["minelab.com", "usa.minelab.com"],
  },
};

const ADDON_STORIES = [
  {
    title: "Companion add-on",
    value: "$1,250 retail value",
    story:
      "Lets an eligible family member travel and prospect independently, so your membership works even when schedules do not match.",
  },
  {
    title: "Transferability",
    value: "$1,250 retail value",
    story:
      "Gives your family a clear legacy plan by allowing your membership to pass to an heir when the time comes.",
  },
  {
    title: "Pre-paid transfer",
    value: "$750 retail value",
    story:
      "Pre-pays the transfer fee so your family does not need to handle that cost later.",
  },
];

const INCLUDED_ITEMS = [
  "LDMA Lifetime (12 private campgrounds on patented gold-bearing claims)",
  "GPAA Lifetime (93,000+ additional acres nationwide)",
  "Companion + Transferability + Pre-Paid Transfer",
  "Your selected detector bundle (GM1000, GM24k, or GM2000)",
];

const BUNDLE_FAQS = [
  {
    q: "What is included in every detector bundle?",
    a: "Each bundle includes LDMA Lifetime, GPAA Lifetime, Companion, Transferability, Pre-Paid Transfer, and one detector choice. The only difference between bundles is the detector model and bundle price tier.",
  },
  {
    q: "What is the difference between the $3,500 and $4,000 bundles?",
    a: "The $3,500 bundles include either the Minelab GM1000 or Garrett GoldMaster 24k. The $4,000 bundle includes the Minelab GM2000. Core memberships and add-ons are included in all three bundles.",
  },
  {
    q: "Can I review terms before final activation?",
    a: "Yes. After purchase, LDMA sends your full contract for signature so you can review all details before final activation.",
  },
  {
    q: "Is there a cancellation policy and maintenance fee?",
    a: "Yes. There is a 30-day cancellation policy. A $120 annual maintenance fee applies after the first year.",
  },
];

function formatMoney(amount: string): string {
  const value = Number.parseFloat(amount);
  if (!Number.isFinite(value)) return amount;
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function detectorRetailByKey(key: string): string {
  if (key === "gm24k") return "$910";
  if (key === "gm1000") return "$999";
  if (key === "gm2000") return "$1,999";
  return "N/A";
}

export function BundleMembershipsPageContent() {
  const [products, setProducts] = useState<MembershipBundleProductInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const { refreshCart, openDrawer } = useCart();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getBundleMembershipProducts()
      .then((list) => {
        if (!active) return;
        setProducts(list);
      })
      .catch(() => {
        if (!active) return;
        setError("Could not load bundle options right now. Please call (888) 465-3717.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const maxRetail = useMemo(() => {
    const values = products
      .map((p) => (p.compareAtPrice ? Number.parseFloat(p.compareAtPrice) : Number.NaN))
      .filter((v) => Number.isFinite(v));
    if (!values.length) return null;
    return Math.max(...values);
  }, [products]);

  const minBundle = useMemo(() => {
    const values = products.map((p) => Number.parseFloat(p.price)).filter((v) => Number.isFinite(v));
    if (!values.length) return null;
    return Math.min(...values);
  }, [products]);

  const maxSavings = useMemo(() => {
    const values = products
      .map((p) => {
        const compare = p.compareAtPrice ? Number.parseFloat(p.compareAtPrice) : Number.NaN;
        const price = Number.parseFloat(p.price);
        return Number.isFinite(compare) && Number.isFinite(price) ? compare - price : Number.NaN;
      })
      .filter((v) => Number.isFinite(v));
    if (!values.length) return null;
    return Math.max(...values);
  }, [products]);

  async function handleChooseBundle(product: MembershipBundleProductInfo) {
    setAddingKey(product.key);
    setError(null);
    try {
      await addMembershipToCart([product.variantId]);
      await refreshCart();
      trackAddToCart("membership", Number.parseFloat(product.price));
      openDrawer();
    } catch {
      setError("Could not add this bundle to cart. Please try again or call (888) 465-3717.");
    } finally {
      setAddingKey(null);
    }
  }

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Membership" }]} />
      </div>

      <section className="py-14 md:py-18">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center">
            <p className="inline-flex items-center gap-2 px-3 py-1 rounded bg-[#d4af37]/20 text-[#d4af37] text-sm font-medium">
              50th Anniversary Detector Bundles
            </p>
            <h1 className="mt-4 font-serif text-4xl sm:text-5xl font-bold text-[#f0d48f]">
              Choose your lifetime membership bundle
            </h1>
            <p className="mt-4 text-[#e8e0d5]/85 max-w-3xl mx-auto text-lg">
              This is a complete family prospecting package: LDMA Lifetime + GPAA Lifetime + legacy add-ons + your
              detector choice in one bundled price.
            </p>
            <p className="mt-3 text-[#6dd472] font-semibold">
              Save up to {maxSavings != null ? formatMoney(String(maxSavings)) : "$7,500"} versus typical retail pricing.
            </p>
            <p className="mt-3 text-[#e8e0d5]/70">
              Questions? Call <a className="text-[#f0d48f] font-semibold" href="tel:8884653717">(888) 465-3717</a>
            </p>
          </div>
        </div>
      </section>

      <section id="bundle-cards" className="pb-14 md:pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {loading ? (
            <div className="py-20 flex flex-col items-center gap-3 text-[#e8e0d5]/70">
              <Loader2 className="w-8 h-8 animate-spin text-[#d4af37]" />
              <p>Loading bundle options...</p>
            </div>
          ) : (
            <div className="grid lg:grid-cols-3 gap-6">
              {products.map((product) => {
                const content = BUNDLE_CONTENT[product.key];
                if (!content) return null;
                const compare = product.compareAtPrice ? Number.parseFloat(product.compareAtPrice) : Number.NaN;
                const price = Number.parseFloat(product.price);
                const savings =
                  Number.isFinite(compare) && Number.isFinite(price) && compare > price ? compare - price : null;
                const isAdding = addingKey === product.key;
                return (
                  <article
                    key={product.key}
                    className="rounded-2xl overflow-hidden border border-[#d4af37]/25 bg-[#1a120b]/80 shadow-[0_12px_34px_rgba(0,0,0,0.35)]"
                  >
                    <div className="relative h-56">
                      <Image src={content.imageSrc} alt={content.imageAlt} fill className="object-cover" sizes="33vw" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#1a120b] via-transparent to-transparent" />
                    </div>
                    <div className="p-5">
                      <p className="text-[#d4af37] text-xs uppercase tracking-wider">{content.displayName}</p>
                      <h2 className="font-serif text-2xl text-[#f0d48f] font-semibold mt-1">{content.detectorTitle}</h2>
                      <p className="mt-3 text-[#e8e0d5]/85 text-sm leading-relaxed">{content.detectorSummary}</p>
                      <ul className="mt-3 space-y-1.5 text-[#e8e0d5]/78 text-sm">
                        {content.detectorFeatures.map((feature) => (
                          <li key={feature} className="flex items-start gap-2">
                            <Gem className="w-3.5 h-3.5 text-[#d4af37] mt-0.5 shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 text-[#d4af37]/90 text-xs font-medium">{content.bestFor}</p>

                      <div className="mt-4 flex flex-wrap items-baseline gap-2">
                        <span className="text-3xl font-bold text-[#d4af37]">{formatMoney(product.price)}</span>
                        {product.compareAtPrice && (
                          <span className="text-[#e8e0d5]/55 line-through">{formatMoney(product.compareAtPrice)}</span>
                        )}
                      </div>
                      {savings != null && savings > 0 && (
                        <p className="mt-1 text-sm text-[#6dd472] font-semibold">
                          Save about {formatMoney(String(savings))} versus retail
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={() => handleChooseBundle(product)}
                        disabled={isAdding}
                        className="mt-5 w-full py-3 px-4 rounded-lg bg-[#d4af37] text-[#1a120b] font-semibold hover:bg-[#f0d48f] transition-colors disabled:opacity-70 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                      >
                        {isAdding ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Adding...
                          </>
                        ) : (
                          "Choose this bundle"
                        )}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {error && <p className="text-red-300 mt-5 text-center">{error}</p>}
        </div>
      </section>

      <section className="py-14 md:py-18 bg-[#0f3d1e]/30 border-y border-[#d4af37]/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-10">
          <div>
            <h3 className="font-serif text-3xl text-[#f0d48f] font-bold">What your bundle really buys</h3>
            <p className="mt-4 text-[#e8e0d5]/84 text-sm leading-relaxed">
              Most members are trying to solve three things at once: where to prospect, how to bring family, and how to
              keep the membership in the family long-term. These bundles are built around exactly that.
            </p>
            <ul className="mt-5 space-y-2 text-[#e8e0d5]/88 text-sm">
              {INCLUDED_ITEMS.map((item) => (
                <li key={item} className="flex gap-2">
                  <Sparkles className="w-4 h-4 text-[#d4af37] mt-0.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 space-y-3">
              {ADDON_STORIES.map((item) => (
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
            <h3 className="font-serif text-3xl text-[#f0d48f] font-bold">Two memberships, one serious value stack</h3>
            <p className="mt-4 text-[#e8e0d5]/84 text-sm leading-relaxed">
              You are not buying just detector hardware. You are stacking two lifetime memberships that expand where you
              can prospect, where you can camp, and how often your family can actually use the membership.
            </p>

            <div className="mt-5 rounded-xl border border-[#d4af37]/20 bg-[#1a120b]/60 p-4">
              <p className="text-[#d4af37] font-semibold text-sm">LDMA Lifetime benefits</p>
              <ul className="mt-2 space-y-2 text-[#e8e0d5]/84 text-sm">
                <li className="flex gap-2">
                  <MapPin className="w-4 h-4 text-[#d4af37] mt-0.5 shrink-0" />
                  <span>12 private LDMA campgrounds across 8 states on patented, gold-bearing properties.</span>
                </li>
                <li className="flex gap-2">
                  <MapPin className="w-4 h-4 text-[#d4af37] mt-0.5 shrink-0" />
                  <span>Member-focused camping lifestyle with events, community, and family-friendly claim access.</span>
                </li>
                <li className="flex gap-2">
                  <MapPin className="w-4 h-4 text-[#d4af37] mt-0.5 shrink-0" />
                  <span>Long-term legacy planning through transfer-focused add-ons bundled into this offer.</span>
                </li>
              </ul>
            </div>

            <div className="mt-4 rounded-xl border border-[#d4af37]/20 bg-[#1a120b]/60 p-4">
              <p className="text-[#d4af37] font-semibold text-sm">GPAA Lifetime benefits</p>
              <ul className="mt-2 space-y-2 text-[#e8e0d5]/84 text-sm">
                <li className="flex gap-2">
                  <MapPin className="w-4 h-4 text-[#d4af37] mt-0.5 shrink-0" />
                  <span>93,000+ additional acres and 200+ claims/leases nationwide to keep exploring beyond LDMA camps.</span>
                </li>
                <li className="flex gap-2">
                  <MapPin className="w-4 h-4 text-[#d4af37] mt-0.5 shrink-0" />
                  <span>Access to chapter community, claim reports, events, and educational prospecting resources.</span>
                </li>
                <li className="flex gap-2">
                  <MapPin className="w-4 h-4 text-[#d4af37] mt-0.5 shrink-0" />
                  <span>Ongoing publications and member programs that keep trips productive all year long.</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 p-4 rounded-xl border border-[#d4af37]/25 bg-[#1a120b]/70">
              <p className="text-[#e8e0d5]/80 text-xs uppercase tracking-[0.16em]">Want the full GPAA picture?</p>
              <p className="mt-2 text-[#f0d48f] font-serif text-2xl font-bold">
                Explore GPAA Lifetime membership details
              </p>
              <p className="mt-2 text-[#e8e0d5]/78 text-sm">
                See current GPAA Lifetime benefits, program details, and offer updates directly on the official site.
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h3 className="font-serif text-3xl text-[#f0d48f] font-bold text-center">Detector specs and package details</h3>
          <p className="mt-4 text-center text-[#e8e0d5]/78 max-w-3xl mx-auto">
            Technical details below are sourced from manufacturer product pages and current offer details on
            gpaalifetime.com. Open each detector to compare the specs side-by-side.
          </p>
          <div className="mt-8 space-y-4">
            {products.map((product, idx) => {
              const content = BUNDLE_CONTENT[product.key];
              if (!content) return null;
              return (
                <details
                  key={`specs-${product.key}`}
                  open={idx === 0}
                  className="group rounded-2xl border border-[#d4af37]/20 bg-[#1a120b]/65 overflow-hidden"
                >
                  <summary className="list-none cursor-pointer px-5 py-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[#d4af37] text-xs uppercase tracking-wider">{content.displayName}</p>
                      <h4 className="font-serif text-xl text-[#f0d48f] font-semibold mt-1">{content.detectorTitle}</h4>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="inline-flex items-center px-2.5 py-1 rounded bg-[#d4af37]/20 text-[#d4af37] text-xs font-semibold">
                          Detector retail: {detectorRetailByKey(product.key)}
                        </span>
                        <span className="inline-flex items-center px-2.5 py-1 rounded bg-[#6dd472]/20 text-[#6dd472] text-xs font-semibold">
                          Full bundle savings:{" "}
                          {product.compareAtPrice
                            ? formatMoney(
                                String(
                                  Number.parseFloat(product.compareAtPrice) - Number.parseFloat(product.price)
                                )
                              )
                            : "N/A"}
                        </span>
                        <span className="inline-flex items-center px-2.5 py-1 rounded bg-[#f0d48f]/20 text-[#f0d48f] text-xs font-semibold">
                          Bundle price: {formatMoney(product.price)}
                        </span>
                      </div>
                    </div>
                    <span className="text-[#e8e0d5]/60 text-sm group-open:hidden">View specs</span>
                    <span className="text-[#e8e0d5]/60 text-sm hidden group-open:inline">Hide specs</span>
                  </summary>
                  <div className="px-5 pb-5 grid md:grid-cols-[220px_1fr] gap-5 border-t border-[#d4af37]/15">
                    <div className="relative h-44 mt-4 rounded-xl overflow-hidden border border-[#d4af37]/15">
                      <Image src={content.imageSrc} alt={content.imageAlt} fill className="object-cover" sizes="220px" />
                    </div>
                    <div className="pt-4">
                      <ul className="space-y-2 text-[#e8e0d5]/86 text-sm">
                        {content.specs.map((spec) => (
                          <li key={spec} className="flex gap-2">
                            <Sparkles className="w-4 h-4 text-[#d4af37] mt-0.5 shrink-0" />
                            <span>{spec}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-4 text-xs text-[#e8e0d5]/55">
                        Sources: {content.sources.join(", ")}.
                      </p>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      </section>

      <section id="membership-cta" className="py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#f0d48f]">Ready to lock in your bundle?</h2>
          <p className="text-[#e8e0d5]/80 mt-4 max-w-3xl mx-auto">
            Choose the detector that matches how you hunt, then check out. We send your full contract after purchase for
            signature so you can review all terms before final activation.
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
              href="#bundle-cards"
              className="inline-flex items-center justify-center gap-2 px-7 py-3 rounded-lg bg-[#d4af37] text-[#1a120b] font-semibold hover:bg-[#f0d48f] transition-colors"
            >
              Choose your bundle now
            </a>
          </div>
          <p className="mt-5 text-xs text-[#e8e0d5]/50">
            Bundled offers are available for a limited time while supplies last. See myldma.com for current availability
            and offers.
          </p>
          <div className="mt-10 text-left">
            <h3 className="font-serif text-2xl font-bold text-[#f0d48f] text-center">Bundle FAQs</h3>
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
