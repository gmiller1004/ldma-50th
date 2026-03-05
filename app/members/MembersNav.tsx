"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, LogOut, Map, FileEdit, Tent } from "lucide-react";

export function MembersNav() {
  const router = useRouter();
  const [isLdmaAdmin, setIsLdmaAdmin] = useState(false);
  const [isCaretaker, setIsCaretaker] = useState(false);

  useEffect(() => {
    fetch("/api/members/me")
      .then((res) => res.json())
      .then((data) => {
        setIsLdmaAdmin(data.isLdmaAdmin === true);
        setIsCaretaker(data.isCaretaker === true);
      })
      .catch(() => {
        setIsLdmaAdmin(false);
        setIsCaretaker(false);
      });
  }, []);

  async function handleLogout() {
    await fetch("/api/members/logout", { method: "POST" });
    router.push("/members/login");
    router.refresh();
  }

  return (
    <nav className="flex items-center gap-4 mb-8 text-sm flex-wrap">
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
      <Link
        href="/directory"
        className="flex items-center gap-2 text-[#e8e0d5]/80 hover:text-[#d4af37] transition-colors"
      >
        <Map className="w-4 h-4" />
        Directory
      </Link>
      {isLdmaAdmin && (
        <Link
          href="/admin/blog"
          className="flex items-center gap-2 text-[#e8e0d5]/80 hover:text-[#d4af37] transition-colors"
        >
          <FileEdit className="w-4 h-4" />
          Blog Admin
        </Link>
      )}
      {isCaretaker && (
        <Link
          href="/members/caretaker"
          className="flex items-center gap-2 text-[#e8e0d5]/80 hover:text-[#d4af37] transition-colors"
        >
          <Tent className="w-4 h-4" />
          Caretaker Portal
        </Link>
      )}
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
