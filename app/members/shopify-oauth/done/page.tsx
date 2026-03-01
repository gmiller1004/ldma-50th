"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

const MESSAGE_TYPE = "shopify-oauth-complete";

function DoneContent() {
  const searchParams = useSearchParams();
  const success = searchParams.get("success") === "1";
  const error = searchParams.get("error");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const msg = success
      ? { type: MESSAGE_TYPE, success: true }
      : { type: MESSAGE_TYPE, success: false, error: error || "Unknown error" };
    const target = window.opener ?? (window.parent !== window ? window.parent : null);
    if (target) target.postMessage(msg, window.location.origin);
  }, [success, error]);

  return (
    <div className="min-h-[200px] flex flex-col items-center justify-center p-8 bg-[#1a120b] text-[#e8e0d5]">
      {success ? (
        <>
          <p className="text-lg font-medium text-[#d4af37]">Connected successfully!</p>
          <p className="text-sm text-[#e8e0d5]/70 mt-2">You can close this window.</p>
        </>
      ) : (
        <>
          <p className="text-lg font-medium text-red-400">Connection failed</p>
          {error && (
            <p className="text-sm text-[#e8e0d5]/70 mt-2 max-w-md text-center">
              {decodeURIComponent(error)}
            </p>
          )}
          <p className="text-sm text-[#e8e0d5]/50 mt-4">You can close this window and try again.</p>
        </>
      )}
    </div>
  );
}

export default function ShopifyOAuthDonePage() {
  return (
    <Suspense fallback={<div className="min-h-[200px] flex items-center justify-center bg-[#1a120b] text-[#e8e0d5]/60">Loading…</div>}>
      <DoneContent />
    </Suspense>
  );
}
