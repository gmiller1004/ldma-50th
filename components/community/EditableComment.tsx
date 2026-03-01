"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

type Props = {
  commentId: string;
  body: string;
  canEdit: boolean;
  onSave: () => void;
  children: React.ReactNode;
};

export function EditableComment({
  commentId,
  body,
  canEdit,
  onSave,
  children,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(body);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/community/comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: editBody }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to save");
        return;
      }
      setEditing(false);
      onSave();
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="space-y-2">
        <textarea
          value={editBody}
          onChange={(e) => setEditBody(e.target.value)}
          rows={4}
          className="w-full px-4 py-2 rounded-lg bg-[#1a120b] border border-[#d4af37]/30 text-[#e8e0d5] text-sm"
          placeholder="Your reply"
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] disabled:opacity-50 text-sm"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setEditBody(body);
              setError(null);
            }}
            className="px-3 py-1.5 border border-[#d4af37]/40 text-[#e8e0d5] rounded-lg hover:bg-[#d4af37]/10 text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {canEdit && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1 text-xs text-[#e8e0d5]/60 hover:text-[#d4af37]"
          aria-label="Edit"
        >
          <Pencil className="w-3 h-3" />
          Edit
        </button>
      )}
      {children}
    </>
  );
}
