"use client";

import { useState } from "react";
import { MembershipCustomizationModal } from "./MembershipCustomizationModal";

export function CustomizeMembershipButton() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-all shadow-[0_0_20px_rgba(212,175,55,0.25)] hover:shadow-[0_0_30px_rgba(212,175,55,0.35)]"
      >
        Customize Your Membership
      </button>
      <MembershipCustomizationModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}
