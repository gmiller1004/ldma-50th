"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Mail, Phone, X } from "lucide-react";
import {
  GARRETT_MODEL_LABELS,
  isValidEmail,
  isValidPhone,
  preferredContactPhrase,
  type AcademyInterestInput,
  type ContactMethod,
  type DetectorBrand,
  type GarrettModel,
} from "@/lib/detector-academy-interest";

type Step = "contact" | "owns" | "brand" | "model" | "done";
type Answers = { ownsDetector: boolean; detectorBrand: DetectorBrand | null; garrettModel: GarrettModel | null };

const inputClass =
  "w-full px-3 py-2.5 rounded-lg bg-[#0f0a06] border border-[#d4af37]/30 text-[#e8e0d5] placeholder:text-[#e8e0d5]/40 text-sm focus:outline-none focus:border-[#d4af37]";

function Choice({ label, onClick, icon }: { label: string; onClick: () => void; icon?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-xl border border-[#d4af37]/30 bg-[#0f0a06]/60 px-4 py-3.5 text-left text-[#e8e0d5] font-medium hover:border-[#d4af37] hover:bg-[#d4af37]/10 transition-colors"
    >
      {icon}
      {label}
    </button>
  );
}

export function InterestQuestionnaire({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<Step>("contact");
  const [contactMethod, setContactMethod] = useState<ContactMethod | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [lastAnswers, setLastAnswers] = useState<Answers | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<AcademyInterestInput | null>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

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

  if (!open) return null;

  const contactValid =
    firstName.trim().length > 0 &&
    (contactMethod === "email"
      ? isValidEmail(email)
      : contactMethod === "phone"
        ? isValidPhone(phone) && (!email.trim() || isValidEmail(email))
        : false);

  const questionNumber = { contact: 1, owns: 2, brand: 3, model: 4, done: 0 }[step];

  async function submit(answers: Answers) {
    setLastAnswers(answers);
    const payload = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      contactMethod,
      email: email.trim(),
      phone: contactMethod === "phone" ? phone.trim() : "",
      website,
      ...answers,
    };
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/events/detector-academy/interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Something went wrong. Please try again.");
        return;
      }
      setSubmitted(payload as AcademyInterestInput);
      setStep("done");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function back() {
    setError(null);
    if (step === "owns") setStep("contact");
    else if (step === "brand") setStep("owns");
    else if (step === "model") setStep("brand");
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="academy-interest-title"
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-[#d4af37]/40 bg-[#1a120b] shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-5">
          {step !== "contact" && step !== "done" ? (
            <button
              type="button"
              onClick={back}
              disabled={submitting}
              className="inline-flex items-center gap-1 text-sm text-[#e8e0d5]/70 hover:text-[#f0d48f]"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          ) : (
            <span className="text-xs uppercase tracking-[0.18em] text-[#d4af37]">LDMA Detector Academy</span>
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
          {questionNumber > 0 ? (
            <p className="text-xs text-[#e8e0d5]/50 mb-1">Question {questionNumber}</p>
          ) : null}

          {step === "contact" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (contactValid) setStep("owns");
              }}
              className="space-y-4"
            >
              <h2 id="academy-interest-title" className="font-serif text-2xl font-semibold text-[#f0d48f]">
                How would you like to be contacted?
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {(["email", "phone"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setContactMethod(m)}
                    aria-pressed={contactMethod === m}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 font-medium transition-colors ${
                      contactMethod === m
                        ? "border-[#d4af37] bg-[#d4af37]/15 text-[#f0d48f]"
                        : "border-[#d4af37]/30 text-[#e8e0d5] hover:border-[#d4af37]/60"
                    }`}
                  >
                    {m === "email" ? <Mail className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                    {m === "email" ? "Email" : "Phone"}
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
                  {contactMethod === "phone" ? (
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Phone number"
                      autoComplete="tel"
                      className={inputClass}
                    />
                  ) : null}
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={contactMethod === "email" ? "Email address" : "Email (optional, for event updates)"}
                    autoComplete="email"
                    className={inputClass}
                  />
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

          {step === "owns" && (
            <div className="space-y-4">
              <h2 id="academy-interest-title" className="font-serif text-2xl font-semibold text-[#f0d48f]">
                Do you already own a metal detector?
              </h2>
              <div className="space-y-3">
                <Choice
                  label="Yes"
                  onClick={() => setStep("brand")}
                />
                <Choice
                  label="Not yet"
                  onClick={() => void submit({ ownsDetector: false, detectorBrand: null, garrettModel: null })}
                />
              </div>
            </div>
          )}

          {step === "brand" && (
            <div className="space-y-4">
              <h2 id="academy-interest-title" className="font-serif text-2xl font-semibold text-[#f0d48f]">
                Is it a Garrett or another brand?
              </h2>
              <div className="space-y-3">
                <Choice
                  label="Garrett"
                  onClick={() => setStep("model")}
                />
                <Choice
                  label="Another brand"
                  onClick={() => void submit({ ownsDetector: true, detectorBrand: "other", garrettModel: null })}
                />
              </div>
            </div>
          )}

          {step === "model" && (
            <div className="space-y-4">
              <h2 id="academy-interest-title" className="font-serif text-2xl font-semibold text-[#f0d48f]">
                Which Garrett detector do you have?
              </h2>
              <div className="space-y-3">
                {(Object.keys(GARRETT_MODEL_LABELS) as GarrettModel[]).map((m) => (
                  <Choice
                    key={m}
                    label={GARRETT_MODEL_LABELS[m]}
                    onClick={() => void submit({ ownsDetector: true, detectorBrand: "garrett", garrettModel: m })}
                  />
                ))}
              </div>
            </div>
          )}

          {step === "done" && submitted && (
            <div className="text-center py-4 space-y-4">
              <CheckCircle2 className="w-12 h-12 text-[#d4af37] mx-auto" />
              <h2 id="academy-interest-title" className="font-serif text-2xl font-semibold text-[#f0d48f]">
                Thank you, {submitted.firstName}!
              </h2>
              <p className="text-[#e8e0d5]/85 leading-relaxed">
                A member of our team will be in touch shortly {preferredContactPhrase(submitted)}.
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
              {lastAnswers ? (
                <button type="button" className="underline" onClick={() => void submit(lastAnswers)}>
                  Try again
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
