"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Calendar, Loader2, X } from "lucide-react";
import { formatCentsAsCurrency } from "@/lib/reservation-pricing";
import { GUEST_MAX_CONSECUTIVE_NIGHTS } from "@/lib/public-camp-booking";
import { campOpenSeasonSummary, validateStayWithinOpenSeason } from "@/lib/camp-seasons";
import { validatePublicBookingRequest } from "@/lib/public-camp-booking";

type PaymentOption = {
  id: "full" | "deposit";
  label: string;
  amountCents: number;
  balanceNote: string | null;
};

type SiteTypeRow = {
  siteTypeKey: string;
  label: string;
  availableCount: number;
  soldOut: boolean;
  memberTotalCents: number;
  guestTotalCents: number;
  usesMonthlyMemberRate: boolean;
  paymentOptionsMember: PaymentOption[];
  paymentOptionsGuest: PaymentOption[];
};

type OptionsResponse = {
  campName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  isMember: boolean;
  memberDisplayName: string | null;
  seasonNote: string | null;
  siteTypes: SiteTypeRow[];
  error?: string;
};

type Step = "dates" | "siteType" | "details" | "payment";

function todayIso(): string {
  return new Date().toLocaleDateString("en-CA");
}

const dateInputClassName =
  "w-full rounded border border-[#d4af37]/30 bg-[#0f0a06] text-[#e8e0d5] pl-3 pr-10 py-2 text-sm [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:cursor-pointer";

function DateField({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: string;
  min: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-[#e8e0d5]/65">
      {label}
      <div className="relative">
        <input
          type="date"
          min={min}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={dateInputClassName}
        />
        <Calendar
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#d4af37]"
          aria-hidden
        />
      </div>
    </label>
  );
}

export function CampReserveModal({
  open,
  onClose,
  campSlug,
  campName,
}: {
  open: boolean;
  onClose: () => void;
  campSlug: string;
  campName: string;
}) {
  const [step, setStep] = useState<Step>("dates");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [options, setOptions] = useState<OptionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [memberName, setMemberName] = useState<string | null>(null);
  const [selectedTypeKey, setSelectedTypeKey] = useState<string | null>(null);
  const [useMemberRate, setUseMemberRate] = useState(false);
  const [paymentOption, setPaymentOption] = useState<"full" | "deposit">("full");
  const [guestFirstName, setGuestFirstName] = useState("");
  const [guestLastName, setGuestLastName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const seasonNote = useMemo(() => campOpenSeasonSummary(campSlug), [campSlug]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const reset = useCallback(() => {
    setStep("dates");
    setCheckIn("");
    setCheckOut("");
    setOptions(null);
    setError(null);
    setSelectedTypeKey(null);
    setPaymentOption("full");
    setGuestFirstName("");
    setGuestLastName("");
    setGuestEmail("");
    setGuestPhone("");
  }, []);

  useEffect(() => {
    if (!open) return;
    fetch("/api/members/me")
      .then((r) => r.json())
      .then((data) => {
        const authed = data.authenticated === true;
        setIsMember(authed);
        setUseMemberRate(authed);
        if (authed) {
          const name = [data.firstName, data.lastName].filter(Boolean).join(" ").trim();
          setMemberName(name || null);
          if (data.email) setGuestEmail(String(data.email));
          if (data.firstName) setGuestFirstName(String(data.firstName));
          if (data.lastName) setGuestLastName(String(data.lastName));
        }
      })
      .catch(() => {
        setIsMember(false);
        setUseMemberRate(false);
      });
  }, [open]);

  const selectedType = useMemo(
    () => options?.siteTypes.find((t) => t.siteTypeKey === selectedTypeKey) ?? null,
    [options, selectedTypeKey]
  );

  const displayTotalCents = useMemo(() => {
    if (!selectedType) return 0;
    return useMemberRate && isMember ? selectedType.memberTotalCents : selectedType.guestTotalCents;
  }, [selectedType, useMemberRate, isMember]);

  const paymentOptions = useMemo(() => {
    if (!selectedType) return [];
    return useMemberRate && isMember
      ? selectedType.paymentOptionsMember
      : selectedType.paymentOptionsGuest;
  }, [selectedType, useMemberRate, isMember]);

  async function loadOptions() {
    setLoading(true);
    setError(null);
    const seasonCheck = validateStayWithinOpenSeason(campSlug, checkIn, checkOut);
    if (!seasonCheck.ok) {
      setError(seasonCheck.error);
      setLoading(false);
      return;
    }
    const bookingCheck = validatePublicBookingRequest({
      campSlug,
      checkIn,
      checkOut,
      reservationType: isMember ? "member" : "guest",
    });
    if (!bookingCheck.ok) {
      setError(bookingCheck.error);
      setLoading(false);
      return;
    }
    try {
      const params = new URLSearchParams({ campSlug, checkIn, checkOut });
      const res = await fetch(`/api/camp/booking/options?${params}`, { cache: "no-store" });
      const data = (await res.json()) as OptionsResponse & { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not load availability");
      setOptions(data);
      setIsMember(data.isMember);
      setMemberName(data.memberDisplayName);
      if (data.isMember) setUseMemberRate(true);
      setStep("siteType");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load availability");
    } finally {
      setLoading(false);
    }
  }

  async function startCheckout() {
    if (!selectedTypeKey) return;
    setCheckoutLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/camp/booking/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campSlug,
          checkIn,
          checkOut,
          siteTypeKey: selectedTypeKey,
          paymentOption,
          useMemberRate: useMemberRate && isMember,
          guestFirstName,
          guestLastName,
          guestEmail,
          guestPhone,
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "Checkout failed");
      if (!data.url) throw new Error("No checkout URL returned");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
      setCheckoutLoading(false);
    }
  }

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-labelledby="camp-reserve-title"
    >
      <div className="relative flex flex-col w-full max-w-md max-h-[min(85vh,520px)] rounded-xl border border-[#d4af37]/30 bg-[#1a120b] shadow-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => {
            reset();
            onClose();
          }}
          className="absolute top-3 right-3 z-10 p-2 rounded-lg text-[#e8e0d5]/70 hover:text-[#f0d48f] hover:bg-[#d4af37]/10"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="shrink-0 px-5 pt-5 pb-3 border-b border-[#d4af37]/15">
          <h2 id="camp-reserve-title" className="font-serif text-xl text-[#f0d48f] pr-8">
            Reserve Your Campsite
          </h2>
          <p className="text-sm text-[#e8e0d5]/65 mt-1">{campName}</p>
          {error ? (
            <div className="mt-3 rounded-lg border border-red-500/40 bg-red-950/30 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4">
          {step === "dates" ? (
            <div className="space-y-4">
              <p className="text-sm text-[#e8e0d5]/75">
                Choose your dates. We&apos;ll assign the next available site in your chosen category.
              </p>
              {!isMember ? (
                <p className="text-xs text-[#d4af37]/90 bg-[#d4af37]/10 border border-[#d4af37]/25 rounded-lg px-3 py-2">
                  <Link href="/members/login" className="underline hover:text-[#f0d48f]">
                    Log in
                  </Link>{" "}
                  to see member rates. Guest stays are limited to {GUEST_MAX_CONSECUTIVE_NIGHTS}{" "}
                  consecutive nights.
                </p>
              ) : (
                <p className="text-xs text-[#e8e0d5]/55">
                  Booking as {memberName || "member"} — member rates apply.
                </p>
              )}
              {seasonNote ? (
                <p className="text-xs text-[#d4af37]/90 bg-[#d4af37]/10 border border-[#d4af37]/25 rounded-lg px-3 py-2">
                  <span className="font-medium text-[#f0d48f]">Seasonal camp.</span> {seasonNote}
                </p>
              ) : null}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <DateField
                  label="Check-in"
                  min={todayIso()}
                  value={checkIn}
                  onChange={setCheckIn}
                />
                <DateField
                  label="Check-out"
                  min={checkIn || todayIso()}
                  value={checkOut}
                  onChange={setCheckOut}
                />
              </div>
              <button
                type="button"
                disabled={!checkIn || !checkOut || checkIn >= checkOut || loading}
                onClick={() => loadOptions()}
                className="w-full rounded-lg bg-[#d4af37] text-[#1a120b] font-semibold py-3 text-sm hover:bg-[#f0d48f] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                See available site types
              </button>
            </div>
          ) : null}

          {step === "siteType" && options ? (
            <div className="flex flex-col gap-3 min-h-0">
              <div className="shrink-0 space-y-1">
                <p className="text-sm text-[#e8e0d5]/75">
                  {options.nights} night{options.nights === 1 ? "" : "s"} · {options.checkIn} –{" "}
                  {options.checkOut}
                </p>
                {options.seasonNote ? (
                  <p className="text-xs text-[#e8e0d5]/50">{options.seasonNote}</p>
                ) : null}
                <p className="text-xs text-[#e8e0d5]/55">Choose a site type</p>
              </div>
              <div className="min-h-0 max-h-[min(42vh,280px)] overflow-y-auto overscroll-contain -mx-1 px-1 space-y-1.5">
                {options.siteTypes.map((t) => {
                  const price =
                    useMemberRate && isMember ? t.memberTotalCents : t.guestTotalCents;
                  const disabled = t.soldOut;
                  return (
                    <button
                      key={t.siteTypeKey}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setSelectedTypeKey(t.siteTypeKey);
                        setStep("details");
                      }}
                      className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                        disabled
                          ? "border-[#e8e0d5]/15 opacity-50 cursor-not-allowed"
                          : "border-[#d4af37]/25 hover:border-[#d4af37]/50 hover:bg-[#d4af37]/5"
                      }`}
                    >
                      <div className="flex justify-between gap-3 items-center">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#f0d48f] leading-snug">{t.label}</p>
                          <p className="text-[11px] text-[#e8e0d5]/50 mt-0.5">
                            {disabled
                              ? "Sold out"
                              : `${t.availableCount} site${t.availableCount === 1 ? "" : "s"} available`}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-[#e8e0d5] tabular-nums shrink-0">
                          {formatCentsAsCurrency(price)}
                          <span className="block text-[10px] font-normal text-[#e8e0d5]/45 text-right">
                            total stay
                          </span>
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="shrink-0 space-y-2 pt-1 border-t border-[#d4af37]/10">
                {!isMember ? (
                  <p className="text-xs text-[#e8e0d5]/55">
                    Showing guest rates.{" "}
                    <Link href="/members/login" className="text-[#d4af37] underline">
                      Log in
                    </Link>{" "}
                    for member pricing.
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => setStep("dates")}
                  className="text-sm text-[#e8e0d5]/55 hover:text-[#d4af37]"
                >
                  ← Change dates
                </button>
              </div>
            </div>
          ) : null}

          {step === "details" && selectedType ? (
            <div className="space-y-4">
              <p className="text-sm text-[#f0d48f] font-medium">{selectedType.label}</p>
              <p className="text-sm text-[#e8e0d5]/75">
                Total stay: {formatCentsAsCurrency(displayTotalCents)}
              </p>
              {isMember ? (
                <label className="flex items-center gap-2 text-sm text-[#e8e0d5]/80">
                  <input
                    type="checkbox"
                    checked={useMemberRate}
                    onChange={(e) => setUseMemberRate(e.target.checked)}
                    className="rounded border-[#d4af37]/40"
                  />
                  Use my member rate
                </label>
              ) : null}
              {!isMember || !useMemberRate ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1 text-xs text-[#e8e0d5]/65">
                    First name
                    <input
                      value={guestFirstName}
                      onChange={(e) => setGuestFirstName(e.target.value)}
                      className="rounded border border-[#d4af37]/30 bg-[#0f0a06] text-[#e8e0d5] px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-[#e8e0d5]/65">
                    Last name
                    <input
                      value={guestLastName}
                      onChange={(e) => setGuestLastName(e.target.value)}
                      className="rounded border border-[#d4af37]/30 bg-[#0f0a06] text-[#e8e0d5] px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-[#e8e0d5]/65 sm:col-span-2">
                    Email
                    <input
                      type="email"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      className="rounded border border-[#d4af37]/30 bg-[#0f0a06] text-[#e8e0d5] px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-[#e8e0d5]/65 sm:col-span-2">
                    Phone (optional)
                    <input
                      type="tel"
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      className="rounded border border-[#d4af37]/30 bg-[#0f0a06] text-[#e8e0d5] px-3 py-2 text-sm"
                    />
                  </label>
                </div>
              ) : (
                <p className="text-sm text-[#e8e0d5]/70">
                  Confirmation will be sent to {guestEmail || "your member email on file"}.
                </p>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep("siteType")}
                  className="text-sm text-[#e8e0d5]/55 hover:text-[#d4af37]"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep("payment")}
                  className="flex-1 rounded-lg border border-[#d4af37]/50 bg-[#d4af37]/15 text-[#f0d48f] font-semibold py-2.5 text-sm hover:bg-[#d4af37]/25"
                >
                  Continue to payment options
                </button>
              </div>
            </div>
          ) : null}

          {step === "payment" && selectedType ? (
            <div className="space-y-4">
              <p className="text-sm text-[#f0d48f] font-medium">{selectedType.label}</p>
              <div className="space-y-2">
                {paymentOptions.map((opt) => (
                  <label
                    key={opt.id}
                    className={`flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer ${
                      paymentOption === opt.id
                        ? "border-[#d4af37]/60 bg-[#d4af37]/10"
                        : "border-[#d4af37]/20"
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentOption"
                      checked={paymentOption === opt.id}
                      onChange={() => setPaymentOption(opt.id)}
                      className="mt-1"
                    />
                    <div>
                      <p className="text-sm font-medium text-[#e8e0d5]">
                        {opt.label} — {formatCentsAsCurrency(opt.amountCents)}
                      </p>
                      {opt.balanceNote ? (
                        <p className="text-xs text-[#e8e0d5]/50 mt-1">{opt.balanceNote}</p>
                      ) : null}
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-xs text-[#e8e0d5]/45">
                You&apos;ll complete payment securely with Stripe. Your site number will be emailed
                shortly after booking.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep("details")}
                  className="text-sm text-[#e8e0d5]/55 hover:text-[#d4af37]"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  disabled={checkoutLoading}
                  onClick={() => startCheckout()}
                  className="flex-1 rounded-lg bg-[#d4af37] text-[#1a120b] font-semibold py-3 text-sm hover:bg-[#f0d48f] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {checkoutLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Pay with card
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
