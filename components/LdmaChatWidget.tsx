"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, MessageSquare, Send, X } from "lucide-react";
import { trackNewsletterSignup } from "@/lib/analytics";

const STORAGE_KEY = "ldma_site_chat_v1";
const STALE_MS = 10 * 60 * 1000;
const STALE_CHECK_MS = 45_000;

export type ChatMessage = { role: "user" | "assistant"; content: string };

const WELCOME: ChatMessage = {
  role: "assistant",
  content: `Welcome! I'm your LDMA Assistant — here to help with camps, DirtFest events, memberships, and the myldma.com site.

What are you looking for today?

If you'd like a written copy of our conversation for your records, add your email above — it makes it easy to pick up where you left off.`,
};

function loadPersisted(): {
  messages: ChatMessage[];
  visitorEmail: string;
} {
  if (typeof window === "undefined") {
    return { messages: [WELCOME], visitorEmail: "" };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { messages: [WELCOME], visitorEmail: "" };
    const p = JSON.parse(raw) as {
      messages?: ChatMessage[];
      visitorEmail?: string;
    };
    const messages =
      Array.isArray(p.messages) && p.messages.length > 0
        ? p.messages.filter(
            (m) =>
              m &&
              (m.role === "user" || m.role === "assistant") &&
              typeof m.content === "string"
          )
        : [WELCOME];
    return {
      messages,
      visitorEmail: typeof p.visitorEmail === "string" ? p.visitorEmail : "",
    };
  } catch {
    return { messages: [WELCOME], visitorEmail: "" };
  }
}

function savePersisted(messages: ChatMessage[], visitorEmail: string) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ messages, visitorEmail })
    );
  } catch {
    /* ignore quota */
  }
}

export function LdmaChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [visitorEmail, setVisitorEmail] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finalizeBusy, setFinalizeBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const lastActivityRef = useRef(Date.now());
  const finalizeBusyRef = useRef(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const touchActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  useEffect(() => {
    const { messages: m, visitorEmail: e } = loadPersisted();
    setMessages(m);
    setVisitorEmail(e);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    savePersisted(messages, visitorEmail);
  }, [messages, visitorEmail, hydrated]);

  useEffect(() => {
    if (!open) return;
    touchActivity();
  }, [open, touchActivity]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    visitorEmail.trim()
  );

  const runFinalize = useCallback(
    async (source: "end" | "stale") => {
      if (finalizeBusyRef.current) return;
      const msgs = messagesRef.current;
      if (!emailLooksValid) return;
      if (msgs.length < 2) return;

      finalizeBusyRef.current = true;
      setFinalizeBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/chat/finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: visitorEmail.trim(),
            messages: msgs,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          success?: boolean;
        };
        if (!res.ok || !data.success) {
          setError(data.error || "Could not send your copy.");
          return;
        }
        trackNewsletterSignup("chat");
        setMessages([WELCOME]);
        savePersisted([WELCOME], visitorEmail.trim());
        if (source === "stale") {
          setOpen(false);
        }
      } catch {
        setError("Something went wrong. Please try again.");
      } finally {
        finalizeBusyRef.current = false;
        setFinalizeBusy(false);
      }
    },
    [emailLooksValid, visitorEmail]
  );

  useEffect(() => {
    if (!hydrated || !open) return;
    const id = window.setInterval(() => {
      if (!emailLooksValid || messages.length < 2) return;
      if (Date.now() - lastActivityRef.current < STALE_MS) return;
      runFinalize("stale");
    }, STALE_CHECK_MS);
    return () => window.clearInterval(id);
  }, [hydrated, open, emailLooksValid, messages.length, runFinalize]);

  async function sendUserMessage() {
    const text = input.trim();
    if (!text || loading) return;
    touchActivity();
    setInput("");
    setError(null);
    const userMsg: ChatMessage = { role: "user", content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok || !data.message) {
        setError(data.error || "Could not get a reply. Please try again.");
        setMessages((prev) => prev.slice(0, -1));
        return;
      }
      touchActivity();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.message! },
      ]);
    } catch {
      setError("Network error. Please try again.");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  async function handleEndChat() {
    if (emailLooksValid && messages.length >= 2) {
      await runFinalize("end");
    }
    setOpen(false);
  }

  if (!hydrated) return null;

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.button
            type="button"
            aria-label="Close chat"
            className="fixed inset-0 z-[98] bg-black/50 sm:bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-end justify-center sm:items-end sm:justify-end pointer-events-none p-0 sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="pointer-events-auto w-full sm:w-[400px] max-h-[min(92vh,640px)] flex flex-col rounded-t-2xl sm:rounded-2xl border border-[#d4af37]/35 bg-[#1a120b] shadow-[0_-8px_40px_rgba(0,0,0,0.5)] sm:shadow-[0_0_40px_rgba(212,175,55,0.15)] overflow-hidden"
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
            >
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[#d4af37]/20 bg-[#0f3d1e]/25">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#d4af37]/15 text-[#d4af37] shrink-0">
                    <MessageSquare className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="font-serif font-semibold text-[#f0d48f] text-sm truncate">
                      LDMA Assistant
                    </p>
                    <p className="text-[10px] text-[#e8e0d5]/50 uppercase tracking-wider">
                      50th Anniversary
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={handleEndChat}
                    className="text-xs px-2 py-1.5 rounded-lg text-[#d4af37]/90 hover:bg-[#d4af37]/10"
                  >
                    End chat
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="p-2 rounded-lg text-[#e8e0d5]/70 hover:bg-[#d4af37]/10"
                    aria-label="Close chat"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="px-4 pt-3 pb-2 border-b border-[#d4af37]/10">
                <label
                  htmlFor="ldma-chat-email"
                  className="block text-xs font-medium text-[#d4af37]/80 mb-1.5"
                >
                  Email me a copy of this chat
                </label>
                <input
                  id="ldma-chat-email"
                  type="email"
                  value={visitorEmail}
                  onChange={(e) => {
                    setVisitorEmail(e.target.value);
                    touchActivity();
                  }}
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="w-full px-3 py-2 rounded-lg bg-[#0f0a06]/90 border border-[#d4af37]/25 text-sm text-[#e8e0d5] placeholder-[#e8e0d5]/40 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/40"
                />
                <p className="text-[11px] text-[#e8e0d5]/45 mt-1.5 leading-snug">
                  Optional — handy if you want to revisit answers later or share
                  with family.
                </p>
              </div>

              <div
                ref={listRef}
                className="flex-1 min-h-[200px] max-h-[38vh] sm:max-h-[320px] overflow-y-auto px-4 py-3 space-y-3"
              >
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`rounded-xl px-3 py-2.5 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "ml-6 bg-[#2a1f14] border border-[#d4af37]/20 text-[#e8e0d5]"
                        : "mr-4 bg-[#0f3d1e]/20 border border-[#d4af37]/15 text-[#e8e0d5]/95 whitespace-pre-wrap"
                    }`}
                  >
                    {m.content}
                  </div>
                ))}
                {loading && (
                  <div className="flex items-center gap-2 text-[#d4af37]/70 text-sm px-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Thinking…
                  </div>
                )}
              </div>

              {error && (
                <p className="px-4 text-xs text-amber-400/90">{error}</p>
              )}

              <form
                className="p-3 border-t border-[#d4af37]/15 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendUserMessage();
                }}
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about camps, events, memberships…"
                  disabled={loading}
                  className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-[#0f0a06]/90 border border-[#d4af37]/25 text-sm text-[#e8e0d5] placeholder-[#e8e0d5]/35 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/40 disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="shrink-0 px-4 py-2.5 rounded-xl bg-[#d4af37] text-[#1a120b] font-semibold hover:bg-[#f0d48f] disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  <span className="hidden xs:inline">Send</span>
                </button>
              </form>
              {finalizeBusy && (
                <p className="px-4 pb-2 text-[11px] text-[#d4af37]/70">
                  Sending your copy…
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Launcher only when closed — when open, a fixed z-[101] button overlaps the footer Send control */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-[101] flex h-14 w-14 items-center justify-center rounded-full border border-[#d4af37]/40 bg-[#1a120b] text-[#d4af37] shadow-lg hover:bg-[#d4af37]/10 transition-colors"
          aria-label="Open LDMA Assistant"
        >
          <MessageSquare className="h-6 w-6" />
        </button>
      )}
    </>
  );
}
