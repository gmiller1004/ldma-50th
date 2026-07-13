"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { directoryCamps } from "@/lib/directory-camps";
import { campUsesReservations, caretakerAllowsCashCheckIn, caretakerEarliestCheckInDate } from "@/lib/reservation-camps";
import { computeStayPricing, formatCentsAsCurrency, generateBillingPeriods } from "@/lib/reservation-pricing";
import { countNights } from "@/lib/reservation-dates";
import { suggestedReservationPaymentCents } from "@/lib/reservation-billing";
import { scalePeriodDraftsToTotal } from "@/lib/reservation-price-override";
import { resolveCreateReservationPricing } from "@/lib/reservation-create-metadata";
import { parseCaretakerLookupInput } from "@/lib/member-contact-search";

type Site = {
  id: string;
  name: string;
  siteType: string;
  memberRateDaily: number | null;
  memberRateMonthly: number | null;
  nonMemberRateDaily: number | null;
};

type LookupResult = {
  contactId: string;
  memberNumber: string;
  displayName: string;
  email: string | null;
};

type LookupMatch = {
  contactId: string;
  memberNumber: string | null;
  displayName: string;
  email: string | null;
  phone: string | null;
};

const reservationCamps = directoryCamps.filter((c) => campUsesReservations(c.slug));

export function ManualReservationPanel() {
  const [campSlug, setCampSlug] = useState(reservationCamps[0]?.slug ?? "");
  const [sites, setSites] = useState<Site[]>([]);
  const [availableSiteIds, setAvailableSiteIds] = useState<string[]>([]);
  const [checkInDate, setCheckInDate] = useState("");
  const [checkOutDate, setCheckOutDate] = useState("");
  const [siteId, setSiteId] = useState("");
  const [resType, setResType] = useState<"member" | "guest">("member");
  const [memberQuery, setMemberQuery] = useState("");
  const [memberLookup, setMemberLookup] = useState<LookupResult | null>(null);
  const [memberMatches, setMemberMatches] = useState<LookupMatch[]>([]);
  const [memberLoading, setMemberLoading] = useState(false);
  const [guestFirstName, setGuestFirstName] = useState("");
  const [guestLastName, setGuestLastName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [stayTotalOverride, setStayTotalOverride] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [quotedTotalCents, setQuotedTotalCents] = useState<number | null>(null);
  const [quotedNights, setQuotedNights] = useState<number | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const earliestCheckIn = caretakerEarliestCheckInDate(today);
  const nights =
    quotedNights ??
    (checkInDate && checkOutDate && checkInDate < checkOutDate
      ? countNights(checkInDate, checkOutDate)
      : 0);
  const selectedSite = sites.find((s) => s.id === siteId);
  const localTotalCents =
    nights > 0 && selectedSite
      ? computeStayPricing({
          checkInDate,
          checkOutDate,
          isMember: resType === "member",
          rates: {
            memberRateDaily: selectedSite.memberRateDaily,
            memberRateMonthly: selectedSite.memberRateMonthly,
            nonMemberRateDaily: selectedSite.nonMemberRateDaily,
          },
        }).totalCents
      : 0;
  const calculatedTotalCents = quotedTotalCents ?? localTotalCents;
  const effectiveTotalCents = (() => {
    const r = resolveCreateReservationPricing(Math.max(0, calculatedTotalCents), {
      stayTotalOverrideDollars: stayTotalOverride,
      overrideReason,
      paymentAmountDollars: paymentAmount,
    });
    return r.ok ? r.stayTotalCents : calculatedTotalCents;
  })();
  const collectCents = (() => {
    const r = resolveCreateReservationPricing(Math.max(0, calculatedTotalCents), {
      stayTotalOverrideDollars: stayTotalOverride,
      overrideReason,
      paymentAmountDollars: paymentAmount,
    });
    return r.ok ? r.collectCents : effectiveTotalCents;
  })();
  const balanceAfterCents = Math.max(0, effectiveTotalCents - collectCents);

  const suggestedFirstPeriodCents = useMemo(() => {
    if (!selectedSite || nights < 1 || effectiveTotalCents < 1) return null;
    let drafts = generateBillingPeriods({
      checkInDate,
      checkOutDate,
      isMember: resType === "member",
      rates: {
        memberRateDaily: selectedSite.memberRateDaily,
        memberRateMonthly: selectedSite.memberRateMonthly,
        nonMemberRateDaily: selectedSite.nonMemberRateDaily,
      },
    });
    if (effectiveTotalCents !== calculatedTotalCents && calculatedTotalCents > 0) {
      drafts = scalePeriodDraftsToTotal(drafts, effectiveTotalCents);
    }
    return suggestedReservationPaymentCents(
      drafts.map((d) => ({
        status: "unpaid",
        amountDueCents: d.amountDueCents,
        amountPaidCents: 0,
      })),
      effectiveTotalCents
    );
  }, [selectedSite, nights, checkInDate, checkOutDate, resType, effectiveTotalCents, calculatedTotalCents]);

  function applyPricingFields(body: Record<string, unknown>): string | null {
    const resolved = resolveCreateReservationPricing(Math.max(0, calculatedTotalCents), {
      stayTotalOverrideDollars: stayTotalOverride,
      overrideReason,
      paymentAmountDollars: paymentAmount,
    });
    if (!resolved.ok) return resolved.error;
    Object.assign(body, resolved.fields);
    return null;
  }
  const allowsCash = checkInDate ? caretakerAllowsCashCheckIn(checkInDate, today) : false;

  useEffect(() => {
    if (!campSlug) return;
    fetch(`/api/members/caretaker/admin/sites?campSlug=${encodeURIComponent(campSlug)}`)
      .then((r) => (r.ok ? r.json() : { sites: [] }))
      .then((data) => {
        setSites(data.sites ?? []);
        setSiteId("");
        setAvailableSiteIds([]);
      })
      .catch(() => setSites([]));
  }, [campSlug]);

  useEffect(() => {
    if (!campSlug || !checkInDate || !checkOutDate || checkInDate >= checkOutDate) {
      setAvailableSiteIds([]);
      return;
    }
    const params = new URLSearchParams({
      campSlug,
      from: checkInDate,
      to: checkOutDate,
    });
    fetch(`/api/members/caretaker/admin/sites?${params}`)
      .then((r) => (r.ok ? r.json() : { availableSiteIds: [] as string[] }))
      .then((data: { availableSiteIds?: string[] }) => setAvailableSiteIds(data.availableSiteIds ?? []))
      .catch(() => setAvailableSiteIds([]));
  }, [campSlug, checkInDate, checkOutDate]);

  useEffect(() => {
    if (!campSlug || !siteId || !checkInDate || !checkOutDate || checkInDate >= checkOutDate) {
      setQuotedTotalCents(null);
      setQuotedNights(null);
      return;
    }
    const controller = new AbortController();
    setQuoteLoading(true);
    const params = new URLSearchParams({
      campSlug,
      siteId,
      checkInDate,
      checkOutDate,
      type: resType,
    });
    fetch(`/api/members/caretaker/reservations/quote?${params}`, { signal: controller.signal })
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          setQuotedTotalCents(null);
          setQuotedNights(null);
          return;
        }
        setQuotedTotalCents(
          typeof data.calculatedTotalCents === "number" ? data.calculatedTotalCents : null
        );
        setQuotedNights(typeof data.nights === "number" ? data.nights : null);
      })
      .catch((err: Error) => {
        if (err.name !== "AbortError") {
          setQuotedTotalCents(null);
          setQuotedNights(null);
        }
      })
      .finally(() => setQuoteLoading(false));
    return () => controller.abort();
  }, [campSlug, siteId, checkInDate, checkOutDate, resType]);

  async function runMemberLookup(body: Record<string, string>) {
    setMemberLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/members/caretaker/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Lookup failed");
        setMemberLookup(null);
        setMemberMatches([]);
        return;
      }
      if (data.multiple && Array.isArray(data.matches)) {
        setMemberMatches(data.matches);
        setMemberLookup(null);
        return;
      }
      if (!data.memberNumber) {
        setError("No member number on file");
        return;
      }
      setMemberLookup(data);
      setMemberMatches([]);
      setMemberQuery(data.memberNumber);
    } catch {
      setError("Lookup failed");
    } finally {
      setMemberLoading(false);
    }
  }

  function buildBaseBody(paymentMethod: "cash" | "card" | "none"): Record<string, unknown> {
    const body: Record<string, unknown> = {
      campSlug,
      siteId,
      checkInDate,
      checkOutDate,
      type: resType,
      paymentMethod,
      recipientEmail:
        resType === "member" ? memberLookup?.email?.trim() : guestEmail.trim(),
      recipientDisplayName:
        resType === "member"
          ? memberLookup?.displayName || `#${memberLookup?.memberNumber}`
          : `${guestFirstName.trim()} ${guestLastName.trim()}`.trim() || "Guest",
    };
    if (resType === "member" && memberLookup) {
      body.memberContactId = memberLookup.contactId;
      body.memberNumber = memberLookup.memberNumber;
      body.memberDisplayName = memberLookup.displayName;
    } else {
      body.guestFirstName = guestFirstName.trim();
      body.guestLastName = guestLastName.trim();
      body.guestEmail = guestEmail.trim();
      body.guestPhone = guestPhone.trim() || undefined;
    }
    return body;
  }

  function validate(): boolean {
    if (!campSlug || !siteId || !checkInDate || !checkOutDate) {
      setError("Select camp, site, and dates");
      return false;
    }
    if (resType === "member") {
      if (!memberLookup?.email) {
        setError("Look up member with email on file");
        return false;
      }
    } else if (!guestFirstName.trim() || !guestLastName.trim() || !guestEmail.trim()) {
      setError("Enter guest name and email");
      return false;
    }
    if (effectiveTotalCents === 0) {
      if (calculatedTotalCents > 0 && overrideReason.trim().length < 3) {
        setError("Override reason required for $0 comp");
        return false;
      }
    } else if (effectiveTotalCents < 1) {
      setError("Invalid stay total");
      return false;
    }
    if (quoteLoading) {
      setError("Stay total is still loading — please wait a moment");
      return false;
    }
    const pricingCheck = applyPricingFields({});
    if (pricingCheck && effectiveTotalCents > 0) {
      setError(pricingCheck);
      return false;
    }
    return true;
  }

  async function createComp() {
    if (!validate()) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const body = buildBaseBody("none");
      const resolved = resolveCreateReservationPricing(Math.max(0, calculatedTotalCents), {
        stayTotalOverrideDollars: "0",
        overrideReason,
        paymentAmountDollars: "0",
      });
      if (!resolved.ok) {
        setError(resolved.error);
        return;
      }
      Object.assign(body, resolved.fields);
      body.paymentMethod = "none";
      const res = await fetch("/api/members/caretaker/admin/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Create failed");
        return;
      }
      setSuccess(`Comp reservation created${data.invoiceNumber ? ` (${data.invoiceNumber})` : ""}.`);
    } catch {
      setError("Create failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function payCash() {
    if (!validate()) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const body = buildBaseBody("cash");
      const pricingErr = applyPricingFields(body);
      if (pricingErr) {
        setError(pricingErr);
        return;
      }
      const res = await fetch("/api/members/caretaker/admin/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Create failed");
        return;
      }
      setSuccess(`Reservation created${data.invoiceNumber ? ` (${data.invoiceNumber})` : ""}.`);
    } catch {
      setError("Create failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function payCard() {
    if (!validate()) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const checkoutBody: Record<string, unknown> = {
        campSlug,
        paymentType: "reservation",
        recipientEmail:
          resType === "member" ? memberLookup!.email!.trim() : guestEmail.trim(),
        recipientDisplayName:
          resType === "member"
            ? memberLookup!.displayName
            : `${guestFirstName.trim()} ${guestLastName.trim()}`.trim(),
        siteId,
        checkInDate,
        checkOutDate,
        nights,
        reservationType: resType,
      };
      if (resType === "member" && memberLookup) {
        checkoutBody.memberContactId = memberLookup.contactId;
        checkoutBody.memberNumber = memberLookup.memberNumber;
        checkoutBody.memberDisplayName = memberLookup.displayName;
      } else {
        checkoutBody.guestFirstName = guestFirstName.trim();
        checkoutBody.guestLastName = guestLastName.trim();
        checkoutBody.guestEmail = guestEmail.trim();
        checkoutBody.guestPhone = guestPhone.trim() || undefined;
      }
      const pricingErr = applyPricingFields(checkoutBody);
      if (pricingErr) {
        setError(pricingErr);
        return;
      }
      checkoutBody.campSlug = campSlug;

      const res = await fetch("/api/members/caretaker/payments/checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checkoutBody),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Checkout failed");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError("No checkout URL");
    } catch {
      setError("Checkout failed");
    } finally {
      setSubmitting(false);
    }
  }

  const siteOptions =
    checkInDate && checkOutDate && checkInDate < checkOutDate
      ? sites.filter((s) => availableSiteIds.includes(s.id))
      : sites;

  const inputClass =
    "w-full px-3 py-2 bg-[#0f0a06] border border-[#d4af37]/30 rounded-lg text-[#e8e0d5] text-sm";

  if (reservationCamps.length === 0) {
    return null;
  }

  return (
    <section className="rounded-lg border border-[#d4af37]/25 bg-[#0f0a06]/60 p-4 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-[#f0d48f]">Manual reservation</h2>
        <p className="text-xs text-[#e8e0d5]/60 mt-1">
          Create a site reservation at any camp (for imports, phone bookings, or camps without ResNexus data).
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-[#e8e0d5]/80">
          Camp
          <select
            value={campSlug}
            onChange={(e) => setCampSlug(e.target.value)}
            className={`${inputClass} mt-1`}
          >
            {reservationCamps.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-[#e8e0d5]/80">
          Site
          <select
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            className={`${inputClass} mt-1`}
          >
            <option value="">Select site</option>
            {siteOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.siteType})
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-[#e8e0d5]/80">
          Check-in
          <input
            type="date"
            min={earliestCheckIn}
            value={checkInDate}
            onChange={(e) => setCheckInDate(e.target.value)}
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className="block text-xs text-[#e8e0d5]/80">
          Check-out
          <input
            type="date"
            min={checkInDate || today}
            value={checkOutDate}
            onChange={(e) => setCheckOutDate(e.target.value)}
            className={`${inputClass} mt-1`}
          />
        </label>
      </div>

      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="radio" checked={resType === "member"} onChange={() => setResType("member")} />
          Member
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="radio" checked={resType === "guest"} onChange={() => setResType("guest")} />
          Guest
        </label>
      </div>

      {resType === "member" ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={memberQuery}
              onChange={(e) => {
                setMemberQuery(e.target.value);
                setMemberLookup(null);
                setMemberMatches([]);
              }}
              placeholder="Member #, email, or phone"
              className={`${inputClass} flex-1`}
            />
            <button
              type="button"
              disabled={memberLoading || !memberQuery.trim()}
              onClick={() => runMemberLookup(parseCaretakerLookupInput(memberQuery))}
              className="px-3 py-2 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg text-sm disabled:opacity-50"
            >
              {memberLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Look up"}
            </button>
          </div>
          {memberMatches.length > 0 && (
            <div className="space-y-1">
              {memberMatches.map((m) => (
                <button
                  key={m.contactId}
                  type="button"
                  onClick={() => runMemberLookup({ contactId: m.contactId })}
                  className="w-full text-left px-3 py-2 rounded border border-[#d4af37]/20 text-sm text-[#e8e0d5] hover:border-[#d4af37]/50"
                >
                  {m.displayName}
                  {m.memberNumber ? ` (#${m.memberNumber})` : ""}
                </button>
              ))}
            </div>
          )}
          {memberLookup && (
            <p className="text-sm text-[#e8e0d5]">
              ✓ {memberLookup.displayName} (#{memberLookup.memberNumber})
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            type="text"
            placeholder="First name"
            value={guestFirstName}
            onChange={(e) => setGuestFirstName(e.target.value)}
            className={inputClass}
          />
          <input
            type="text"
            placeholder="Last name"
            value={guestLastName}
            onChange={(e) => setGuestLastName(e.target.value)}
            className={inputClass}
          />
          <input
            type="email"
            placeholder="Email"
            value={guestEmail}
            onChange={(e) => setGuestEmail(e.target.value)}
            className={`${inputClass} sm:col-span-2`}
          />
          <input
            type="tel"
            placeholder="Phone (optional)"
            value={guestPhone}
            onChange={(e) => setGuestPhone(e.target.value)}
            className={`${inputClass} sm:col-span-2`}
          />
        </div>
      )}

      {nights > 0 && (
        <div className="grid gap-2 sm:grid-cols-2 pt-2 border-t border-[#d4af37]/15">
          <p className="sm:col-span-2 text-sm text-[#e8e0d5]">
            Calculated stay total: {formatCentsAsCurrency(calculatedTotalCents)}
            {quoteLoading ? <span className="text-[#e8e0d5]/50 text-xs"> (updating…)</span> : null}
            {nights > 0 ? (
              <span className="text-[#e8e0d5]/60 text-xs">
                {" "}
                · {nights} night{nights === 1 ? "" : "s"}
              </span>
            ) : null}
            {effectiveTotalCents !== calculatedTotalCents && (
              <span className="text-amber-300">
                {" "}
                → Stay total: {formatCentsAsCurrency(effectiveTotalCents)}
              </span>
            )}
          </p>
          <label className="block text-xs text-[#e8e0d5]/80">
            Collect now $
            <input
              type="number"
              min={0}
              max={effectiveTotalCents / 100}
              step={0.01}
              placeholder={(collectCents / 100).toFixed(2)}
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className={`${inputClass} mt-1`}
            />
            {suggestedFirstPeriodCents != null &&
              suggestedFirstPeriodCents > 0 &&
              suggestedFirstPeriodCents < effectiveTotalCents && (
                <button
                  type="button"
                  onClick={() => setPaymentAmount((suggestedFirstPeriodCents / 100).toFixed(2))}
                  className="mt-1 text-xs text-[#d4af37] hover:underline"
                >
                  First period ({formatCentsAsCurrency(suggestedFirstPeriodCents)})
                </button>
              )}
          </label>
          <label className="block text-xs text-[#e8e0d5]/80">
            Adjust stay total $ (optional)
            <input
              type="number"
              min={0}
              step={0.01}
              placeholder="Discount / comp on full stay"
              value={stayTotalOverride}
              onChange={(e) => setStayTotalOverride(e.target.value)}
              className={`${inputClass} mt-1`}
            />
          </label>
          <input
            type="text"
            placeholder="Reason if stay total differs"
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            className={`${inputClass} sm:col-span-2`}
          />
          {balanceAfterCents > 0 && (
            <p className="sm:col-span-2 text-xs text-amber-300/90">
              Balance after payment: {formatCentsAsCurrency(balanceAfterCents)}
            </p>
          )}
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {success && <p className="text-[#6dd472] text-sm">{success}</p>}

      <div className="flex flex-wrap gap-2">
        {effectiveTotalCents === 0 ? (
          <button
            type="button"
            onClick={createComp}
            disabled={submitting}
            className="px-4 py-2 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg text-sm disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Create comp (no payment)
          </button>
        ) : (
          <>
            {allowsCash && (
              <button
                type="button"
                onClick={payCash}
                disabled={submitting}
                className="px-4 py-2 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg text-sm disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Pay cash
              </button>
            )}
            <button
              type="button"
              onClick={payCard}
              disabled={submitting}
              className="px-4 py-2 border border-[#d4af37]/50 text-[#f0d48f] font-semibold rounded-lg text-sm disabled:opacity-50"
            >
              Pay card
            </button>
          </>
        )}
      </div>
    </section>
  );
}
