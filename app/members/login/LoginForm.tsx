"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";

type Step = "number" | "code";

export function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? undefined;
  const [step, setStep] = useState<Step>("number");
  const [memberNumber, setMemberNumber] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/members/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberNumber: memberNumber.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        if (data.action === "call") {
          setError(
            (data.error as string) +
              " Please call the office to verify your membership."
          );
        }
        return;
      }

      setStep("code");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/members/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          ...(redirectTo && { redirect: redirectTo }),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Invalid code");
        return;
      }

      window.location.href = data.redirect || "/members";
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (step === "code") {
    return (
      <motion.form
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleVerifyCode}
        className="space-y-6"
      >
        <div>
          <label
            htmlFor="code"
            className="block text-sm font-medium text-[#e8e0d5] mb-2"
          >
            6-digit code
          </label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            className="w-full px-4 py-3 bg-[#0f0a06] border border-[#d4af37]/30 rounded-lg text-[#e8e0d5] placeholder-[#e8e0d5]/40 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50 focus:border-[#d4af37]/50"
            autoFocus
          />
          <p className="mt-2 text-sm text-[#e8e0d5]/60">
            Check your email for the code. It expires in 10 minutes.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-950/50 border border-red-800/50 rounded-lg text-red-200 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              setStep("number");
              setCode("");
              setError(null);
            }}
            className="px-4 py-2.5 text-[#e8e0d5]/80 hover:text-[#d4af37] transition-colors"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="flex-1 px-6 py-3 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Verifying..." : "Sign in"}
          </button>
        </div>
      </motion.form>
    );
  }

  return (
    <form onSubmit={handleRequestCode} className="space-y-6">
      <div>
        <label
          htmlFor="memberNumber"
          className="block text-sm font-medium text-[#e8e0d5] mb-2"
        >
          Member number
        </label>
        <input
          id="memberNumber"
          type="text"
          inputMode="numeric"
          value={memberNumber}
          onChange={(e) => setMemberNumber(e.target.value)}
          placeholder="e.g. 12345"
          className="w-full px-4 py-3 bg-[#0f0a06] border border-[#d4af37]/30 rounded-lg text-[#e8e0d5] placeholder-[#e8e0d5]/40 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50 focus:border-[#d4af37]/50"
          autoFocus
        />
      </div>

      {error && (
        <div className="p-3 bg-red-950/50 border border-red-800/50 rounded-lg text-red-200 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !memberNumber.trim()}
        className="w-full px-6 py-3 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Sending code..." : "Send login code"}
      </button>
    </form>
  );
}
