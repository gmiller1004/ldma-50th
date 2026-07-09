import { Suspense } from "react";
import { ReservationPayContent } from "./ReservationPayContent";

export const metadata = {
  title: "Pay Campsite Balance | LDMA",
  robots: { index: false, follow: false },
};

export default function ReservationPayPage() {
  return (
    <Suspense fallback={null}>
      <ReservationPayContent />
    </Suspense>
  );
}
