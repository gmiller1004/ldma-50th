"use client";

import { useState } from "react";
import { campUsesReservations } from "@/lib/reservation-camps";
import { CampReserveModal } from "@/components/CampReserveModal";

export function CampHeroReserveCta({
  campSlug,
  campName,
}: {
  campSlug: string;
  campName: string;
}) {
  const [open, setOpen] = useState(false);

  if (!campUsesReservations(campSlug)) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-6 inline-flex items-center justify-center rounded-lg bg-[#d4af37] px-8 py-3.5 text-sm font-bold uppercase tracking-wider text-[#1a120b] shadow-lg hover:bg-[#f0d48f] transition-colors"
      >
        Reserve Your Campsite
      </button>
      <CampReserveModal
        open={open}
        onClose={() => setOpen(false)}
        campSlug={campSlug}
        campName={campName}
      />
    </>
  );
}
