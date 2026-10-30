"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Phone, Sparkles } from "lucide-react";
import {
  FAMILY_LEGACY_ADD_ONS,
  FAMILY_LEGACY_PRICE_CENTS,
  FAMILY_LEGACY_REGULAR_PRICE_CENTS,
  type FamilyLegacyEligibility,
} from "@/lib/family-legacy-offer";

const ADD_ON_COPY: Record<string, string> = {
  Transferability:
    "Name who receives your membership when the time comes. Without it, your membership ends with you.",
  Companion:
    "A spouse, adult child, parent, or grandparent can prospect and camp on their own, even when you're not there.",
  "Pre-Paid Transfer Fee":
    "Cover the transfer fee now, so your heir receives your membership with no fee later.",
};

const dollars = (cents: number) => `$${(cents / 100).toLocaleString("en-US")}`;

const inputClass =
  "w-full rounded-lg border border-[#d4af37]/30 bg-[#0f0a06] text-[#e8e0d5] px-3 py-2 text-sm placeholder:text-[#e8e0d5]/35 focus:outline-none focus:border-[#d4af37]/70";

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-[#0f3d1e]/40 border border-[#d4af37]/30 p-6 sm:p-8 max-w-2xl">{children}</section>
  );
}

function CallLine() {
  return (
    <a href="tel:8884653717" className="inline-flex items-center gap-2 text-[#d4af37] hover:text-[#f0d48f] text-sm">
      <Phone className="w-4 h-4" /> Questions? Call (888) 465-3717
    </a>
  );
}

export function FamilyLegacyOfferContent({
  firstName,
  eligibility,
  justPaid,
  cancelled,
}: {
  firstName: string;
  eligibility: FamilyLegacyEligibility;
  justPaid: boolean;
  cancelled: boolean;
}) {
  const [form, setForm] = useState({
    companionName: "",
    companionRelationship: "",
    heirName: "",
    heirRelationship: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (justPaid || (!eligibility.eligible && eligibility.reason === "already_purchased")) {
    return (
      <Panel>
        <h1 className="font-serif text-2xl font-semibold text-[#f0d48f] flex items-center gap-2 mb-4">
          <CheckCircle2 className="w-7 h-7 text-[#d4af37]" />
          {justPaid ? "Thank you, your payment went through" : "Your Family Legacy add-on is purchased"}
        </h1>
        <p className="text-[#e8e0d5]/90 mb-3">
          Member Services will email you the Family Legacy addendum through Adobe Sign. Once you sign it, your add-ons
          are applied to your membership.
        </p>
        <p className="text-[#e8e0d5]/75 text-sm mb-6">
          If you haven&apos;t chosen a companion or heir yet, Member Services will help you with that when they send the
          addendum.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/members/profile" className="px-5 py-2.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f]">
            Back to my profile
          </Link>
          <CallLine />
        </div>
      </Panel>
    );
  }

  if (!eligibility.eligible) {
    const message =
      eligibility.reason === "companion_login"
        ? "This offer is available on the primary membership. Please ask the primary member to log in."
        : eligibility.reason === "completed_offer"
          ? "Please call Member Services at (888) 465-3717 for details about Family Legacy options for your membership."
          : "This offer is available to active LDMA members. Please call us and we'll help.";
    return (
      <Panel>
        <h1 className="font-serif text-2xl font-semibold text-[#f0d48f] mb-4">Complete Family Legacy Offer</h1>
        <p className="text-[#e8e0d5]/90 mb-6">{message}</p>
        <CallLine />
      </Panel>
    );
  }

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function checkout() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/members/family-legacy-offer/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || "Could not start checkout");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start checkout");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {cancelled && (
        <p className="rounded-lg border border-[#d4af37]/30 bg-[#2a1f14] px-4 py-3 text-sm text-[#e8e0d5]/85">
          Checkout was cancelled. You haven&apos;t been charged. You can try again below.
        </p>
      )}

      <Panel>
        <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#f0d48f] flex items-center gap-2 mb-3">
          <Sparkles className="w-7 h-7 text-[#d4af37] shrink-0" />
          Complete Your Family Legacy
        </h1>
        <p className="text-[#e8e0d5]/90 mb-5">
          {firstName ? `${firstName}, as` : "As"} an active LDMA member, you can add all three Family Legacy add-ons
          in one package. It&apos;s everything you need to pass your membership on to your family.
        </p>
        <ul className="space-y-3 mb-6">
          {FAMILY_LEGACY_ADD_ONS.map((addOn) => (
            <li key={addOn} className="flex gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#d4af37] shrink-0 mt-0.5" />
              <span className="text-sm text-[#e8e0d5]/90">
                <strong className="text-[#f0d48f]">{addOn}.</strong> {ADD_ON_COPY[addOn]}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-2xl font-bold text-[#d4af37]">
          {dollars(FAMILY_LEGACY_PRICE_CENTS)}{" "}
          <span className="text-base font-normal text-[#e8e0d5]/55 line-through">
            {dollars(FAMILY_LEGACY_REGULAR_PRICE_CENTS)}
          </span>
        </p>
      </Panel>

      <section className="rounded-xl bg-[#1a120b] border border-[#d4af37]/25 p-6 sm:p-8 space-y-5">
        <div>
          <h2 className="font-serif text-lg font-semibold text-[#f0d48f]">Who would you like to name? (optional)</h2>
          <p className="text-sm text-[#e8e0d5]/70 mt-1">
            Not sure yet? Leave these blank. Member Services will help you when they send your addendum.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-xs text-[#e8e0d5]/70 space-y-1">
            <span>Companion&apos;s name</span>
            <input className={inputClass} value={form.companionName} onChange={set("companionName")} maxLength={120} />
          </label>
          <label className="text-xs text-[#e8e0d5]/70 space-y-1">
            <span>Relationship to you</span>
            <input
              className={inputClass}
              value={form.companionRelationship}
              onChange={set("companionRelationship")}
              placeholder="e.g. spouse, son"
              maxLength={120}
            />
          </label>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-xs text-[#e8e0d5]/70 space-y-1">
            <span>Heir&apos;s name</span>
            <input className={inputClass} value={form.heirName} onChange={set("heirName")} maxLength={120} />
          </label>
          <label className="text-xs text-[#e8e0d5]/70 space-y-1">
            <span>Relationship to you</span>
            <input
              className={inputClass}
              value={form.heirRelationship}
              onChange={set("heirRelationship")}
              placeholder="e.g. daughter, grandson"
              maxLength={120}
            />
          </label>
        </div>
        <label className="block text-xs text-[#e8e0d5]/70 space-y-1">
          <span>Anything Member Services should know?</span>
          <textarea className={`${inputClass} min-h-[80px]`} value={form.notes} onChange={set("notes")} maxLength={1000} />
        </label>
      </section>

      <section className="space-y-3">
        <p className="text-sm text-[#e8e0d5]/75">
          After you pay, Member Services will email you the Family Legacy addendum through Adobe Sign. Your add-ons are
          applied once it&apos;s signed.
        </p>
        {error && (
          <p className="text-sm text-red-200 bg-red-950/30 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={checkout}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] disabled:opacity-60"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Continue to secure payment · {dollars(FAMILY_LEGACY_PRICE_CENTS)}
          </button>
          <CallLine />
        </div>
      </section>
    </div>
  );
}
