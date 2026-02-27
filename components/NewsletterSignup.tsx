"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Sparkles } from "lucide-react";

export function NewsletterSignup() {
  const [success, setSuccess] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKlaviyoSubmit = (e: Event) => {
      const event = e as CustomEvent<{ type: string }>;
      if (event.detail?.type === "submit") {
        setSuccess(true);
      }
    };

    window.addEventListener("klaviyoForms", handleKlaviyoSubmit);
    return () => window.removeEventListener("klaviyoForms", handleKlaviyoSubmit);
  }, []);

  return (
    <motion.section
      className="py-20 md:py-28 bg-[#1a120b]"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6 }}
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <AnimatePresence mode="wait">
          {success ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="max-w-md mx-auto text-center"
            >
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
                  You&apos;re in the club!
                </h3>
                <p className="text-[#e8e0d5]/80 mb-6">
                  Keep an eye on your inbox for gold rush updates.
                </p>
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
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-md mx-auto"
            >
              <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-[#f0d48f] text-center mb-4">
                Stay in the Gold Rush – Join the 50th Anniversary List
              </h2>
              <p className="text-center text-[#e8e0d5] font-sans text-base sm:text-lg mb-10">
                Get early access to DirtFest 2026 tickets, limited-edition 50th
                merch drops, member stories, camp updates, and more. The legacy
                continues with you.
              </p>

              <div
                ref={formRef}
                className="newsletter-klaviyo-wrapper rounded-xl border border-[#d4af37]/30 bg-[#0f3d1e]/20 p-6 sm:p-8 shadow-[0_0_25px_rgba(212,175,55,0.1)]"
              >
                <div
                  className="klaviyo-form-VwfrBY min-h-[120px]"
                  suppressHydrationWarning
                />
              </div>

              <p className="text-center text-[#d4af37]/60 text-sm mt-6">
                We respect your inbox. Unsubscribe anytime. Only gold — no spam.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}
