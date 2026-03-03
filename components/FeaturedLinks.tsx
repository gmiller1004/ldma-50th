import Link from "next/link";
import { Users, Calendar, ShoppingBag, Tent, Sparkles } from "lucide-react";

const LINKS = [
  { href: "/memberships", label: "Memberships", icon: Users },
  { href: "/events", label: "Events 2026", icon: Calendar },
  { href: "/shop", label: "Shop", icon: ShoppingBag },
  { href: "/campgrounds", label: "Campgrounds", icon: Tent },
  { href: "/50-years", label: "50 Years", icon: Sparkles },
];

export function FeaturedLinks({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-xl bg-[#0f3d1e]/30 border border-[#d4af37]/20 p-6 ${className}`}>
      <h3 className="font-serif text-lg font-semibold text-[#f0d48f] mb-4">
        Explore LDMA
      </h3>
      <ul className="space-y-3">
        {LINKS.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex items-center gap-3 text-[#e8e0d5]/90 hover:text-[#d4af37] transition-colors"
            >
              <Icon className="w-4 h-4 text-[#d4af37]/80 shrink-0" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
