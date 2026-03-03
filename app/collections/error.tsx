"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export default function CollectionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Collection page error:", error);
  }, [error]);

  return (
    <>
      <Navbar />
      <main className="pt-16 md:pt-20 min-h-screen bg-[#1a120b]">
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <h1 className="font-serif text-2xl font-semibold text-[#f0d48f] mb-3">
            Something went wrong
          </h1>
          <p className="text-[#e8e0d5]/80 mb-6">
            We couldn&apos;t load this collection. Please try again or return to the shop.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              type="button"
              onClick={reset}
              className="px-6 py-3 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors"
            >
              Try again
            </button>
            <Link
              href="/shop"
              className="px-6 py-3 border border-[#d4af37]/40 text-[#e8e0d5] rounded-lg hover:bg-[#d4af37]/10 transition-colors"
            >
              Back to shop
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
