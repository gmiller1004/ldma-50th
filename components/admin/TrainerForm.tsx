"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ExternalLink, X } from "lucide-react";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import type { TrainerDetail } from "@/lib/trainers-types";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

type EventOption = {
  productGid: string;
  title: string;
  handle: string;
};

const fieldClass =
  "w-full px-4 py-2 rounded-lg bg-[#0f3d1e]/50 border border-[#d4af37]/30 text-[#e8e0d5] placeholder:text-[#e8e0d5]/35 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50";

type TrainerFormProps = {
  mode: "create" | "edit";
  trainer?: TrainerDetail | null;
};

export function TrainerForm({ mode, trainer }: TrainerFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(mode === "edit");

  const [name, setName] = useState(trainer?.name ?? "");
  const [slug, setSlug] = useState(trainer?.slug ?? "");
  const [title, setTitle] = useState(trainer?.title ?? "");
  const [summary, setSummary] = useState(trainer?.summary ?? "");
  const [bodyHtml, setBodyHtml] = useState(trainer?.bodyHtml ?? "");
  const [photoUrl, setPhotoUrl] = useState(trainer?.photoUrl ?? "");
  const [contactEmail, setContactEmail] = useState(trainer?.contact.email ?? "");
  const [contactPhone, setContactPhone] = useState(trainer?.contact.phone ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(trainer?.contact.websiteUrl ?? "");
  const [sortOrder, setSortOrder] = useState(String(trainer?.sortOrder ?? 0));
  const [publish, setPublish] = useState(Boolean(trainer?.publishedAt));
  const [eventGids, setEventGids] = useState<string[]>(
    () => trainer?.events.map((event) => event.productGid) ?? []
  );
  const [options, setOptions] = useState<EventOption[]>([]);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [eventQuery, setEventQuery] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/trainers/event-options")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Could not load events");
        return data.events as EventOption[];
      })
      .then((events) => {
        if (!cancelled) setOptions(Array.isArray(events) ? events : []);
      })
      .catch((err: unknown) => {
        if (!cancelled) setOptionsError(err instanceof Error ? err.message : "Could not load events");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const titles = useMemo(() => {
    const map = new Map<string, string>();
    for (const event of trainer?.events ?? []) {
      if (event.title) map.set(event.productGid, event.title);
    }
    for (const option of options) map.set(option.productGid, option.title);
    return map;
  }, [options, trainer?.events]);

  const filteredOptions = options
    .filter((option) => !eventGids.includes(option.productGid))
    .filter((option) => {
      const q = eventQuery.trim().toLowerCase();
      if (!q) return true;
      return option.title.toLowerCase().includes(q) || option.handle.toLowerCase().includes(q);
    })
    .slice(0, 12);

  function handleNameChange(value: string) {
    setName(value);
    if (mode === "create" && !slugTouched) setSlug(slugify(value));
  }

  async function handleImageUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("trainerId", trainer?.id ?? "draft");
      const res = await fetch("/api/admin/trainers/upload", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }
      if (typeof data.url === "string") setPhotoUrl(data.url);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function moveEvent(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= eventGids.length) return;
    const copy = [...eventGids];
    const item = copy[index];
    if (!item) return;
    copy.splice(index, 1);
    copy.splice(next, 0, item);
    setEventGids(copy);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const sort = Number(sortOrder);
      const payload = {
        name: name.trim(),
        slug: slug.trim(),
        title: title.trim() || null,
        summary: summary.trim() || null,
        bodyHtml,
        photoUrl: photoUrl.trim() || null,
        contactEmail: contactEmail.trim() || null,
        contactPhone: contactPhone.trim() || null,
        websiteUrl: websiteUrl.trim() || null,
        sortOrder: Number.isInteger(sort) ? sort : sortOrder,
        publishedAt: publish ? (trainer?.publishedAt ?? new Date().toISOString()) : null,
        eventProductGids: eventGids,
      };

      const res = await fetch(mode === "create" ? "/api/admin/trainers" : `/api/admin/trainers/${trainer?.id}`, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || (mode === "create" ? "Failed to create" : "Failed to update"));
        return;
      }
      router.push("/admin/trainers");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {trainer?.publishedAt ? (
        <Link
          href={`/trainers/${trainer.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-[#d4af37] hover:text-[#f0d48f]"
        >
          <ExternalLink className="w-4 h-4" />
          View public page
        </Link>
      ) : null}

      <div>
        <label htmlFor="trainer-name" className="block text-sm font-medium text-[#e8e0d5]/80 mb-1">
          Name *
        </label>
        <input
          id="trainer-name"
          type="text"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          required
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor="trainer-slug" className="block text-sm font-medium text-[#e8e0d5]/80 mb-1">
          Slug (URL) *
        </label>
        <input
          id="trainer-slug"
          type="text"
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
          required
          className={fieldClass}
        />
        <p className="mt-1 text-xs text-[#e8e0d5]/50">Public page: /trainers/{slug || "slug"}</p>
      </div>

      <div>
        <label htmlFor="trainer-title" className="block text-sm font-medium text-[#e8e0d5]/80 mb-1">
          Title
        </label>
        <input
          id="trainer-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Former caretaker · Stanton operations"
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor="trainer-summary" className="block text-sm font-medium text-[#e8e0d5]/80 mb-1">
          Summary
        </label>
        <textarea
          id="trainer-summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={3}
          className={fieldClass}
        />
        <p className="mt-1 text-xs text-[#e8e0d5]/50">One or two sentences for the directory card.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-[#e8e0d5]/80 mb-1">Photo</label>
        <div className="flex flex-wrap items-start gap-4">
          {photoUrl ? (
            <div className="relative">
              {/* Admin preview of an uploaded or site image URL. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl}
                alt=""
                className="h-24 w-24 rounded-lg object-cover border border-[#d4af37]/30"
              />
              <button
                type="button"
                onClick={() => setPhotoUrl("")}
                className="absolute -right-2 -top-2 rounded-full bg-[#1a120b] border border-[#d4af37]/40 p-1 text-[#e8e0d5] hover:text-red-400"
                aria-label="Remove photo"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
          <div className="flex-1 min-w-[220px] space-y-2">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleImageUpload}
              disabled={uploading}
              aria-label="Upload trainer photo"
              className="text-sm text-[#e8e0d5]/80 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-[#d4af37] file:text-[#1a120b] file:font-medium"
            />
            <input
              type="text"
              inputMode="url"
              placeholder="Or paste image URL"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              aria-label="Photo URL"
              className={fieldClass}
            />
            {uploading ? <p className="text-xs text-[#e8e0d5]/50">Uploading…</p> : null}
          </div>
        </div>
      </div>

      <div>
        <label id="trainer-bio-label" className="block text-sm font-medium text-[#e8e0d5]/80 mb-1">
          Bio
        </label>
        <RichTextEditor value={bodyHtml} onChange={setBodyHtml} labelledBy="trainer-bio-label" />
        <p className="mt-1 text-xs text-[#e8e0d5]/50">
          Highlight text, then apply a format. This preview uses the public trainer typography.
        </p>
      </div>

      <fieldset className="space-y-4">
        <legend className="text-sm font-medium text-[#e8e0d5]/80">Contact</legend>
        <p className="text-xs text-[#e8e0d5]/50">Leave blank to hide on the public page.</p>
        <div>
          <label htmlFor="trainer-email" className="block text-sm text-[#e8e0d5]/70 mb-1">
            Email
          </label>
          <input
            id="trainer-email"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="trainer-phone" className="block text-sm text-[#e8e0d5]/70 mb-1">
            Phone
          </label>
          <input
            id="trainer-phone"
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="trainer-website" className="block text-sm text-[#e8e0d5]/70 mb-1">
            Website
          </label>
          <input
            id="trainer-website"
            type="url"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://"
            className={fieldClass}
          />
        </div>
      </fieldset>

      <div>
        <label htmlFor="trainer-events" className="block text-sm font-medium text-[#e8e0d5]/80 mb-1">
          Events
        </label>
        <p className="mb-2 text-xs text-[#e8e0d5]/50">
          Choose events from the Shopify Events collection. Order here is the order on the public page.
        </p>
        {eventGids.length > 0 ? (
          <ol className="mb-3 space-y-2">
            {eventGids.map((gid, index) => (
              <li
                key={gid}
                className="flex items-center gap-2 rounded-lg border border-[#d4af37]/20 bg-[#0f3d1e]/30 px-3 py-2"
              >
                <span className="flex-1 text-sm text-[#e8e0d5]">
                  {titles.get(gid) || "Event unavailable"}
                  {!titles.get(gid) ? (
                    <span className="block text-xs text-[#e8e0d5]/45">{gid}</span>
                  ) : null}
                </span>
                <button
                  type="button"
                  aria-label="Move event up"
                  disabled={index === 0}
                  onClick={() => moveEvent(index, -1)}
                  className="p-1 text-[#e8e0d5]/70 hover:text-[#d4af37] disabled:opacity-30"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Move event down"
                  disabled={index === eventGids.length - 1}
                  onClick={() => moveEvent(index, 1)}
                  className="p-1 text-[#e8e0d5]/70 hover:text-[#d4af37] disabled:opacity-30"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Remove event"
                  onClick={() => setEventGids(eventGids.filter((item) => item !== gid))}
                  className="p-1 text-[#e8e0d5]/70 hover:text-red-400"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mb-3 text-sm text-[#e8e0d5]/50">No events selected.</p>
        )}
        <input
          id="trainer-events"
          type="search"
          value={eventQuery}
          onChange={(e) => setEventQuery(e.target.value)}
          placeholder="Search events to add"
          className={fieldClass}
        />
        {optionsError ? <p className="mt-2 text-sm text-red-400">{optionsError}</p> : null}
        {filteredOptions.length > 0 ? (
          <ul className="mt-2 max-h-52 overflow-auto rounded-lg border border-[#d4af37]/20">
            {filteredOptions.map((option) => (
              <li key={option.productGid} className="border-b border-[#d4af37]/10 last:border-0">
                <button
                  type="button"
                  onClick={() => setEventGids((current) => [...current, option.productGid])}
                  className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm text-[#e8e0d5] hover:bg-[#0f3d1e]/40"
                >
                  <span>{option.title}</span>
                  <span className="text-xs text-[#e8e0d5]/45">{option.handle}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div>
        <label htmlFor="trainer-sort" className="block text-sm font-medium text-[#e8e0d5]/80 mb-1">
          Sort order
        </label>
        <input
          id="trainer-sort"
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className={`${fieldClass} max-w-[10rem]`}
        />
        <p className="mt-1 text-xs text-[#e8e0d5]/50">Lower numbers appear first. Ties fall back to name.</p>
      </div>

      <div className="flex items-center gap-3">
        <input
          id="trainer-publish"
          type="checkbox"
          checked={publish}
          onChange={(e) => setPublish(e.target.checked)}
          className="w-4 h-4 rounded border-[#d4af37]/50 bg-[#0f3d1e] text-[#d4af37] focus:ring-[#d4af37]"
        />
        <label htmlFor="trainer-publish" className="text-sm text-[#e8e0d5]/90">
          Published (uncheck to keep this trainer as a draft)
        </label>
      </div>

      <div className="flex gap-4 pt-4">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : mode === "create" ? "Create trainer" : "Update trainer"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/trainers")}
          className="px-6 py-2.5 border border-[#d4af37]/40 text-[#d4af37] font-medium rounded-lg hover:bg-[#d4af37]/10"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
