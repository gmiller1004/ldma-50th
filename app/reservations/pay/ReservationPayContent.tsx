"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { formatCentsAsCurrency } from "@/lib/reservation-pricing";

type PaySummary = {
  campName: string;
  guestOrMemberName: string;
  checkInDate: string;
  checkOutDate: string;
  siteLabel: string;
  balanceDueCents: number;
  totalRemainingCents?: number;
  nextPaymentDueDate?: string | null;
  nextPaymentDueCents?: number | null;
  paidInFull: boolean;
  nothingPayableNow?: boolean;
};

export function ReservationPayContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const paid = searchParams.get("paid") === "1";

  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<PaySummary | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Missing payment link.");
      setLoading(false);
      return;
    }
    fetch(`/api/camp/booking/pay-balance?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data: PaySummary & { error?: string }) => {
        if (data.error) throw new Error(data.error);
        setSummary(data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load reservation"))
      .finally(() => setLoading(false));
  }, [token]);

  async function pay() {
    if (!token) return;
    setPaying(true);
    setError(null);
    try {
      const res = await fetch("/api/camp/booking/pay-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "Checkout failed");
      if (!data.url) throw new Error("No checkout URL");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
      setPaying(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#1a120b] text-[#e8e0d5] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-[#d4af37]/30 bg-[#2a1f14] p-6 shadow-2xl">
        <h1 className="font-serif text-2xl text-[#f0d48f] mb-2">Pay campsite balance</h1>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-[#e8e0d5]/70 py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading reservation…
          </div>
        ) : error ? (
          <p className="text-sm text-red-200 bg-red-950/30 border border-red-500/30 rounded-lg px-3 py-2">
            {error}
          </p>
        ) : summary ? (
          <div className="space-y-4">
            {paid && summary.paidInFull ? (
              <p className="text-sm text-[#6dd472] bg-[#0f3d1e]/40 border border-[#6dd472]/30 rounded-lg px-3 py-2">
                Payment received — thank you! Your campsite fees are paid in full.
              </p>
            ) : paid && !summary.paidInFull ? (
              <p className="text-sm text-[#6dd472] bg-[#0f3d1e]/40 border border-[#6dd472]/30 rounded-lg px-3 py-2">
                Payment received — thank you!
              </p>
            ) : null}
            <p className="text-sm text-[#e8e0d5]/75">
              Hi {summary.guestOrMemberName}, your stay at <strong className="text-[#f0d48f]">{summary.campName}</strong> is{" "}
              {summary.checkInDate} – {summary.checkOutDate}.
            </p>
            <p className="text-sm">
              Site: <span className="text-[#f0d48f]">{summary.siteLabel}</span>
            </p>
            {summary.paidInFull ? (
              <p className="text-sm text-[#6dd472]">No balance due — you&apos;re all set.</p>
            ) : summary.nothingPayableNow ? (
              <div className="space-y-2 text-sm text-[#e8e0d5]/75">
                <p>No payment is due right now.</p>
                {summary.nextPaymentDueDate && summary.nextPaymentDueCents ? (
                  <p>
                    Next payment:{" "}
                    <strong className="text-[#f0d48f]">
                      {formatCentsAsCurrency(summary.nextPaymentDueCents)}
                    </strong>{" "}
                    due on <strong className="text-[#f0d48f]">{summary.nextPaymentDueDate}</strong>.
                  </p>
                ) : null}
              </div>
            ) : (
              <>
                <p className="text-lg font-semibold text-[#f0d48f]">
                  Amount due now: {formatCentsAsCurrency(summary.balanceDueCents)}
                </p>
                {summary.totalRemainingCents != null &&
                summary.totalRemainingCents > summary.balanceDueCents ? (
                  <p className="text-xs text-[#e8e0d5]/55">
                    Total remaining on your stay: {formatCentsAsCurrency(summary.totalRemainingCents)}.
                    Future months will be billed on their due dates.
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={paying}
                  onClick={() => pay()}
                  className="w-full rounded-lg bg-[#d4af37] text-[#1a120b] font-semibold py-3 text-sm hover:bg-[#f0d48f] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Pay with card
                </button>
              </>
            )}
          </div>
        ) : null}

        <p className="mt-6 text-xs text-[#e8e0d5]/50">
          Questions? Contact{" "}
          <a href="mailto:info@lostdutchmans.com" className="text-[#d4af37] underline">
            info@lostdutchmans.com
          </a>{" "}
          or (888) 465-3717.
        </p>
        <p className="mt-3 text-xs">
          <Link href="/" className="text-[#d4af37]/80 hover:text-[#f0d48f]">
            ← Back to LDMA
          </Link>
        </p>
      </div>
    </main>
  );
}
