"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, X } from "lucide-react";
import { CAMP_FILTERS } from "@/lib/events-config";
import { trackDiscoverCtaClick, trackNewsletterSignup } from "@/lib/analytics";

export type DiscoverLeadModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  interestPath: string;
  referrerCta: string;
  eventTypeInterest?: string;
  showCampSelect?: boolean;
  submitLabel?: string;
  successTitle?: string;
  successMessage?: string;
};

export function DiscoverLeadModal({
  open,
  onClose,
  title,
  description,
  interestPath,
  referrerCta,
  eventTypeInterest,
  showCampSelect = false,
  submitLabel = "Send me updates",
  successTitle = "You're on the list!",
  successMessage = "Check your inbox — we'll send event dates, tips, and registration reminders.",
}: DiscoverLeadModalProps) {
  const [email, setEmail] = useState("");
  const [campInterest, setCampInterest] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  function handleClose() {
    if (status === "loading") return;
    onClose();
    setTimeout(() => {
      setEmail("");
      setCampInterest("");
      setStatus("idle");
      setErrorMessage("");
    }, 300);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || status === "loading") return;

    setStatus("loading");
    setErrorMessage("");
    trackDiscoverCtaClick("lead_submit", interestPath);

    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          signup_source: "discover_events",
          interest_path: interestPath,
          referrer_cta: referrerCta,
          ...(eventTypeInterest ? { event_type_interest: eventTypeInterest } : {}),
          ...(campInterest ? { camp_interest: campInterest } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; success?: boolean };
      if (res.ok && data.success) {
        trackNewsletterSignup("discover_events");
        setStatus("success");
      } else {
        setStatus("error");
        setErrorMessage(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setErrorMessage("Something went wrong. Please try again.");
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85"
      onClick={handleClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-[#1a120b] border border-[#d4af37]/35 rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start gap-3 mb-4">
          <h3 className="font-serif text-xl sm:text-2xl font-semibold text-[#f0d48f] pr-2">
            {status === "success" ? successTitle : title}
          </h3>
          <button
            type="button"
            onClick={handleClose}
            className="text-[#e8e0d5]/50 hover:text-[#e8e0d5] shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {status === "success" ? (
            <motion.div
              key="success"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-4"
            >
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#d4af37]/20 border-2 border-[#d4af37] mb-4">
                <Check className="w-7 h-7 text-[#d4af37]" strokeWidth={2.5} />
              </div>
              <p className="text-[#e8e0d5]/85 text-sm leading-relaxed">{successMessage}</p>
              <button
                type="button"
                onClick={handleClose}
                className="mt-6 text-[#d4af37] hover:text-[#f0d48f] text-sm font-medium"
              >
                Done
              </button>
            </motion.div>
          ) : (
            <motion.form key="form" onSubmit={handleSubmit} className="space-y-4">
              <p className="text-[#e8e0d5]/80 text-sm leading-relaxed">{description}</p>
              <div>
                <label className="block text-xs font-medium text-[#e8e0d5]/70 mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  disabled={status === "loading"}
                  className="w-full px-4 py-3 rounded-lg bg-[#0f0a06] border border-[#d4af37]/30 text-[#e8e0d5] placeholder-[#e8e0d5]/40 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/40"
                />
              </div>
              {showCampSelect && (
                <div>
                  <label className="block text-xs font-medium text-[#e8e0d5]/70 mb-1.5">
                    Nearest camp (optional)
                  </label>
                  <select
                    value={campInterest}
                    onChange={(e) => setCampInterest(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-[#0f0a06] border border-[#d4af37]/30 text-[#e8e0d5] focus:outline-none focus:ring-2 focus:ring-[#d4af37]/40"
                  >
                    <option value="">Any camp / not sure yet</option>
                    {CAMP_FILTERS.slice(1).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {status === "error" && errorMessage && (
                <p className="text-sm text-amber-400/90">{errorMessage}</p>
              )}
              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full py-3.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {status === "loading" ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Sending…
                  </>
                ) : (
                  submitLabel
                )}
              </button>
              <p className="text-[#e8e0d5]/45 text-xs text-center">
                No spam — unsubscribe anytime.
              </p>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
