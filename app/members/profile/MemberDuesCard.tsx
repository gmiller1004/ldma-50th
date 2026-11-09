"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, CreditCard, Loader2 } from "lucide-react";
import { formatUsd, type DuesOption, type MaintenanceChoice, type MembershipChoice } from "@/lib/member-dues";

type DuesResponse = {
  eligible: boolean;
  showMaintenance?: boolean;
  maintenanceDue?: number;
  nextMaintenanceDueDate?: string | null;
  membershipDue?: number;
  membershipBalance?: number;
  nextMembershipDueDate?: string | null;
  autoPayNotice?: string | null;
  maintenanceOptions?: DuesOption<MaintenanceChoice>[];
  membershipOptions?: DuesOption<MembershipChoice>[];
  recentPayments?: { amountCents: number; paidAt: string }[];
  error?: string;
};

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function ChoiceGroup<T extends string>({
  name,
  title,
  summary,
  options,
  value,
  onChange,
}: {
  name: string;
  title: string;
  summary: string;
  options: DuesOption<T>[];
  value: T | null;
  onChange: (v: T | null) => void;
}) {
  const choices: { id: T | null; label: string; amountCents: number | null }[] = [
    ...options.map((o) => ({ id: o.id, label: o.label, amountCents: o.amountCents })),
    { id: null, label: "Don't pay now", amountCents: null },
  ];
  return (
    <fieldset className="space-y-2">
      <legend className="font-semibold text-[#f0d48f]">{title}</legend>
      <p className="text-sm text-[#e8e0d5]/70 -mt-1 mb-1">{summary}</p>
      {choices.map((c) => (
        <label
          key={c.id ?? "none"}
          className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
            value === c.id ? "border-[#d4af37] bg-[#d4af37]/10" : "border-[#d4af37]/20 hover:border-[#d4af37]/40"
          }`}
        >
          <span className="flex items-center gap-3">
            <input
              type="radio"
              name={name}
              checked={value === c.id}
              onChange={() => onChange(c.id)}
              className="accent-[#d4af37]"
            />
            <span className="text-[#e8e0d5]">{c.label}</span>
          </span>
          {c.amountCents != null ? <span className="font-medium text-[#e8e0d5]">{formatUsd(c.amountCents)}</span> : null}
        </label>
      ))}
    </fieldset>
  );
}

export function MemberDuesCard() {
  const [data, setData] = useState<DuesResponse | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [maintenance, setMaintenance] = useState<MaintenanceChoice | null>(null);
  const [membership, setMembership] = useState<MembershipChoice | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [returnState, setReturnState] = useState<"paid" | "cancelled" | null>(null);

  useEffect(() => {
    const dues = new URLSearchParams(window.location.search).get("dues");
    if (dues === "paid" || dues === "cancelled") setReturnState(dues);
    fetch("/api/members/dues", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: DuesResponse) => {
        setData(d);
        setMaintenance(d.maintenanceOptions?.find((o) => o.id === "maintenance_due")?.id ?? null);
        setMembership(d.membershipOptions?.find((o) => o.id === "membership_due")?.id ?? null);
      })
      .catch(() => setLoadError(true));
  }, []);

  const totalCents = useMemo(() => {
    const m = data?.maintenanceOptions?.find((o) => o.id === maintenance)?.amountCents ?? 0;
    const b = data?.membershipOptions?.find((o) => o.id === membership)?.amountCents ?? 0;
    return m + b;
  }, [data, maintenance, membership]);

  if (loadError) return null;
  if (!data) {
    return (
      <div className="p-5 rounded-lg border border-[#d4af37]/20 bg-[#0f0a06]/60 flex items-center gap-2 text-sm text-[#e8e0d5]/70">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading your balances…
      </div>
    );
  }
  if (!data.eligible) return null;

  const maintOpts = data.maintenanceOptions ?? [];
  const membOpts = data.membershipOptions ?? [];
  const recent = data.recentPayments ?? [];
  if (maintOpts.length === 0 && membOpts.length === 0 && recent.length === 0 && returnState !== "paid") return null;

  async function handlePay() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/members/dues/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maintenance, membership }),
      });
      const body = await res.json();
      if (!res.ok || !body.url) {
        setError(body.error || "Could not start checkout. Please try again.");
        setSubmitting(false);
        return;
      }
      window.location.href = body.url;
    } catch {
      setError("Could not start checkout. Please try again.");
      setSubmitting(false);
    }
  }

  const maintenanceSummary = [
    `Due now: ${formatUsd(Math.round((data.maintenanceDue ?? 0) * 100))}`,
    formatDate(data.nextMaintenanceDueDate) ? `Next due ${formatDate(data.nextMaintenanceDueDate)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const membershipSummary = [
    `Due now: ${formatUsd(Math.round((data.membershipDue ?? 0) * 100))}`,
    `Remaining balance: ${formatUsd(Math.round((data.membershipBalance ?? 0) * 100))}`,
    formatDate(data.nextMembershipDueDate) ? `Next due ${formatDate(data.nextMembershipDueDate)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section id="dues" className="scroll-mt-24 p-5 rounded-lg border border-[#d4af37]/30 bg-[#0f0a06]/60 space-y-5">
      <div>
        <h2 className="font-serif text-xl font-semibold text-[#f0d48f] flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-[#d4af37]" /> Dues & payments
        </h2>
        <p className="text-sm text-[#e8e0d5]/70 mt-1">Pay your maintenance and membership dues online.</p>
      </div>

      {returnState === "paid" || recent.length > 0 ? (
        <div className="flex gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-[#e8e0d5]">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <p>
            {recent.length > 0
              ? `We received your ${formatUsd(recent[0].amountCents)} payment on ${new Date(recent[0].paidAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}.`
              : "Thank you. Your payment went through."}{" "}
            Member Services is applying it to your account, so the balances below may not reflect it yet. A receipt is on
            its way to your email.
          </p>
        </div>
      ) : null}

      {returnState === "cancelled" ? (
        <p className="text-sm text-[#e8e0d5]/70">Checkout was cancelled. You haven&apos;t been charged.</p>
      ) : null}

      {data.autoPayNotice && (maintOpts.length > 0 || membOpts.length > 0) ? (
        <div className="flex gap-3 rounded-lg border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-[#e8e0d5]">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <p>
            {data.autoPayNotice} Call{" "}
            <a href="tel:+18884653717" className="text-[#d4af37] underline">
              (888) 465-3717
            </a>{" "}
            if you&apos;d like it adjusted.
          </p>
        </div>
      ) : null}

      {membOpts.length > 0 ? (
        <ChoiceGroup
          name="membership"
          title="Membership dues"
          summary={membershipSummary}
          options={membOpts}
          value={membership}
          onChange={setMembership}
        />
      ) : null}

      {maintOpts.length > 0 ? (
        <ChoiceGroup
          name="maintenance"
          title="Maintenance"
          summary={maintenanceSummary}
          options={maintOpts}
          value={maintenance}
          onChange={setMaintenance}
        />
      ) : null}

      {maintOpts.length > 0 || membOpts.length > 0 ? (
        <div className="pt-4 border-t border-[#d4af37]/20 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[#e8e0d5]/80">Total</span>
            <span className="text-xl font-semibold text-[#f0d48f]">{formatUsd(totalCents)}</span>
          </div>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button
            type="button"
            onClick={handlePay}
            disabled={submitting || totalCents <= 0}
            className="w-full inline-flex justify-center items-center gap-2 px-6 py-3 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {totalCents > 0 ? `Pay ${formatUsd(totalCents)}` : "Choose what to pay"}
          </button>
          <p className="text-xs text-[#e8e0d5]/60">
            Payments are processed securely by Stripe. Member Services applies online payments to your account, and your
            balance here updates once they do.
          </p>
        </div>
      ) : null}
    </section>
  );
}
