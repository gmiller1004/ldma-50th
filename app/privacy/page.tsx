import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy | LDMA 50th Anniversary",
  description:
    "Privacy policy for the Lost Dutchman's Mining Association 50th anniversary website. Learn how we collect, use, and protect your information.",
};

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="pt-16 md:pt-20 min-h-screen bg-[#1a120b]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 md:py-24">
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-[#f0d48f] mb-4">
            Privacy Policy
          </h1>
          <p className="text-[#e8e0d5]/60 text-sm mb-12">
            Last updated: February 2025
          </p>

          <div className="prose prose-invert prose-sm max-w-none space-y-8 text-[#e8e0d5]/90">
            <section>
              <h2 className="font-serif text-xl font-semibold text-[#f0d48f] mb-3">
                Introduction
              </h2>
              <p className="leading-relaxed">
                The Lost Dutchman&apos;s Mining Association (&quot;LDMA,&quot;
                &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates the
                LDMA 50th Anniversary website. This Privacy Policy describes how
                we collect, use, and protect your information when you visit our
                site.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-xl font-semibold text-[#f0d48f] mb-3">
                Information We Collect
              </h2>
              <p className="leading-relaxed mb-4">
                We may collect information that you voluntarily provide when you:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Create an account or sign in as a member</li>
                <li>Subscribe to our newsletter</li>
                <li>Make a purchase or membership payment</li>
                <li>Contact us or submit a form</li>
                <li>Participate in community features (discussions, comments)</li>
              </ul>
              <p className="leading-relaxed mt-4">
                We also automatically collect certain information when you visit,
                such as IP address, browser type, device information, and pages
                visited. We may use cookies and similar technologies to improve
                your experience.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-xl font-semibold text-[#f0d48f] mb-3">
                How We Use Your Information
              </h2>
              <p className="leading-relaxed mb-4">
                We use the information we collect to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide and improve our services</li>
                <li>Process memberships and purchases</li>
                <li>Send newsletters and updates (with your consent)</li>
                <li>Respond to inquiries and support requests</li>
                <li>Analyze site usage and performance</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="font-serif text-xl font-semibold text-[#f0d48f] mb-3">
                Third-Party Services
              </h2>
              <p className="leading-relaxed">
                We use third-party services that may collect or process your
                data, including: Shopify (for shop and membership purchases),
                Vercel (hosting), Neon (database), SendGrid (email), and
                analytics providers. Each has its own privacy policy governing
                their use of your information.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-xl font-semibold text-[#f0d48f] mb-3">
                Data Security
              </h2>
              <p className="leading-relaxed">
                We take reasonable steps to protect your personal information
                from unauthorized access, use, or disclosure. However, no method
                of transmission over the Internet or electronic storage is 100%
                secure.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-xl font-semibold text-[#f0d48f] mb-3">
                Your Rights
              </h2>
              <p className="leading-relaxed">
                Depending on your location, you may have the right to access,
                correct, or delete your personal information, or to opt out of
                marketing communications. Contact us at lostdutchman@myldma.com
                to exercise these rights.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-xl font-semibold text-[#f0d48f] mb-3">
                Children&apos;s Privacy
              </h2>
              <p className="leading-relaxed">
                Our site is not directed to children under 13. We do not
                knowingly collect personal information from children under 13.
                If you believe we have collected such information, please contact
                us.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-xl font-semibold text-[#f0d48f] mb-3">
                Changes
              </h2>
              <p className="leading-relaxed">
                We may update this Privacy Policy from time to time. We will
                notify you of any material changes by posting the new policy on
                this page and updating the &quot;Last updated&quot; date.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-xl font-semibold text-[#f0d48f] mb-3">
                Contact Us
              </h2>
              <p className="leading-relaxed">
                For questions about this Privacy Policy or our data practices,
                contact us at{" "}
                <a
                  href="mailto:lostdutchman@myldma.com"
                  className="text-[#d4af37] hover:text-[#f0d48f] underline"
                >
                  lostdutchman@myldma.com
                </a>{" "}
                or call (888) 465-3717.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
