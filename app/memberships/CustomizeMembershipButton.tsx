"use client";

import { useState } from "react";
import { trackMembershipQuizOpen } from "@/lib/analytics";
import {
  MEMBERSHIP_METRICS,
  trackMembershipMetricOnsite,
} from "@/lib/klaviyo-membership-browser";
import { MembershipCustomizationModal } from "./MembershipCustomizationModal";

type CustomizeMembershipButtonProps = {
  variant?: "primary" | "link";
  label?: string;
  className?: string;
  klaviyoSource?: string;
};

export function CustomizeMembershipButton({
  variant = "primary",
  label = "Customize Your Membership",
  className = "",
  klaviyoSource,
}: CustomizeMembershipButtonProps) {
  const [showModal, setShowModal] = useState(false);

  const openModal = () => {
    setShowModal(true);
    trackMembershipQuizOpen();
    if (klaviyoSource) {
      trackMembershipMetricOnsite(MEMBERSHIP_METRICS.bundleInterest, {
        source: klaviyoSource,
        bundle_interest: false,
        customization_quiz_open: true,
      });
    }
  };

  const buttonClassName =
    variant === "link"
      ? "text-[#f0d48f] font-semibold hover:text-[#d4af37] underline underline-offset-4 decoration-[#d4af37]/50 hover:decoration-[#d4af37] transition-colors"
      : "inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-all shadow-[0_0_20px_rgba(212,175,55,0.25)] hover:shadow-[0_0_30px_rgba(212,175,55,0.35)]";

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={`${buttonClassName} ${className}`.trim()}
      >
        {label}
      </button>
      <MembershipCustomizationModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}
