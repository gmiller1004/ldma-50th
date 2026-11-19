"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TrainerProfile } from "@/lib/trainers-types";
import { ExternalLink, Pencil, Trash2 } from "lucide-react";

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

export function AdminTrainerList({ trainers }: { trainers: TrainerProfile[] }) {
  const router = useRouter();

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/trainers/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Delete failed");
    }
  }

  if (trainers.length === 0) {
    return (
      <p className="text-[#e8e0d5]/60 py-8">
        No trainers yet.{" "}
        <Link href="/admin/trainers/new" className="text-[#d4af37] hover:underline">
          Add one
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
            <th className="px-4 py-3 font-semibold text-[#f0d48f]">Name</th>
            <th className="px-4 py-3 font-semibold text-[#f0d48f]">Title</th>
            <th className="px-4 py-3 font-semibold text-[#f0d48f]">Status</th>
            <th className="px-4 py-3 font-semibold text-[#f0d48f]">Sort</th>
            <th className="px-4 py-3 font-semibold text-[#f0d48f]">Updated</th>
            <th className="px-4 py-3 font-semibold text-[#f0d48f] w-28">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#d4af37]/10">
          {trainers.map((trainer) => (
            <tr key={trainer.id} className="hover:bg-[#0f3d1e]/20">
              <td className="px-4 py-3">
                <Link
                  href={`/admin/trainers/${trainer.id}/edit`}
                  className="text-[#e8e0d5] hover:text-[#d4af37] font-medium"
                >
                  {trainer.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-[#e8e0d5]/80">{trainer.title || "—"}</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    trainer.publishedAt
                      ? "bg-[#0f3d1e] text-[#d4af37]"
                      : "bg-[#d4af37]/20 text-[#e8e0d5]/70"
                  }`}
                >
                  {trainer.publishedAt ? "Published" : "Draft"}
                </span>
              </td>
              <td className="px-4 py-3 text-[#e8e0d5]/70">{trainer.sortOrder}</td>
              <td className="px-4 py-3 text-[#e8e0d5]/60">{formatDate(trainer.updatedAt)}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {trainer.publishedAt ? (
                    <Link
                      href={`/trainers/${trainer.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-[#e8e0d5]/60 hover:text-[#d4af37]"
                      aria-label={`View public page for ${trainer.name}`}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  ) : null}
                  <Link
                    href={`/admin/trainers/${trainer.id}/edit`}
                    className="p-1.5 text-[#e8e0d5]/60 hover:text-[#d4af37]"
                    aria-label={`Edit ${trainer.name}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(trainer.id, trainer.name)}
                    className="p-1.5 text-[#e8e0d5]/60 hover:text-red-400"
                    aria-label={`Delete ${trainer.name}`}
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
