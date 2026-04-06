"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Mail, Sparkles, Loader2 } from "lucide-react";
import { trackNewsletterSignup } from "@/lib/analytics";

const DEFAULT_TITLE = "Stay in the Gold Rush – Join the 50th Anniversary List";
const DEFAULT_DESCRIPTION =
  "Get early access to DirtFest 2026 tickets, limited-edition 50th merch drops, member stories, camp updates, and more. The legacy continues with you.";

export type NewsletterSignupProps = {
  /** Full homepage block vs compact banner (e.g. /events) */
  variant?: "section" | "banner";
  /** Analytics: passed as signup_source to GA4 */
  analyticsSource?: string;
  id?: string;
  title?: string;
  description?: string;
  successTitle?: string;
  successMessage?: string;
  submitLabel?: string;
};

export function NewsletterSignup({
  variant = "section",
  analyticsSource,
  id,
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  successTitle = "You're in the club!",
  successMessage = "Keep an eye on your inbox for gold rush updates.",
  submitLabel = "Join the List",
}: NewsletterSignupProps = {}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

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
          signup_source: analyticsSource ?? "home",
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        success?: boolean;
      };

      if (res.ok && data.success) {
        trackNewsletterSignup(analyticsSource);
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

  const isBanner = variant === "banner";

  const formInner = (
    <>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          required
          disabled={status === "loading"}
          autoComplete="email"
          className="flex-1 min-w-0 px-4 py-3 rounded-lg bg-[#1a120b] border border-[#d4af37]/30 text-[#e8e0d5] placeholder-[#e8e0d5]/50 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50 focus:border-[#d4af37]/50 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="px-6 py-3 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 shrink-0"
        >
          {status === "loading" ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {isBanner ? "Signing up…" : "Joining…"}
            </>
          ) : (
            submitLabel
          )}
        </button>
      </div>
      {status === "error" && errorMessage && (
        <p className="mt-3 text-sm text-amber-400/90">{errorMessage}</p>
      )}
    </>
  );

  const privacyLine = (
    <p
      className={
        isBanner
          ? "text-[#d4af37]/55 text-xs mt-4"
          : "text-center text-[#d4af37]/60 text-sm mt-6"
      }
    >
      We respect your inbox. Unsubscribe anytime. Only gold — no spam.
    </p>
  );

  return (
    <motion.section
      id={id}
      className={
        isBanner
          ? "py-8 md:py-10"
          : "py-20 md:py-28 bg-[#1a120b]"
      }
      initial={isBanner ? false : { opacity: 0, y: 30 }}
      whileInView={isBanner ? undefined : { opacity: 1, y: 0 }}
      viewport={isBanner ? undefined : { once: true, margin: "-100px" }}
      transition={isBanner ? undefined : { duration: 0.6 }}
    >
      <div
        className={
          isBanner
            ? "max-w-6xl mx-auto px-4 sm:px-6"
            : "max-w-4xl mx-auto px-4 sm:px-6"
        }
      >
        <AnimatePresence mode="wait">
          {status === "success" ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className={
                isBanner
                  ? "rounded-2xl border border-[#d4af37]/40 bg-[#0f3d1e]/25 px-6 py-8 md:px-10 md:py-10 flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-10"
                  : "max-w-md mx-auto text-center"
              }
            >
              {isBanner ? (
                <>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#d4af37]/20 border-2 border-[#d4af37]">
                      <Check className="w-7 h-7 text-[#d4af37]" strokeWidth={2.5} />
                    </div>
                    <div>
                      <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#f0d48f]">
                        {successTitle}
                      </h3>
                      <p className="text-[#e8e0d5]/85 text-sm sm:text-base mt-1">
                        {successMessage}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-[#d4af37]/40 bg-[#0f3d1e]/20 p-10 shadow-[0_0_30px_rgba(212,175,55,0.15)]">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                    className="mb-6 inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#d4af37]/20 border-2 border-[#d4af37]"
                  >
                    <Check className="w-10 h-10 text-[#d4af37]" strokeWidth={2.5} />
                  </motion.div>
                  <h3 className="font-serif text-2xl sm:text-3xl font-bold text-[#f0d48f] mb-4">
                    {successTitle}
                  </h3>
                  <p className="text-[#e8e0d5]/80 mb-6">{successMessage}</p>
                  <motion.div
                    animate={{
                      opacity: [0.4, 1, 0.4],
                      scale: [1, 1.05, 1],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="inline-flex items-center gap-2 text-[#d4af37]/60"
                  >
                    <Sparkles className="w-5 h-5" />
                    <Sparkles className="w-4 h-4" />
                    <Sparkles className="w-5 h-5" />
                  </motion.div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={isBanner ? undefined : "max-w-md mx-auto"}
            >
              {isBanner ? (
                <div className="rounded-2xl border border-[#d4af37]/35 bg-gradient-to-br from-[#0f3d1e]/35 via-[#1a120b] to-[#1a120b] p-6 md:p-8 shadow-[0_0_40px_rgba(212,175,55,0.12)]">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-8 lg:gap-12">
                    <div className="flex-1 min-w-0">
                      <div className="flex gap-3">
                        <span className="mt-0.5 inline-flex h-fit rounded-lg bg-[#d4af37]/15 p-2 text-[#d4af37] shrink-0">
                          <Mail className="w-5 h-5" aria-hidden />
                        </span>
                        <div className="min-w-0">
                          <h2 className="font-serif text-xl sm:text-2xl md:text-3xl font-bold text-[#f0d48f] leading-snug">
                            {title}
                          </h2>
                          <p className="mt-3 text-[#e8e0d5]/90 text-sm sm:text-base leading-relaxed">
                            {description}
                          </p>
                        </div>
                      </div>
                    </div>
                    <form
                      onSubmit={handleSubmit}
                      className="flex-1 min-w-0 lg:max-w-md lg:pt-1"
                    >
                      {formInner}
                      {privacyLine}
                    </form>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-[#f0d48f] text-center mb-4">
                    {title}
                  </h2>
                  <p className="text-center text-[#e8e0d5] font-sans text-base sm:text-lg mb-10">
                    {description}
                  </p>

                  <form
                    onSubmit={handleSubmit}
                    className="rounded-xl border border-[#d4af37]/30 bg-[#0f3d1e]/20 p-6 sm:p-8 shadow-[0_0_25px_rgba(212,175,55,0.1)]"
                  >
                    {formInner}
                  </form>

                  {privacyLine}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}
