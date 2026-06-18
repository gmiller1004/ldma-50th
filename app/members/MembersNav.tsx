"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, LogOut, Map, FileEdit, Tent } from "lucide-react";

export function MembersNav() {
  const router = useRouter();
  const [isLdmaAdmin, setIsLdmaAdmin] = useState(false);
  const [showCaretakerPortal, setShowCaretakerPortal] = useState(false);
  const [caretakerNavLabel, setCaretakerNavLabel] = useState("Caretaker Portal");
  const [adminViewCampName, setAdminViewCampName] = useState<string | null>(null);
  const [exitingDirectorView, setExitingDirectorView] = useState(false);

  useEffect(() => {
    fetch("/api/members/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.resolve(null)))
      .then((data) => {
        if (data && typeof data === "object") {
          setIsLdmaAdmin(data.isLdmaAdmin === true);
          const mode = data.caretakerPortalMode;
          const show = mode === "admin" || mode === "camp";
          setShowCaretakerPortal(show);
          const viewName =
            typeof data.caretakerAdminViewCampName === "string"
              ? data.caretakerAdminViewCampName
              : null;
          setAdminViewCampName(viewName);
          if (viewName) {
            setCaretakerNavLabel(`${viewName} (caretaker view)`);
          } else {
            setCaretakerNavLabel(mode === "admin" ? "Director dashboard" : "Caretaker Portal");
          }
        }
      })
      .catch(() => {
        setIsLdmaAdmin(false);
        setShowCaretakerPortal(false);
        setAdminViewCampName(null);
        setCaretakerNavLabel("Caretaker Portal");
      });
  }, []);

  async function returnToDirectorDashboard() {
    setExitingDirectorView(true);
    try {
      await fetch("/api/members/caretaker/admin/view-camp", { method: "DELETE" });
      router.push("/members/caretaker");
      router.refresh();
    } catch {
      alert("Could not return to director dashboard");
    } finally {
      setExitingDirectorView(false);
    }
  }

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
      {showCaretakerPortal && adminViewCampName ? (
        <>
          <button
            type="button"
            onClick={returnToDirectorDashboard}
            disabled={exitingDirectorView}
            className="flex items-center gap-2 text-[#e8e0d5]/80 hover:text-[#d4af37] transition-colors disabled:opacity-50"
          >
            <Tent className="w-4 h-4" />
            Director dashboard
          </button>
          <span className="text-[#e8e0d5]/45">{caretakerNavLabel}</span>
        </>
      ) : showCaretakerPortal ? (
        <Link
          href="/members/caretaker"
          className="flex items-center gap-2 text-[#e8e0d5]/80 hover:text-[#d4af37] transition-colors"
        >
          <Tent className="w-4 h-4" />
          {caretakerNavLabel}
        </Link>
      ) : null}
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
