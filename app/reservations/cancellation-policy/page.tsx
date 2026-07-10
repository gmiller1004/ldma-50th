import type { Metadata } from "next";
import Link from "next/link";
import { getCampCancellationPolicyContent } from "@/lib/camp-cancellation-policy";

export const metadata: Metadata = {
  title: "Campsite Reservation Cancellation Policy | LDMA",
  description:
    "Cancellation and refund terms for LDMA campsite reservations booked online or through camp staff.",
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default function CampCancellationPolicyPage() {
  const policy = getCampCancellationPolicyContent();

  return (
    <main className="min-h-screen bg-[#1a120b] text-[#e8e0d5]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        <p className="text-xs uppercase tracking-wider text-[#d4af37]/80 mb-3">LDMA campsite reservations</p>
        <h1 className="font-serif text-3xl md:text-4xl font-semibold text-[#f0d48f] mb-3">
          Cancellation &amp; refund policy
        </h1>
        <p className="text-sm text-[#e8e0d5]/55 mb-10">Last updated: {policy.lastUpdated}</p>

        <div className="space-y-8 text-[15px] leading-relaxed text-[#e8e0d5]/90">
          <section className="rounded-xl border border-[#d4af37]/25 bg-[#2a1f14]/60 p-5">
            <p>
              By completing a campsite reservation and payment with LDMA, you agree to this cancellation and
              refund policy. Refunds apply to <strong className="text-[#f0d48f]">campsite fees only</strong>{" "}
              (not membership dues or other purchases). Refunds are calculated from site-fee payments recorded
              on your reservation and will not exceed the amount paid minus any prior refunds.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-[#f0d48f] text-lg mb-3">How to cancel</h2>
            <p>
              To change or cancel a reservation, contact the camp caretaker or Member Relations at{" "}
              <a href="mailto:info@lostdutchmans.com" className="text-[#d4af37] hover:text-[#f0d48f] underline">
                info@lostdutchmans.com
              </a>{" "}
              or{" "}
              <a href="tel:+18884653717" className="text-[#d4af37] hover:text-[#f0d48f] underline">
                (888) 465-3717
              </a>
              . Cancellations are effective when confirmed by LDMA or camp staff. Self-service refunds are not
              available; LDMA applies this policy when processing your cancellation.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-[#f0d48f] text-lg mb-3">Refund schedule</h2>
            <div className="overflow-x-auto rounded-lg border border-[#d4af37]/20">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#0f0a06]/80 text-left text-[#f0d48f]">
                    <th className="px-4 py-3 font-medium">When you cancel</th>
                    <th className="px-4 py-3 font-medium">Refund of site fees paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#d4af37]/15">
                  <tr>
                    <td className="px-4 py-3 align-top">
                      <strong>{policy.fullRefundDaysBeforeCheckIn} or more days before</strong> scheduled check-in
                    </td>
                    <td className="px-4 py-3 align-top">
                      <strong className="text-[#f0d48f]">Full refund</strong> of campsite fees paid to date
                      (card refunds via Stripe; cash payments recorded as manual refunds).
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 align-top">
                      <strong>Less than {policy.fullRefundDaysBeforeCheckIn} days before</strong> check-in, or{" "}
                      <strong>during your stay</strong>, for a <strong>daily-priced</strong> reservation
                      <span className="block mt-1 text-[#e8e0d5]/60 text-xs">
                        Guest stays (any length) and member stays of {policy.memberDailyMaxNights} nights or fewer
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      Refund of the <strong>remaining balance</strong> after any nights already earned at the
                      applicable daily rate, minus a{" "}
                      <strong className="text-[#f0d48f]">{policy.dailyCancellationFee}</strong> cancellation fee.
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 align-top">
                      <strong>Less than {policy.fullRefundDaysBeforeCheckIn} days before</strong> check-in, or{" "}
                      <strong>during your stay</strong>, for a <strong>monthly-priced member</strong> reservation
                      <span className="block mt-1 text-[#e8e0d5]/60 text-xs">
                        Member stays longer than {policy.memberDailyMaxNights} nights (billed in 30-day periods)
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      Refund of the <strong>remaining balance</strong> after earned nights (nights stayed × your
                      member daily rate), minus a cancellation fee of{" "}
                      <strong className="text-[#f0d48f]">{policy.hookupMonthlyCancellationFee}</strong> for hookup
                      sites or <strong className="text-[#f0d48f]">{policy.dryMonthlyCancellationFee}</strong> for dry
                      sites. Hookup vs. dry is determined by your assigned site type.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="font-semibold text-[#f0d48f] text-lg mb-3">Deposits, balances &amp; billing periods</h2>
            <ul className="list-disc pl-5 space-y-2 text-[#e8e0d5]/85">
              <li>
                If you paid a deposit or partial payment, refunds are based on <strong>total site fees paid</strong>{" "}
                on the reservation, not the full stay total unless that amount was collected.
              </li>
              <li>
                Long member stays may be billed in rolling 30-day periods. Future periods that have not been paid
                are not charged upon cancellation.
              </li>
              <li>
                Card payments are refunded to the original payment method when possible. Processing times depend on
                your card issuer.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-[#f0d48f] text-lg mb-3">Site assignment</h2>
            <p>
              Online bookings reserve a <strong>site type</strong> (for example, full hookup or dry camping). LDMA
              assigns a specific site number before your confirmation is sent. Your assigned site type determines
              hookup vs. dry for monthly-stay cancellation fees.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-[#f0d48f] text-lg mb-3">No-shows &amp; early departures</h2>
            <p>
              Failure to check in on your scheduled arrival date without cancelling is treated as a cancellation
              during the stay for refund purposes. Departing before your scheduled check-out date is a mid-stay
              cancellation; earned nights through your departure date apply.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-[#f0d48f] text-lg mb-3">Disputes</h2>
            <p>
              If you have questions about a refund amount, contact Member Relations before disputing a charge with
              your bank. Chargebacks opened after LDMA has applied this policy may be contested with documentation
              of your reservation, payments, and cancellation date.
            </p>
          </section>

          <p className="text-sm text-[#e8e0d5]/50 pt-4 border-t border-[#d4af37]/15">
            LDMA may update this policy from time to time. The version in effect at the time of your booking
            applies to your reservation.
          </p>
        </div>

        <p className="mt-10 text-center">
          <Link href="/" className="text-sm text-[#d4af37] hover:text-[#f0d48f] underline">
            Return to myldma.com
          </Link>
        </p>
      </div>
    </main>
  );
}
