"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, X } from "lucide-react";
import { trackNewsletterSignup } from "@/lib/analytics";

const STORAGE_KEY = "ldma_events_exit_intent_v1";
/** Don't show again until this long after dismiss or successful signup */
const COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;
/** Touch / coarse-pointer devices: no real exit intent — offer modal once after this delay */
const MOBILE_FALLBACK_DELAY_MS = 50_000;

function getNextEligibleAt(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as { nextAt?: number };
    return typeof d.nextAt === "number" ? d.nextAt : null;
  } catch {
    return null;
  }
}

function setCooldown() {
  const nextAt = Date.now() + COOLDOWN_MS;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ nextAt }));
}

type Props = {
  isMemberLoggedIn: boolean;
  /** When true (e.g. event detail modal open), do not trigger the popup */
  blockTriggers?: boolean;
};

export function EventsExitIntentSignup({
  isMemberLoggedIn,
  blockTriggers = false,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = useState("");
  const shownThisSession = useRef(false);
  const blockRef = useRef(blockTriggers);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    blockRef.current = blockTriggers;
  }, [blockTriggers]);

  useEffect(() => {
    if (!mounted) return;
    if (isMemberLoggedIn) return;

    const nextAt = getNextEligibleAt();
    if (nextAt !== null && Date.now() < nextAt) return;

    const tryOpen = () => {
      if (blockRef.current) return;
      if (shownThisSession.current) return;
      shownThisSession.current = true;
      setOpen(true);
    };

    const prefersFinePointer = window.matchMedia("(pointer: fine)").matches;

    if (prefersFinePointer) {
      const onMouseOut = (e: MouseEvent) => {
        if (blockRef.current) return;
        if (shownThisSession.current) return;
        const to = e.relatedTarget as Node | null;
        if (to && document.documentElement.contains(to)) return;
        if (e.clientY > 12) return;
        tryOpen();
      };
      document.documentElement.addEventListener("mouseout", onMouseOut);
      return () => {
        document.documentElement.removeEventListener("mouseout", onMouseOut);
      };
    }

    const t = window.setTimeout(() => {
      if (blockRef.current) return;
      tryOpen();
    }, MOBILE_FALLBACK_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [mounted, isMemberLoggedIn]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setCooldown();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (status !== "success" || !open) return;
    const t = window.setTimeout(() => setOpen(false), 2800);
    return () => window.clearTimeout(t);
  }, [status, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || status === "loading") return;
    setStatus("loading");
    setErrorMessage("");
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          signup_source: "events",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        success?: boolean;
      };
      if (res.ok && data.success) {
        trackNewsletterSignup("events");
        setStatus("success");
        setCooldown();
      } else {
        setStatus("error");
        setErrorMessage(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setErrorMessage("Something went wrong. Please try again.");
    }
  }

  function dismiss() {
    setOpen(false);
    setCooldown();
  }

  if (!mounted || isMemberLoggedIn) return null;

  const modal = (
    <AnimatePresence>
      {open && (
        <motion.div
          key="events-exit-intent"
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="exit-intent-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.button
            type="button"
            className="absolute inset-0 bg-black/75 backdrop-blur-[2px]"
            aria-label="Close"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={dismiss}
          />
          <motion.div
            className="relative w-full max-w-lg rounded-2xl border border-[#d4af37]/40 bg-gradient-to-br from-[#1a120b] via-[#1a120b] to-[#0f3d1e]/40 shadow-[0_0_50px_rgba(212,175,55,0.2)] overflow-hidden"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={dismiss}
              className="absolute top-3 right-3 z-10 p-2 rounded-lg text-[#e8e0d5]/70 hover:text-[#e8e0d5] hover:bg-[#d4af37]/10 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-6 sm:p-8 pt-12">
              {status === "success" ? (
                <div className="text-center py-2">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#d4af37]/20 border border-[#d4af37] mb-4">
                    <Check className="w-7 h-7 text-[#d4af37]" strokeWidth={2.5} />
                  </div>
                  <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#f0d48f] mb-2">
                    You&apos;re on the list
                  </h3>
                  <p className="text-[#e8e0d5]/85 text-sm sm:text-base">
                    We&apos;ll email you when new LDMA events and registrations drop.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-[#d4af37]/90 text-xs font-semibold uppercase tracking-wider mb-2">
                    Before you go
                  </p>
                  <h2
                    id="exit-intent-title"
                    className="font-serif text-2xl sm:text-3xl font-bold text-[#f0d48f] leading-tight mb-3 pr-6"
                  >
                    Wait &mdash; don&apos;t miss out on LDMA events
                  </h2>
                  <p className="text-[#e8e0d5]/90 text-sm sm:text-base leading-relaxed mb-6">
                    New Dirt Fests and camp weekends sell out fast. Drop your email
                    and we&apos;ll let you know when registrations open.
                  </p>
                  <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Your email"
                        required
                        autoComplete="email"
                        autoFocus
                        disabled={status === "loading"}
                        className="flex-1 min-w-0 px-4 py-3 rounded-xl bg-[#0f0a06]/80 border border-[#d4af37]/35 text-[#e8e0d5] placeholder-[#e8e0d5]/45 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/45"
                      />
                      <button
                        type="submit"
                        disabled={status === "loading"}
                        className="px-5 py-3 rounded-xl bg-[#d4af37] text-[#1a120b] font-semibold hover:bg-[#f0d48f] transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2 shrink-0"
                      >
                        {status === "loading" ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Sending…
                          </>
                        ) : (
                          "Notify me"
                        )}
                      </button>
                    </div>
                    {status === "error" && errorMessage && (
                      <p className="text-sm text-amber-400/90">{errorMessage}</p>
                    )}
                  </form>
                  <p className="text-[#d4af37]/50 text-xs mt-4">
                    Unsubscribe anytime. No spam.
                  </p>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(modal, document.body);
}
