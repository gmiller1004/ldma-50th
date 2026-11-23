"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, X } from "lucide-react";
import {
  ACADEMY_BRING_DETECTOR_LABELS,
  ACADEMY_CAMPING_LABELS,
  ACADEMY_EXPERIENCE_LABELS,
  ACADEMY_HEARD_ABOUT_LABELS,
  ACADEMY_MEMBERSHIP_LABELS,
  ACADEMY_QUALIFIER_LABELS,
  type AcademyBringDetector,
  type AcademyCamping,
  type AcademyDiscountInput,
  type AcademyExperience,
  type AcademyHeardAbout,
  type AcademyMembership,
  type AcademyQualifier,
} from "@/lib/detector-academy-discount";
import { isValidEmail } from "@/lib/lead-contact";

type Step =
  | "contact"
  | "membership"
  | "qualifier"
  | "detector"
  | "experience"
  | "source"
  | "camping"
  | "done";

const STEP_ORDER: Step[] = [
  "contact",
  "membership",
  "qualifier",
  "detector",
  "experience",
  "source",
  "camping",
  "done",
];

const inputClass =
  "w-full px-3 py-2.5 rounded-lg bg-[#0f0a06] border border-[#d4af37]/30 text-[#e8e0d5] placeholder:text-[#e8e0d5]/40 text-sm focus:outline-none focus:border-[#d4af37]";

function Choice({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-xl border border-[#d4af37]/30 bg-[#0f0a06]/60 px-4 py-3.5 text-left text-[#e8e0d5] font-medium hover:border-[#d4af37] hover:bg-[#d4af37]/10 transition-colors"
    >
      {label}
    </button>
  );
}

function questionNumber(step: Step): number {
  const i = STEP_ORDER.indexOf(step);
  return step === "done" ? 0 : i + 1;
}

export function DiscountQuestionnaire({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<Step>("contact");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [membership, setMembership] = useState<AcademyMembership | null>(null);
  const [qualifier, setQualifier] = useState<AcademyQualifier | null>(null);
  const [bringDetector, setBringDetector] = useState<AcademyBringDetector | null>(null);
  const [experience, setExperience] = useState<AcademyExperience | null>(null);
  const [heardAbout, setHeardAbout] = useState<AcademyHeardAbout | null>(null);
  const [camping, setCamping] = useState<AcademyCamping | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<AcademyDiscountInput | null>(null);
  const [qualifies, setQualifies] = useState(false);
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
    if (open && step === "contact") firstFieldRef.current?.focus();
  }, [open, step]);

  if (!open) return null;

  const contactValid = firstName.trim().length > 0 && isValidEmail(email);

  async function submit(finalCamping: AcademyCamping) {
    const payload: AcademyDiscountInput = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      membership: membership!,
      qualifier: qualifier!,
      bringDetector: bringDetector!,
      experience: experience!,
      heardAbout: heardAbout!,
      camping: finalCamping,
    };
    setCamping(finalCamping);
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/events/detector-academy/discount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, website }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Something went wrong. Please try again.");
        return;
      }
      setQualifies(Boolean(body.qualifies));
      setSubmitted(payload);
      setStep("done");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function back() {
    setError(null);
    const i = STEP_ORDER.indexOf(step);
    if (i > 0) setStep(STEP_ORDER[i - 1]!);
  }

  const qn = questionNumber(step);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="academy-discount-title"
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
            <span className="text-xs uppercase tracking-[0.18em] text-[#d4af37]">Apply for a discount</span>
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
          {qn > 0 ? <p className="text-xs text-[#e8e0d5]/50 mb-1">Question {qn} of 7</p> : null}

          {step === "contact" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (contactValid) setStep("membership");
              }}
              className="space-y-4"
            >
              <h2 id="academy-discount-title" className="font-serif text-2xl font-semibold text-[#f0d48f]">
                What&apos;s your name and email?
              </h2>
              <p className="text-sm text-[#e8e0d5]/70 leading-relaxed -mt-1">
                25% off for GPAA or LDMA members, military (active or veteran), first responders, and teachers. If you
                qualify, we&apos;ll email your discount code.
              </p>
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
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
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
            </form>
          )}

          {step === "membership" && (
            <div className="space-y-4">
              <h2 id="academy-discount-title" className="font-serif text-2xl font-semibold text-[#f0d48f]">
                Are you a GPAA or LDMA member?
              </h2>
              <div className="space-y-3">
                {(Object.keys(ACADEMY_MEMBERSHIP_LABELS) as AcademyMembership[]).map((m) => (
                  <Choice
                    key={m}
                    label={ACADEMY_MEMBERSHIP_LABELS[m]}
                    onClick={() => {
                      setMembership(m);
                      setStep("qualifier");
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {step === "qualifier" && (
            <div className="space-y-4">
              <h2 id="academy-discount-title" className="font-serif text-2xl font-semibold text-[#f0d48f]">
                Do any of these describe you?
              </h2>
              <div className="space-y-3">
                {(Object.keys(ACADEMY_QUALIFIER_LABELS) as AcademyQualifier[]).map((q) => (
                  <Choice
                    key={q}
                    label={ACADEMY_QUALIFIER_LABELS[q]}
                    onClick={() => {
                      setQualifier(q);
                      setStep("detector");
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {step === "detector" && (
            <div className="space-y-4">
              <h2 id="academy-discount-title" className="font-serif text-2xl font-semibold text-[#f0d48f]">
                Which detector will you bring?
              </h2>
              <div className="space-y-3">
                {(Object.keys(ACADEMY_BRING_DETECTOR_LABELS) as AcademyBringDetector[]).map((d) => (
                  <Choice
                    key={d}
                    label={ACADEMY_BRING_DETECTOR_LABELS[d]}
                    onClick={() => {
                      setBringDetector(d);
                      setStep("experience");
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {step === "experience" && (
            <div className="space-y-4">
              <h2 id="academy-discount-title" className="font-serif text-2xl font-semibold text-[#f0d48f]">
                How much detecting experience do you have?
              </h2>
              <div className="space-y-3">
                {(Object.keys(ACADEMY_EXPERIENCE_LABELS) as AcademyExperience[]).map((x) => (
                  <Choice
                    key={x}
                    label={ACADEMY_EXPERIENCE_LABELS[x]}
                    onClick={() => {
                      setExperience(x);
                      setStep("source");
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {step === "source" && (
            <div className="space-y-4">
              <h2 id="academy-discount-title" className="font-serif text-2xl font-semibold text-[#f0d48f]">
                How did you hear about the academy?
              </h2>
              <div className="space-y-3">
                {(Object.keys(ACADEMY_HEARD_ABOUT_LABELS) as AcademyHeardAbout[]).map((h) => (
                  <Choice
                    key={h}
                    label={ACADEMY_HEARD_ABOUT_LABELS[h]}
                    onClick={() => {
                      setHeardAbout(h);
                      setStep("camping");
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {step === "camping" && (
            <div className="space-y-4">
              <h2 id="academy-discount-title" className="font-serif text-2xl font-semibold text-[#f0d48f]">
                Will you camp at Stanton?
              </h2>
              <div className="space-y-3">
                {(Object.keys(ACADEMY_CAMPING_LABELS) as AcademyCamping[]).map((c) => (
                  <Choice key={c} label={ACADEMY_CAMPING_LABELS[c]} onClick={() => void submit(c)} />
                ))}
              </div>
            </div>
          )}

          {step === "done" && submitted && (
            <div className="text-center py-4 space-y-4">
              <CheckCircle2 className="w-12 h-12 text-[#d4af37] mx-auto" />
              <h2 id="academy-discount-title" className="font-serif text-2xl font-semibold text-[#f0d48f]">
                Thank you, {submitted.firstName}!
              </h2>
              <p className="text-[#e8e0d5]/85 leading-relaxed">
                Your discount application is under review. Watch {submitted.email}. We&apos;ll follow up shortly
                {qualifies ? " with next steps" : ""}.
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
              <Loader2 className="w-4 h-4 animate-spin" /> Submitting…
            </p>
          ) : null}
          {error ? (
            <div className="mt-4 rounded-lg border border-red-500/40 bg-red-950/30 p-3 text-sm text-red-200">{error}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
