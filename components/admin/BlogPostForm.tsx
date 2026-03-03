"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { BlogPost } from "@/lib/blog";
import type { BlogCategory } from "@/lib/blog";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

type BlogPostFormProps = {
  post?: BlogPost | null;
  categories: BlogCategory[];
  mode: "create" | "edit";
};

export function BlogPostForm({ post, categories, mode }: BlogPostFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [categoryId, setCategoryId] = useState(post?.categoryId ?? categories[0]?.id ?? "");
  const [featuredImageUrl, setFeaturedImageUrl] = useState(post?.featuredImageUrl ?? "");
  const [authorDisplayName, setAuthorDisplayName] = useState(post?.authorDisplayName ?? "");
  const [tagsInput, setTagsInput] = useState((post?.tags ?? []).join(", "));
  const [publish, setPublish] = useState(Boolean(post?.publishedAt));

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setTitle(v);
      if (mode === "create" && !slug) setSlug(slugify(v));
    },
    [mode, slug]
  );

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const formData = new FormData();
    formData.set("file", file);
    formData.set("postId", post?.id ?? "draft");
    const res = await fetch("/api/admin/blog/upload", {
      method: "POST",
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Upload failed");
      return;
    }
    if (typeof data.url === "string") setFeaturedImageUrl(data.url);
    e.target.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const tagList = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
      const payload = {
        slug: slug.trim(),
        title: title.trim(),
        excerpt: excerpt.trim() || null,
        body: body.trim(),
        categoryId: categoryId.trim(),
        featuredImageUrl: featuredImageUrl.trim() || null,
        authorDisplayName: authorDisplayName.trim() || null,
        publishedAt: publish ? new Date().toISOString() : null,
        tags: tagList,
      };

      if (mode === "create") {
        const res = await fetch("/api/admin/blog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Failed to create");
          return;
        }
        router.push("/admin/blog");
        router.refresh();
      } else if (post) {
        const res = await fetch(`/api/admin/blog/${post.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Failed to update");
          return;
        }
        router.push("/admin/blog");
        router.refresh();
      }
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

      <div>
        <label htmlFor="title" className="block text-sm font-medium text-[#e8e0d5]/80 mb-1">
          Title *
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={handleTitleChange}
          required
          className="w-full px-4 py-2 rounded-lg bg-[#0f3d1e]/50 border border-[#d4af37]/30 text-[#e8e0d5] focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50"
        />
      </div>

      <div>
        <label htmlFor="slug" className="block text-sm font-medium text-[#e8e0d5]/80 mb-1">
          Slug (URL) *
        </label>
        <input
          id="slug"
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          required
          className="w-full px-4 py-2 rounded-lg bg-[#0f3d1e]/50 border border-[#d4af37]/30 text-[#e8e0d5] focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50"
        />
      </div>

      <div>
        <label htmlFor="category" className="block text-sm font-medium text-[#e8e0d5]/80 mb-1">
          Category *
        </label>
        <select
          id="category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full px-4 py-2 rounded-lg bg-[#0f3d1e]/50 border border-[#d4af37]/30 text-[#e8e0d5] focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="tags" className="block text-sm font-medium text-[#e8e0d5]/80 mb-1">
          Tags
        </label>
        <input
          id="tags"
          type="text"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="e.g. stanton, long-term, events"
          className="w-full px-4 py-2 rounded-lg bg-[#0f3d1e]/50 border border-[#d4af37]/30 text-[#e8e0d5] focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50"
        />
        <p className="mt-1 text-xs text-[#e8e0d5]/50">
          Comma-separated. Used for filtering and search.
        </p>
      </div>

      <div>
        <label htmlFor="excerpt" className="block text-sm font-medium text-[#e8e0d5]/80 mb-1">
          Excerpt
        </label>
        <textarea
          id="excerpt"
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          rows={2}
          className="w-full px-4 py-2 rounded-lg bg-[#0f3d1e]/50 border border-[#d4af37]/30 text-[#e8e0d5] focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50"
        />
      </div>

      <div>
        <label htmlFor="body" className="block text-sm font-medium text-[#e8e0d5]/80 mb-1">
          Body (HTML) *
        </label>
        <textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          rows={14}
          className="w-full px-4 py-2 rounded-lg bg-[#0f3d1e]/50 border border-[#d4af37]/30 text-[#e8e0d5] focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50 font-mono text-sm"
        />
        <p className="mt-1 text-xs text-[#e8e0d5]/50">
          Simple HTML supported (e.g. &lt;p&gt;, &lt;strong&gt;, &lt;a href="..."&gt;).
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-[#e8e0d5]/80 mb-1">
          Featured image
        </label>
        <div className="flex flex-wrap gap-4 items-start">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleImageUpload}
            className="text-sm text-[#e8e0d5]/80 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-[#d4af37] file:text-[#1a120b] file:font-medium"
          />
          <input
            type="url"
            placeholder="Or paste image URL"
            value={featuredImageUrl}
            onChange={(e) => setFeaturedImageUrl(e.target.value)}
            className="flex-1 min-w-[200px] px-4 py-2 rounded-lg bg-[#0f3d1e]/50 border border-[#d4af37]/30 text-[#e8e0d5] focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50"
          />
        </div>
      </div>

      <div>
        <label htmlFor="author" className="block text-sm font-medium text-[#e8e0d5]/80 mb-1">
          Author display name
        </label>
        <input
          id="author"
          type="text"
          value={authorDisplayName}
          onChange={(e) => setAuthorDisplayName(e.target.value)}
          className="w-full px-4 py-2 rounded-lg bg-[#0f3d1e]/50 border border-[#d4af37]/30 text-[#e8e0d5] focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50"
        />
      </div>

      <div className="flex items-center gap-3">
        <input
          id="publish"
          type="checkbox"
          checked={publish}
          onChange={(e) => setPublish(e.target.checked)}
          className="w-4 h-4 rounded border-[#d4af37]/50 bg-[#0f3d1e] text-[#d4af37] focus:ring-[#d4af37]"
        />
        <label htmlFor="publish" className="text-sm text-[#e8e0d5]/90">
          Publish (uncheck to save as draft)
        </label>
      </div>

      <div className="flex gap-4 pt-4">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : mode === "create" ? "Create post" : "Update post"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-2.5 border border-[#d4af37]/40 text-[#d4af37] font-medium rounded-lg hover:bg-[#d4af37]/10"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
