import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Phone, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Build Your Family Legacy | LDMA",
  description:
    "Pass your LDMA membership to family with Companion, Transferability, and pre-paid transfer options. Sign in to your member account or call 888-465-3717.",
  openGraph: {
    title: "Build Your Family Legacy | LDMA",
    description:
      "Learn how Companion, Transferability, and pre-paid transfer fees help keep the tradition going for the next generation.",
  },
};

export default function FamilyLegacyLandingPage() {
  return (
    <div className="min-h-screen bg-[#1a120b] text-[#e8e0d5]">
      <header className="border-b border-[#d4af37]/20 bg-[#0f0a06]/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-center sm:justify-start">
          <Link
            href="/"
            className="inline-flex items-center gap-2 opacity-90 hover:opacity-100 transition-opacity"
          >
            <Image
              src="/images/global/50th-logo.png"
              alt="LDMA — Home"
              width={120}
              height={48}
              className="h-9 w-auto object-contain"
              unoptimized
            />
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 sm:py-14 space-y-10">
        <section className="rounded-xl bg-[#0f3d1e]/40 border border-[#d4af37]/30 overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
          <div className="p-6 sm:p-8">
            <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#f0d48f] flex items-center gap-2 mb-4">
              <Sparkles className="w-7 h-7 text-[#d4af37] shrink-0" />
              Build Your Family Legacy
            </h1>
            <p className="text-[#e8e0d5]/90 text-sm sm:text-base leading-relaxed mb-4">
              Pass your LDMA membership on to a spouse, child, parent, or
              grandparent so they can prospect and visit camps on their own.
              With transferability, your membership outlives you—and the legacy
              keeps going for the next generation.
            </p>
            <p className="text-[#e8e0d5]/90 text-sm sm:text-base leading-relaxed">
              We can also prepay the transfer fee so your heir receives the
              membership without paying it. You cover it now; they get the
              benefit later.
            </p>
          </div>
        </section>

        <section className="rounded-xl bg-[#1a120b] border border-[#d4af37]/25 p-6 sm:p-8 space-y-8">
          <h2 className="font-serif text-xl font-semibold text-[#f0d48f]">
            Add-Ons Explained
          </h2>
          <p className="text-[#e8e0d5]/90 text-sm sm:text-base">
            Three add-ons help you pass your LDMA membership on to family and
            keep the tradition going.
          </p>

          <div className="space-y-8">
            <div>
              <h3 className="font-semibold text-[#f0d48f] mb-2">
                Companion Add-On
              </h3>
              <p className="text-[#e8e0d5]/90 text-sm sm:text-base leading-relaxed">
                Lets a spouse, child over 18, parent, or grandparent prospect on
                LDMA claims and visit camps on their own—without you being there.
                They get their own membership privileges and can camp, prospect,
                and participate in events independently. Perfect for family
                members who want full access even when you&apos;re not around.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-[#f0d48f] mb-2">
                Transferability Add-On
              </h3>
              <p className="text-[#e8e0d5]/90 text-sm sm:text-base leading-relaxed">
                Lets you transfer your membership to a chosen heir when the time
                comes. Without transferability, your membership ends with you.
                With it, you designate who receives your membership—spouse,
                child, grandchild, or another family member—so they can continue
                prospecting and camping with LDMA. Transferability protects your
                investment and keeps the tradition alive in your family.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-[#f0d48f] mb-2">
                Pre-Paid Transfer Fee
              </h3>
              <p className="text-[#e8e0d5]/90 text-sm sm:text-base leading-relaxed">
                When a membership is transferred, the person receiving it
                typically pays a transfer fee. Pre-paying this fee means you
                cover it now, so your heir receives the membership with no fee
                when the time comes. It reduces the burden on them and makes it
                easier for the next generation to step into LDMA.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl bg-[#0f3d1e]/35 border border-[#d4af37]/30 p-6 sm:p-8">
          <h2 className="font-serif text-lg font-semibold text-[#f0d48f] mb-3">
            Next steps
          </h2>
          <p className="text-[#e8e0d5]/85 text-sm sm:text-base leading-relaxed mb-6">
            To review options that apply to your membership, sign in to your
            member account or call LDMA and we&apos;ll help you one-on-one.
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4">
            <Link
              href="/members/login"
              className="inline-flex items-center justify-center px-6 py-3 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors text-center"
            >
              Log in to member account
            </Link>
            <a
              href="tel:8884653717"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-[#d4af37]/45 text-[#d4af37] font-medium rounded-lg hover:bg-[#d4af37]/10 transition-colors"
            >
              <Phone className="w-4 h-4 shrink-0" />
              Call (888) 465-3717
            </a>
          </div>
        </section>

        <p className="text-center text-xs text-[#e8e0d5]/40 pb-8">
          <Link href="/" className="underline hover:text-[#d4af37]/80">
            LDMA 50th Anniversary
          </Link>
        </p>
      </main>
    </div>
  );
}
