"use client";

import { useState, useCallback } from "react";
import { Share2, X, Link2, Mail } from "lucide-react";

function getAbsoluteUrl(path: string): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}${path.startsWith("/") ? path : `/${path}`}`;
  }
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://ldma-50th.vercel.app";
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

type ShareButtonProps = {
  url: string;
  title: string;
  text?: string;
  className?: string;
  /** Optional callback when share card opens/closes */
  onOpenChange?: (open: boolean) => void;
};

const FACEBOOK_SHARE = "https://www.facebook.com/sharer/sharer.php?u=";
const X_SHARE = "https://twitter.com/intent/tweet?";

export function ShareButton({
  url,
  title,
  text = "",
  className = "",
  onOpenChange,
}: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const absoluteUrl = getAbsoluteUrl(url);

  const handleToggle = useCallback(() => {
    const next = !open;
    setOpen(next);
    onOpenChange?.(next);
  }, [open, onOpenChange]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: prompt
      const ok = window.prompt("Copy this link:", absoluteUrl);
      if (ok !== null) setCopied(true);
    }
  }, [absoluteUrl]);

  const handleEmail = useCallback(() => {
    const subject = encodeURIComponent(title);
    const body = encodeURIComponent(`${text ? `${text}\n\n` : ""}${absoluteUrl}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }, [title, text, absoluteUrl]);

  const handleNativeShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: text || title,
          url: absoluteUrl,
        });
        setOpen(false);
      } catch (err) {
        if ((err as Error).name !== "AbortError") console.warn("Share failed:", err);
      }
    }
  }, [title, text, absoluteUrl]);

  const hasNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={handleToggle}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-[#e8e0d5] border border-[#d4af37]/40 rounded-lg hover:bg-[#d4af37]/10 hover:border-[#d4af37]/60 transition-colors"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Share2 className="w-4 h-4" />
        Share
      </button>

      {open && (
        <>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40"
            aria-hidden
          />
          <div
            className="absolute right-0 top-full mt-2 z-50 w-56 bg-[#1a120b] border border-[#d4af37]/30 rounded-xl shadow-xl overflow-hidden"
            role="dialog"
            aria-label="Share options"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#d4af37]/20">
              <span className="font-medium text-[#f0d48f]">Share</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 text-[#e8e0d5]/60 hover:text-[#e8e0d5]"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 space-y-1">
              {hasNativeShare && (
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-[#e8e0d5]/90 hover:bg-[#d4af37]/10 hover:text-[#d4af37] rounded-lg transition-colors"
                >
                  <Share2 className="w-4 h-4 shrink-0" />
                  Share via…
                </button>
              )}
              <a
                href={`${FACEBOOK_SHARE}${encodeURIComponent(absoluteUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#e8e0d5]/90 hover:bg-[#d4af37]/10 hover:text-[#d4af37] rounded-lg transition-colors"
                onClick={() => setOpen(false)}
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
                Facebook
              </a>
              <a
                href={`${X_SHARE}url=${encodeURIComponent(absoluteUrl)}&text=${encodeURIComponent(text || title)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#e8e0d5]/90 hover:bg-[#d4af37]/10 hover:text-[#d4af37] rounded-lg transition-colors"
                onClick={() => setOpen(false)}
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                X (Twitter)
              </a>
              <button
                type="button"
                onClick={handleCopy}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-[#e8e0d5]/90 hover:bg-[#d4af37]/10 hover:text-[#d4af37] rounded-lg transition-colors"
              >
                <Link2 className="w-4 h-4 shrink-0" />
                {copied ? "Copied!" : "Copy link"}
              </button>
              <button
                type="button"
                onClick={handleEmail}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-[#e8e0d5]/90 hover:bg-[#d4af37]/10 hover:text-[#d4af37] rounded-lg transition-colors"
              >
                <Mail className="w-4 h-4 shrink-0" />
                Email
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
