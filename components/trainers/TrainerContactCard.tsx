import { Globe, Mail, Phone } from "lucide-react";
import type { TrainerContact } from "@/lib/trainers-types";
import { focusRing, nonEmpty } from "./format";

type ContactItem = {
  key: string;
  href: string;
  label: string;
  icon: typeof Mail;
  external?: boolean;
};

function emailHref(email: string): string | null {
  const trimmed = email.trim();
  if (!/^[^\s<>"']+@[^\s<>"']+\.[^\s<>"']+$/.test(trimmed)) return null;
  return `mailto:${trimmed}`;
}

function phoneHref(phone: string): string | null {
  const trimmed = phone.trim();
  const digitCount = trimmed.replace(/\D/g, "").length;
  if (digitCount < 7) return null;
  const digits = trimmed.replace(/[^\d+]/g, "");
  const normalized = digits.startsWith("+")
    ? `+${digits.slice(1).replace(/\+/g, "")}`
    : digits.replace(/\+/g, "");
  return `tel:${normalized}`;
}

function websiteHref(value: string): { href: string; label: string } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const host = url.hostname.replace(/^www\./, "");
    const path = `${url.pathname === "/" ? "" : url.pathname}${url.search}`;
    return { href: url.toString(), label: `${host}${path}` || url.hostname };
  } catch {
    return null;
  }
}

export function contactItems(contact: TrainerContact): ContactItem[] {
  const items: ContactItem[] = [];
  const email = nonEmpty(contact.email);
  const phone = nonEmpty(contact.phone);
  const website = nonEmpty(contact.websiteUrl);

  if (email) {
    const href = emailHref(email);
    if (href) items.push({ key: "email", href, label: email, icon: Mail });
  }
  if (phone) {
    const href = phoneHref(phone);
    if (href) items.push({ key: "phone", href, label: phone, icon: Phone });
  }
  if (website) {
    const link = websiteHref(website);
    if (link) items.push({ key: "website", href: link.href, label: link.label, icon: Globe, external: true });
  }
  return items;
}

export function hasTrainerContact(contact: TrainerContact): boolean {
  return contactItems(contact).length > 0;
}

export function TrainerContactCard({ contact }: { contact: TrainerContact }) {
  const items = contactItems(contact);
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="trainer-contact" className="rounded-2xl border border-[#d4af37]/25 bg-[#0f0a06]/70 p-5">
      <h2 id="trainer-contact" className="font-serif text-2xl font-semibold text-[#f0d48f]">
        Contact
      </h2>
      <ul className="mt-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.key}>
              <a
                href={item.href}
                className={`flex min-h-11 items-center gap-3 rounded-lg px-1 py-1.5 text-[#e8e0d5] transition-colors hover:text-[#f0d48f] ${focusRing}`}
                {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                <Icon className="h-5 w-5 shrink-0 text-[#d4af37]" aria-hidden />
                <span className="min-w-0 break-all text-sm leading-snug">
                  {item.label}
                  {item.external ? <span className="sr-only"> (opens in a new tab)</span> : null}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
