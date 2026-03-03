"use client";

import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main className="pt-16 md:pt-20 min-h-screen bg-[#1a120b] flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-lg">
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-[#f0d48f] mb-2">
            Page not found
          </h1>
          <p className="text-[#e8e0d5]/80 mb-8">
            The page you&apos;re looking for doesn&apos;t exist or may have been moved.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors"
            >
              <Home className="w-5 h-5" />
              Home
            </Link>
            <button
              type="button"
              onClick={() => typeof window !== "undefined" && window.history.back()}
              className="inline-flex items-center gap-2 px-6 py-3 border border-[#d4af37]/40 text-[#d4af37] font-medium rounded-lg hover:bg-[#d4af37]/10 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Go back
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
