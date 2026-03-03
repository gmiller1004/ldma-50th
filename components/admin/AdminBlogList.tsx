"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BlogPost } from "@/lib/blog";
import { Pencil, Trash2, ExternalLink } from "lucide-react";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export function AdminBlogList({ posts }: { posts: BlogPost[] }) {
  const router = useRouter();

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/blog/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Delete failed");
    }
  }

  if (posts.length === 0) {
    return (
      <p className="text-[#e8e0d5]/60 py-8">
        No posts yet.{" "}
        <Link href="/admin/blog/new" className="text-[#d4af37] hover:underline">
          Create one
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-[#d4af37]/20 overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead className="bg-[#0f3d1e]/50 border-b border-[#d4af37]/20">
          <tr>
            <th className="px-4 py-3 font-semibold text-[#f0d48f]">Title</th>
            <th className="px-4 py-3 font-semibold text-[#f0d48f]">Category</th>
            <th className="px-4 py-3 font-semibold text-[#f0d48f]">Status</th>
            <th className="px-4 py-3 font-semibold text-[#f0d48f]">Updated</th>
            <th className="px-4 py-3 font-semibold text-[#f0d48f] w-24">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#d4af37]/10">
          {posts.map((post) => (
            <tr key={post.id} className="hover:bg-[#0f3d1e]/20">
              <td className="px-4 py-3">
                <Link
                  href={`/admin/blog/${post.id}/edit`}
                  className="text-[#e8e0d5] hover:text-[#d4af37] font-medium"
                >
                  {post.title}
                </Link>
              </td>
              <td className="px-4 py-3 text-[#e8e0d5]/80">{post.categoryLabel ?? post.categoryId}</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    post.publishedAt
                      ? "bg-[#0f3d1e] text-[#d4af37]"
                      : "bg-[#d4af37]/20 text-[#e8e0d5]/70"
                  }`}
                >
                  {post.publishedAt ? "Published" : "Draft"}
                </span>
              </td>
              <td className="px-4 py-3 text-[#e8e0d5]/60">{formatDate(post.updatedAt)}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/blog/${post.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-[#e8e0d5]/60 hover:text-[#d4af37]"
                    aria-label="View post"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                  <Link
                    href={`/admin/blog/${post.id}/edit`}
                    className="p-1.5 text-[#e8e0d5]/60 hover:text-[#d4af37]"
                    aria-label="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(post.id, post.title)}
                    className="p-1.5 text-[#e8e0d5]/60 hover:text-red-400"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
