"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Mail, MessageSquare, Phone, X } from "lucide-react";
import { isValidEmail, isValidPhone } from "@/lib/lead-contact";
import {
  contactNeedsPhone,
  membershipContactPhrase,
  MEMBERSHIP_QUESTIONS_MAX,
  type MembershipContactMethod,
  type MembershipQuestionInput,
} from "@/lib/membership-question";

type Step = "contact" | "questions" | "done";

const inputClass =
  "w-full px-3 py-2.5 rounded-lg bg-[#0f0a06] border border-[#d4af37]/30 text-[#e8e0d5] placeholder:text-[#e8e0d5]/40 text-sm focus:outline-none focus:border-[#d4af37]";

const METHODS: { id: MembershipContactMethod; label: string; Icon: typeof Mail }[] = [
  { id: "email", label: "Email", Icon: Mail },
  { id: "phone", label: "Phone", Icon: Phone },
  { id: "text", label: "Text", Icon: MessageSquare },
];

export function MembershipQuestionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<Step>("contact");
  const [contactMethod, setContactMethod] = useState<MembershipContactMethod | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [questions, setQuestions] = useState("");
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<MembershipQuestionInput | null>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const questionsRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  useEffect(() => {
    if (contactMethod) firstFieldRef.current?.focus();
  }, [contactMethod]);

  useEffect(() => {
    if (step === "questions") questionsRef.current?.focus();
  }, [step]);

  if (!open) return null;

  const needsPhone = contactMethod ? contactNeedsPhone(contactMethod) : false;
  const contactValid =
    firstName.trim().length > 0 &&
    !!contactMethod &&
    (contactMethod === "email"
      ? isValidEmail(email)
      : isValidPhone(phone) && (!email.trim() || isValidEmail(email)));

  async function submit() {
    const payload = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      contactMethod,
      email: email.trim(),
      phone: needsPhone ? phone.trim() : "",
      questions: questions.trim(),
      website,
    };
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/membership/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Something went wrong. Please try again.");
        return;
      }
      setSubmitted(payload as MembershipQuestionInput);
      setStep("done");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="membership-question-title"
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-[#d4af37]/40 bg-[#1a120b] shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-5">
          {step === "questions" ? (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep("contact");
              }}
              disabled={submitting}
              className="inline-flex items-center gap-1 text-sm text-[#e8e0d5]/70 hover:text-[#f0d48f]"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          ) : (
            <span className="text-xs uppercase tracking-[0.18em] text-[#d4af37]">LDMA Membership</span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded text-[#e8e0d5]/60 hover:text-[#e8e0d5] hover:bg-[#d4af37]/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pb-6 pt-3">
          {step === "contact" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (contactValid) setStep("questions");
              }}
              className="space-y-4"
            >
              <h2 id="membership-question-title" className="font-serif text-2xl font-semibold text-[#f0d48f]">
                How would you like to be contacted?
              </h2>
              <div className="grid grid-cols-3 gap-2.5">
                {METHODS.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setContactMethod(id)}
                    aria-pressed={contactMethod === id}
                    className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 rounded-xl border px-3 py-3 font-medium transition-colors ${
                      contactMethod === id
                        ? "border-[#d4af37] bg-[#d4af37]/15 text-[#f0d48f]"
                        : "border-[#d4af37]/30 text-[#e8e0d5] hover:border-[#d4af37]/60"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>

              {contactMethod ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      ref={firstFieldRef}
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="First name"
                      autoComplete="given-name"
                      className={inputClass}
                    />
                    <input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Last name"
                      autoComplete="family-name"
                      className={inputClass}
                    />
                  </div>
                  {needsPhone ? (
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder={contactMethod === "text" ? "Mobile number" : "Phone number"}
                      autoComplete="tel"
                      className={inputClass}
                    />
                  ) : null}
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={contactMethod === "email" ? "Email address" : "Email (optional)"}
                    autoComplete="email"
                    className={inputClass}
                  />
                  {contactMethod === "text" ? (
                    <p className="text-xs text-[#e8e0d5]/55">
                      By choosing text, you agree that a member of our team may text you about your questions.
                    </p>
                  ) : null}
                  <input
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="hidden"
                    aria-hidden="true"
                  />
                  <button
                    type="submit"
                    disabled={!contactValid}
                    className="w-full px-6 py-3 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors disabled:opacity-50"
                  >
                    Continue
                  </button>
                </div>
              ) : null}
            </form>
          )}

          {step === "questions" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
              className="space-y-4"
            >
              <h2 id="membership-question-title" className="font-serif text-2xl font-semibold text-[#f0d48f]">
                What would you like to know?
              </h2>
              <p className="text-sm text-[#e8e0d5]/70">
                Optional. Share any questions and we&apos;ll have answers ready when we reach out.
              </p>
              <textarea
                ref={questionsRef}
                value={questions}
                onChange={(e) => setQuestions(e.target.value)}
                maxLength={MEMBERSHIP_QUESTIONS_MAX}
                rows={5}
                placeholder="For example: payment plans, which camps are near me, or how the Companion membership works"
                className={`${inputClass} resize-y min-h-[120px]`}
              />
              <button
                type="submit"
                disabled={submitting}
                className="w-full px-6 py-3 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors disabled:opacity-50"
              >
                {questions.trim() ? "Send my questions" : "Send without questions"}
              </button>
            </form>
          )}

          {step === "done" && submitted && (
            <div className="text-center py-4 space-y-4">
              <CheckCircle2 className="w-12 h-12 text-[#d4af37] mx-auto" />
              <h2 id="membership-question-title" className="font-serif text-2xl font-semibold text-[#f0d48f]">
                Thank you, {submitted.firstName}!
              </h2>
              <p className="text-[#e8e0d5]/85 leading-relaxed">
                A member of our team will be in touch shortly {membershipContactPhrase(submitted)}.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors"
              >
                Close
              </button>
            </div>
          )}

          {submitting ? (
            <p className="mt-4 flex items-center justify-center gap-2 text-sm text-[#e8e0d5]/70">
              <Loader2 className="w-4 h-4 animate-spin" /> Sending…
            </p>
          ) : null}
          {error ? (
            <div className="mt-4 rounded-lg border border-red-500/40 bg-red-950/30 p-3 text-sm text-red-200">
              {error}{" "}
              <button type="button" className="underline" onClick={() => void submit()}>
                Try again
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
