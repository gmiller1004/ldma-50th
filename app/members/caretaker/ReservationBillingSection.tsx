"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { formatCentsAsCurrency } from "@/lib/reservation-pricing";
import { suggestedReservationPaymentCents } from "@/lib/reservation-billing";
import { caretakerAllowsCashExistingReservationPayment } from "@/lib/reservation-camps";

export type BillingPeriodRow = {
  id: string;
  periodIndex: number;
  periodStart: string;
  periodEnd: string;
  nights: number;
  amountDueCents: number;
  amountPaidCents: number;
  dueDate: string;
  status: string;
  pricingBasis: string;
};

export type SiteBalance = {
  balanceDueCents: number;
  totalDueCents: number;
  totalPaidCents: number;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function periodStatusLabel(status: string): string {
  if (status === "paid") return "Paid";
  if (status === "partial") return "Partial";
  if (status === "waived") return "Waived";
  if (status === "cancelled") return "Cancelled";
  return "Unpaid";
}

function periodStatusClass(status: string): string {
  if (status === "paid" || status === "waived") return "bg-[#0f3d1e] text-[#6dd472]";
  if (status === "partial") return "bg-[#4a3a0f] text-[#e8c547]";
  return "bg-red-950/60 text-red-300";
}

function periodRemainingCents(p: BillingPeriodRow): number {
  return Math.max(0, p.amountDueCents - p.amountPaidCents);
}

export function ReservationBillingSection({
  reservationId,
  checkInDate,
  balance,
  billingPeriods,
  recipientEmail,
  recipientDisplayName,
  onPaymentComplete,
  campSlug,
  autoFocusAmount,
}: {
  reservationId: string;
  checkInDate: string;
  balance: SiteBalance;
  billingPeriods: BillingPeriodRow[];
  recipientEmail: string;
  recipientDisplayName: string;
  onPaymentComplete: () => void;
  /** Required for director dashboard (admin paying on any camp). */
  campSlug?: string;
  autoFocusAmount?: boolean;
}) {
  const allowsCash = caretakerAllowsCashExistingReservationPayment();

  const suggestedCents = useMemo(
    () => suggestedReservationPaymentCents(billingPeriods, balance.balanceDueCents),
    [billingPeriods, balance.balanceDueCents]
  );

  const [amountCents, setAmountCents] = useState(suggestedCents);
  const [emailInput, setEmailInput] = useState(recipientEmail.trim());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAmountCents(suggestedCents);
  }, [reservationId, suggestedCents]);

  useEffect(() => {
    setEmailInput(recipientEmail.trim());
  }, [recipientEmail, reservationId]);

  const effectiveEmail = recipientEmail.trim() || emailInput.trim();
  const canPay = balance.balanceDueCents > 0;
  const emailValid = EMAIL_REGEX.test(effectiveEmail);
  const payAmount = Math.min(Math.max(1, amountCents), balance.balanceDueCents);
  const canSubmit = canPay && emailValid && payAmount >= 1;

  async function payCash() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/members/caretaker/payments/record-reservation-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId,
          amountCents: payAmount,
          recipientEmail: effectiveEmail,
          recipientDisplayName,
          ...(campSlug ? { campSlug } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Payment failed");
        return;
      }
      onPaymentComplete();
    } catch {
      setError("Payment failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function payCard() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/members/caretaker/payments/checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents: payAmount,
          paymentType: "reservation",
          reservationId,
          recipientEmail: effectiveEmail,
          recipientDisplayName,
          ...(campSlug ? { campSlug } : {}),
        }),
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
      setError("No checkout URL returned");
    } catch {
      setError("Checkout failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pt-3 border-t border-[#d4af37]/20 space-y-3">
      <div>
        <p className="text-[#f0d48f] font-medium text-sm mb-1">Site fees (this reservation)</p>
        <p className="text-[#e8e0d5] text-sm">
          Paid: <span className="font-medium">{formatCentsAsCurrency(balance.totalPaidCents)}</span>
          {" · "}
          Total due: <span className="font-medium">{formatCentsAsCurrency(balance.totalDueCents)}</span>
        </p>
        {balance.balanceDueCents > 0 ? (
          <p className="text-amber-400 text-sm mt-1">
            Balance due: <strong>{formatCentsAsCurrency(balance.balanceDueCents)}</strong>
          </p>
        ) : (
          <p className="text-[#6dd472] text-sm mt-1">Site fees paid in full</p>
        )}
      </div>

      {billingPeriods.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="text-[#e8e0d5]/60 border-b border-[#d4af37]/20">
                <th className="py-1 pr-2">Period</th>
                <th className="py-1 pr-2">Due</th>
                <th className="py-1 pr-2">Paid</th>
                <th className="py-1 pr-2">Remaining</th>
                <th className="py-1">Status</th>
              </tr>
            </thead>
            <tbody>
              {billingPeriods.map((p) => (
                <tr key={p.id} className="border-b border-[#d4af37]/10 text-[#e8e0d5]">
                  <td className="py-1.5 pr-2 whitespace-nowrap">
                    {p.periodStart} – {p.periodEnd}
                    <span className="text-[#e8e0d5]/50 ml-1">({p.nights}n)</span>
                  </td>
                  <td className="py-1.5 pr-2">{formatCentsAsCurrency(p.amountDueCents)}</td>
                  <td className="py-1.5 pr-2">{formatCentsAsCurrency(p.amountPaidCents)}</td>
                  <td className="py-1.5 pr-2">{formatCentsAsCurrency(periodRemainingCents(p))}</td>
                  <td className="py-1.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${periodStatusClass(p.status)}`}>
                      {periodStatusLabel(p.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canPay && (
        <div className="space-y-2 rounded-lg border border-[#d4af37]/25 bg-[#0f0a06]/50 p-3">
          <p className="text-[#f0d48f] font-medium text-sm">Collect site fee payment</p>
          <p className="text-[#e8e0d5]/60 text-xs">
            Enter any amount up to the balance due. Partial payments apply to the oldest unpaid period first
            (helpful for monthly stays).
          </p>
          {!recipientEmail.trim() && (
            <div>
              <label className="text-[#e8e0d5]/80 text-xs block mb-1">Receipt email *</label>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="email@example.com"
                className="w-full px-3 py-2 bg-[#0f0a06] border border-[#d4af37]/30 rounded text-[#e8e0d5] text-sm"
              />
            </div>
          )}
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="text-[#e8e0d5]/80 text-xs block mb-1">Payment amount $</label>
              <input
                type="number"
                min={0.01}
                max={balance.balanceDueCents / 100}
                step={0.01}
                value={amountCents / 100}
                onChange={(e) => setAmountCents(Math.round((parseFloat(e.target.value) || 0) * 100))}
                autoFocus={autoFocusAmount}
                className="w-32 px-3 py-2 bg-[#0f0a06] border border-[#d4af37]/30 rounded text-[#e8e0d5] text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2 pb-0.5">
              {suggestedCents > 0 && suggestedCents < balance.balanceDueCents && (
                <button
                  type="button"
                  onClick={() => setAmountCents(suggestedCents)}
                  className="text-xs text-[#d4af37] hover:underline"
                >
                  Current period ({formatCentsAsCurrency(suggestedCents)})
                </button>
              )}
              <button
                type="button"
                onClick={() => setAmountCents(balance.balanceDueCents)}
                className="text-xs text-[#d4af37] hover:underline"
              >
                Full balance ({formatCentsAsCurrency(balance.balanceDueCents)})
              </button>
            </div>
          </div>
          <p className="text-[#e8e0d5]/50 text-xs">
            Collecting {formatCentsAsCurrency(payAmount)} of {formatCentsAsCurrency(balance.balanceDueCents)} due
          </p>
          <div className="flex gap-2">
            {allowsCash && (
              <button
                type="button"
                onClick={payCash}
                disabled={submitting || !canSubmit}
                className="flex-1 py-2 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Pay cash
              </button>
            )}
            <button
              type="button"
              onClick={payCard}
              disabled={submitting || !canSubmit}
              className="flex-1 py-2 bg-[#2a1f14] border border-[#d4af37]/50 text-[#f0d48f] font-semibold rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-1"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Pay card
            </button>
          </div>
          {!emailValid && (
            <p className="text-amber-400/90 text-xs">A valid receipt email is required before collecting payment.</p>
          )}
        </div>
      )}

      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}

export function PaymentDueBadge({
  balanceDueCents,
  hasOverdue,
}: {
  balanceDueCents: number;
  hasOverdue?: boolean;
}) {
  if (balanceDueCents < 1) return null;
  return (
    <span
      className={`text-xs px-1.5 py-0.5 rounded font-medium ${
        hasOverdue ? "bg-red-950/70 text-red-300 border border-red-800/50" : "bg-[#4a3a0f] text-[#e8c547]"
      }`}
    >
      {hasOverdue ? "Overdue " : "Due "}
      {formatCentsAsCurrency(balanceDueCents)}
    </span>
  );
}
