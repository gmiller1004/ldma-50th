"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Pickaxe, Menu, X, ShoppingBag } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/context/CartContext";

function NavbarLogo() {
  const [logoError, setLogoError] = useState(false);

  if (logoError) {
    return (
      <>
        <Pickaxe className="w-7 h-7 md:w-8 md:h-8" strokeWidth={1.5} />
        <span className="font-serif text-xl md:text-2xl font-semibold tracking-wide">
          LDMA
        </span>
      </>
    );
  }

  return (
    <div className="relative h-8 w-auto md:h-10 drop-shadow-[0_0_8px_rgba(212,175,55,0.25)] group-hover:drop-shadow-[0_0_12px_rgba(212,175,55,0.4)] transition-all">
      <Image
        src="/images/global/50th-logo.png"
        alt="LDMA 50th Anniversary"
        width={120}
        height={48}
        className="h-8 w-auto md:h-10 object-contain object-left"
        unoptimized
        onError={() => setLogoError(true)}
      />
    </div>
  );
}

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/campgrounds", label: "Campgrounds" },
  { href: "/events", label: "Events 2026" },
  { href: "/memberships", label: "Memberships" },
  { href: "/members", label: "Members" },
  { href: "/shop", label: "Shop" },
  { href: "/50-years", label: "50 Years" },
];

function CartButton() {
  const { count, openDrawer } = useCart();
  return (
    <button
      onClick={openDrawer}
      className="relative p-2 text-[#e8e0d5]/90 hover:text-[#d4af37] transition-colors"
      aria-label="Open cart"
    >
      <ShoppingBag className="w-5 h-5" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold bg-[#d4af37] text-[#1a120b] rounded-full">
          {count}
        </span>
      )}
    </button>
  );
}

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#1a120b]/95 backdrop-blur-md border-b border-[#d4af37]/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          <Link
            href="/"
            className="flex items-center gap-2 text-[#f0d48f] hover:text-[#d4af37] transition-colors group"
          >
            <NavbarLogo />
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[#e8e0d5]/90 hover:text-[#d4af37] text-sm font-medium transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <CartButton />
            <Link
              href="/memberships"
              className="px-5 py-2.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors"
            >
              Join Now
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden items-center gap-3">
            <CartButton />
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 text-[#e8e0d5]/90 hover:text-[#d4af37]"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-[#1a120b] border-t border-[#d4af37]/20 overflow-hidden"
          >
            <div className="px-4 py-4 space-y-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="block py-3 text-[#e8e0d5]/90 hover:text-[#d4af37] font-medium"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/memberships"
                onClick={() => setMobileOpen(false)}
                className="block mt-4 py-3 text-center bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg"
              >
                Join Now
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
