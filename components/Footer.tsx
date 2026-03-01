import Link from "next/link";
import Image from "next/image";

const footerLinks = {
  Explore: [
    { href: "/campgrounds", label: "Campgrounds" },
    { href: "/events", label: "Events 2026" },
    { href: "/memberships", label: "Memberships" },
    { href: "/shop", label: "Shop" },
    { href: "/50-years", label: "50 Years" },
  ],
  Connect: [
    { href: "/contact", label: "Contact" },
    { href: "/about", label: "About Us" },
    { href: "/faq", label: "FAQ" },
    { href: "/privacy", label: "Privacy Policy" },
  ],
};

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#0f3d1e] border-t border-[#d4af37]/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        <div className="grid md:grid-cols-4 gap-8 md:gap-12">
          <div className="md:col-span-1">
            <Link
              href="/"
              className="inline-block hover:opacity-90 transition-opacity"
            >
              <Image
                src="/images/global/LDMA_50_Badge_2-02.png"
                alt="LDMA 50th Anniversary"
                width={120}
                height={60}
                className="h-12 w-auto"
              />
            </Link>
            <p className="mt-4 text-[#e8e0d5]/70 text-sm">
              The Lost Dutchman&apos;s Mining Association — 50 years of gold,
              grit, and brotherhood.
            </p>
          </div>
          <div>
            <h4 className="font-serif font-semibold text-[#f0d48f] mb-4">
              Explore
            </h4>
            <ul className="space-y-2">
              {footerLinks.Explore.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-[#e8e0d5]/80 hover:text-[#d4af37] text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-serif font-semibold text-[#f0d48f] mb-4">
              Connect
            </h4>
            <ul className="space-y-2">
              {footerLinks.Connect.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-[#e8e0d5]/80 hover:text-[#d4af37] text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-serif font-semibold text-[#f0d48f] mb-4">
              Join the Adventure
            </h4>
            <Link
              href="/memberships"
              className="inline-block px-6 py-3 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors"
            >
              Become a Member
            </Link>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-[#d4af37]/20 text-center text-[#e8e0d5]/60 text-sm">
          © {currentYear} Lost Dutchman&apos;s Mining Association. All rights
          reserved.
        </div>
      </div>
    </footer>
  );
}
