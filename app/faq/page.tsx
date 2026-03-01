import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import Link from "next/link";

export const metadata: Metadata = {
  title: "FAQ | LDMA Gold Prospecting & Camping Club | Lost Dutchman's Mining Association",
  description:
    "Frequently asked questions about LDMA membership, gold prospecting, private campgrounds, mining claims, and how to join the Lost Dutchman's Mining Association.",
  openGraph: {
    title: "LDMA FAQ | Gold Prospecting, Membership & Campgrounds",
    description:
      "Common questions about LDMA membership, campgrounds, gold mining, and more. Find answers about the Lost Dutchman's Mining Association.",
  },
};

const faqs = [
  {
    q: "What is the Lost Dutchman's Mining Association?",
    a: "The LDMA is a gold mining and camping club established in 1976. We offer exclusive access to 12 private campgrounds and 30+ mining claims across eight states. Members can prospect for gold, camp with their families, and enjoy activities like metal detecting, fishing, and ATV adventures. With over 6,500 members, LDMA is one of America's largest and longest-running prospecting organizations.",
  },
  {
    q: "Are LDMA campgrounds private?",
    a: "Yes. LDMA campgrounds are reserved for member use only, with a few open house mining events throughout the year where non-members can visit. Members can stay at each property for up to six months at a time during the campground's open season.",
  },
  {
    q: "Can I bring friends and family to LDMA campgrounds?",
    a: "Absolutely. Your friends and family are welcome to accompany you as long as they are staying with you in your rig. Mining on LDMA claims is exclusive to members only, but guests can help you work through your concentrates back at your campsite.",
  },
  {
    q: "How do I become an LDMA member?",
    a: "We offer Lifetime membership — currently on sale for $2,000 (regularly $3,750) with unbeatable add-ons during our 50th Anniversary Celebration. Visit our Memberships page or call (888) 465-3717 for details.",
  },
  {
    q: "Where can I dig for gold?",
    a: "All LDMA campgrounds are on or near gold-bearing land. Some offer mining access within walking distance of your campsite; others have private claim access a short drive away. Check our Campgrounds and Directory pages for specific details on each property.",
  },
  {
    q: "Do you offer activities besides gold mining?",
    a: "Yes. Whether you are into fishing, hiking, ATV and off-roading, treasure hunting, rock and gem collecting, or gold prospecting — or all of the above — LDMA membership has you covered. We also host co-sponsored events with MineLab and Garrett, plus educational programs.",
  },
  {
    q: "Are all LDMA campgrounds developed?",
    a: "Nine of our 12 campgrounds are developed with caretakers on site. Five of those offer RV hookups (full or partial). We have three primitive campgrounds in Northern California, Nevada, and Colorado for members who prefer a more rugged experience.",
  },
  {
    q: "How much does camping cost?",
    a: "Member rates are very affordable: dry camping starts at around $5/night, and full RV hookups run about $12/night. Exact rates vary by campground.",
  },
  {
    q: "Do I keep the gold I find?",
    a: "Yes. Members keep 100% of any gold or minerals they find on LDMA claims. That is one of the perks of membership — the land is yours to prospect as a member.",
  },
  {
    q: "What is the 50th anniversary celebration?",
    a: "2026 marks LDMA's 50th anniversary. We are celebrating five decades of gold, grit, and brotherhood with special events, merchandise, and commemorative experiences. This site is part of that celebration.",
  },
];

export default function FAQPage() {
  return (
    <>
      <Navbar />
      <main className="pt-16 md:pt-20 min-h-screen bg-[#1a120b]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 md:py-24">
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-[#f0d48f] text-center mb-4">
            Frequently Asked Questions
          </h1>
          <p className="text-center text-[#e8e0d5]/80 text-lg mb-16">
            Everything you need to know about LDMA membership, gold prospecting,
            and our private campgrounds.
          </p>

          <div className="space-y-6">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="p-6 rounded-xl bg-[#0f3d1e]/30 border border-[#d4af37]/20"
              >
                <h2 className="font-serif text-lg font-semibold text-[#f0d48f] mb-3">
                  {faq.q}
                </h2>
                <p className="text-[#e8e0d5]/90 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>

          <div className="mt-16 text-center space-y-4">
            <p className="text-[#e8e0d5]/70">
              Still have questions? We are here to help.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
