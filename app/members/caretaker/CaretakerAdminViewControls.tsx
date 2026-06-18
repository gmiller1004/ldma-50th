"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Tent } from "lucide-react";

export function ViewAsCaretakerButton({
  campSlug,
  campName,
  variant = "default",
}: {
  campSlug: string;
  campName: string;
  variant?: "default" | "compact";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function enter() {
    setLoading(true);
    try {
      const res = await fetch("/api/members/caretaker/admin/view-camp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campSlug }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(typeof j.error === "string" ? j.error : "Could not open caretaker view");
        return;
      }
      router.push("/members/caretaker");
      router.refresh();
    } catch {
      alert("Could not open caretaker view");
    } finally {
      setLoading(false);
    }
  }

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={enter}
        disabled={loading}
        title={`View ${campName} as caretaker`}
        className="inline-flex items-center gap-1 rounded border border-[#d4af37]/40 px-2 py-1 text-[11px] font-medium text-[#f0d48f] hover:bg-[#d4af37]/10 disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Tent className="h-3 w-3" />}
        Caretaker view
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={enter}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-lg bg-[#d4af37] px-4 py-2 text-sm font-semibold text-[#1a120b] hover:bg-[#e0bc4a] disabled:opacity-50"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tent className="h-4 w-4" />}
      View as caretaker
    </button>
  );
}

export function AdminCaretakerViewBanner({ campName }: { campName: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function exitToDashboard() {
    setLoading(true);
    try {
      await fetch("/api/members/caretaker/admin/view-camp", { method: "DELETE" });
      router.push("/members/caretaker");
      router.refresh();
    } catch {
      alert("Could not return to director dashboard");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#d4af37]/35 bg-[#d4af37]/10 px-4 py-3">
      <p className="text-sm text-[#e8e0d5]/90">
        Viewing <strong className="text-[#f0d48f]">{campName}</strong> as caretaker — same tools as
        on-site staff.
      </p>
      <button
        type="button"
        onClick={exitToDashboard}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg border border-[#d4af37]/50 bg-[#1a120b]/60 px-3 py-2 text-sm font-medium text-[#f0d48f] hover:bg-[#d4af37]/15 disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeft className="h-4 w-4" />}
        Back to director dashboard
      </button>
    </div>
  );
}
