"use client";

import { useState, useRef } from "react";
import { ImagePlus, X } from "lucide-react";

type Props = {
  campSlug: string;
  claimSlug?: string | null;
  onSuccess: (id: string) => void;
  onCancel: () => void;
};

const MAX_PHOTOS = 5;
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

export function CreateDiscussionForm({ campSlug, claimSlug, onSuccess, onCancel }: Props) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let res: Response;
      if (photos.length > 0) {
        const formData = new FormData();
        formData.append("camp_slug", campSlug);
        if (claimSlug) formData.append("claim_slug", claimSlug);
        formData.append("title", title.trim());
        formData.append("body", body.trim());
        photos.forEach((p) => formData.append("photos", p));
        res = await fetch("/api/community/discussions", {
          method: "POST",
          body: formData,
        });
      } else {
        res = await fetch("/api/community/discussions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            camp_slug: campSlug,
            ...(claimSlug && { claim_slug: claimSlug }),
            title: title.trim(),
            body: body.trim(),
          }),
        });
      }

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to create discussion");
        setLoading(false);
        return;
      }

      onSuccess(data.id);
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  };

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const added: File[] = [];
    for (let i = 0; i < files.length && photos.length + added.length < MAX_PHOTOS; i++) {
      const f = files[i];
      if (f.type.startsWith("image/")) added.push(f);
    }
    setPhotos((prev) => [...prev, ...added].slice(0, MAX_PHOTOS));
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="font-serif text-xl font-semibold text-[#f0d48f]">
        Share a trip report or start a discussion
      </h3>
      <div>
        <label
          htmlFor="disc-title"
          className="block text-sm font-medium text-[#e8e0d5]/90 mb-1"
        >
          Title
        </label>
        <input
          id="disc-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Great weekend at Italian Bar"
          required
          maxLength={200}
          className="w-full px-4 py-3 rounded-lg bg-[#1a120b] border border-[#d4af37]/30 text-[#e8e0d5] placeholder-[#e8e0d5]/40 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50"
        />
      </div>
      <div>
        <label
          htmlFor="disc-body"
          className="block text-sm font-medium text-[#e8e0d5]/90 mb-1"
        >
          Your report
        </label>
        <textarea
          id="disc-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Tell the community about your trip, finds, tips..."
          required
          rows={5}
          maxLength={10000}
          className="w-full px-4 py-3 rounded-lg bg-[#1a120b] border border-[#d4af37]/30 text-[#e8e0d5] placeholder-[#e8e0d5]/40 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50 resize-y"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[#e8e0d5]/90 mb-2">
          Photos (optional)
        </label>
        <div className="flex flex-wrap gap-2">
          {photos.map((p, i) => (
            <div
              key={i}
              className="relative w-20 h-20 rounded-lg overflow-hidden bg-[#0f3d1e]/30 border border-[#d4af37]/20 group"
            >
              <img
                src={URL.createObjectURL(p)}
                alt=""
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => removePhoto(i)}
                className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-6 h-6 text-white" />
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <label className="w-20 h-20 rounded-lg border-2 border-dashed border-[#d4af37]/30 flex items-center justify-center cursor-pointer hover:border-[#d4af37]/50 hover:bg-[#0f3d1e]/20 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT}
                multiple
                className="sr-only"
                onChange={(e) => {
                  addPhotos(e.target.files);
                  e.target.value = "";
                }}
              />
              <ImagePlus className="w-8 h-8 text-[#d4af37]/60" />
            </label>
          )}
        </div>
        <p className="text-xs text-[#e8e0d5]/50 mt-1">
          Up to {MAX_PHOTOS} photos, 4MB each. JPEG, PNG, WebP, or GIF.
        </p>
      </div>
      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading || !title.trim() || !body.trim()}
          className="px-6 py-2.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Posting…" : "Post"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2.5 border border-[#d4af37]/40 text-[#e8e0d5] font-medium rounded-lg hover:bg-[#d4af37]/10 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
