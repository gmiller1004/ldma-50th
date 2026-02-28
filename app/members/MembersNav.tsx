"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, LogOut } from "lucide-react";

export function MembersNav() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/members/logout", { method: "POST" });
    router.push("/members/login");
    router.refresh();
  }

  return (
    <nav className="flex items-center gap-4 mb-8 text-sm">
      <Link
        href="/members"
        className="flex items-center gap-2 text-[#e8e0d5]/80 hover:text-[#d4af37] transition-colors"
      >
        <User className="w-4 h-4" />
        Dashboard
      </Link>
      <Link
        href="/members/profile"
        className="flex items-center gap-2 text-[#e8e0d5]/80 hover:text-[#d4af37] transition-colors"
      >
        Profile
      </Link>
      <button
        type="button"
        onClick={handleLogout}
        className="ml-auto flex items-center gap-2 text-[#e8e0d5]/60 hover:text-red-400 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Sign out
      </button>
    </nav>
  );
}
