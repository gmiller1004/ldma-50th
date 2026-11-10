import Link from "next/link";
import { GraduationCap } from "lucide-react";
import {
  DETECTOR_ACADEMY_DATES_LABEL,
  DETECTOR_ACADEMY_NAME,
  DETECTOR_ACADEMY_PATH,
  ACADEMY_PROMO_DEADLINE_LABEL,
  isAcademyPromoOpen,
} from "@/lib/detector-academy";

/** "Join with the Axiom Lite bundle, attend the LDMA Detector Academy free." Hidden after the promo window. */
export function DetectorAcademyPromo({ className = "" }: { className?: string }) {
  if (!isAcademyPromoOpen()) return null;
  return (
    <Link
      href={DETECTOR_ACADEMY_PATH}
      className={`group flex items-start gap-3 rounded-xl border border-[#d4af37]/50 bg-[#0f3d1e]/60 p-4 hover:border-[#d4af37] hover:bg-[#0f3d1e]/80 transition-colors ${className}`}
    >
      <GraduationCap className="w-6 h-6 text-[#d4af37] shrink-0 mt-0.5" />
      <span className="text-sm text-[#e8e0d5]/90 leading-relaxed">
        <strong className="text-[#f0d48f]">Bonus: attend the {DETECTOR_ACADEMY_NAME} free.</strong> Join with the Axiom
        Lite bundle by {ACADEMY_PROMO_DEADLINE_LABEL}, and your spot at our four-day Garrett detector training in Stanton,
        AZ ({DETECTOR_ACADEMY_DATES_LABEL.toLowerCase()}) is free, a $400 value. Reserve it with a $100 deposit that comes
        back as camp credit when you attend.{" "}
        <span className="text-[#d4af37] underline underline-offset-4 group-hover:text-[#f0d48f]">See the academy</span>
      </span>
    </Link>
  );
}
