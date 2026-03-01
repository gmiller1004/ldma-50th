"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

type Props = {
  discussionId: string;
  title: string;
  body: string;
  canEdit: boolean;
  onSave: () => void;
  renderDisplay: (title: string, body: string) => React.ReactNode;
};

export function EditableDiscussion({
  discussionId,
  title,
  body,
  canEdit,
  onSave,
  renderDisplay,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [editBody, setEditBody] = useState(body);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/community/discussions/${discussionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, body: editBody }),
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
      <div className="space-y-4">
        <input
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          className="w-full px-4 py-2 rounded-lg bg-[#1a120b] border border-[#d4af37]/30 text-[#e8e0d5] font-serif text-xl font-bold"
          placeholder="Title"
        />
        <textarea
          value={editBody}
          onChange={(e) => setEditBody(e.target.value)}
          rows={6}
          className="w-full px-4 py-2 rounded-lg bg-[#1a120b] border border-[#d4af37]/30 text-[#e8e0d5]"
          placeholder="Body"
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setEditTitle(title);
              setEditBody(body);
              setError(null);
            }}
            className="px-4 py-2 border border-[#d4af37]/40 text-[#e8e0d5] rounded-lg hover:bg-[#d4af37]/10"
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
          className="inline-flex items-center gap-1.5 text-sm text-[#e8e0d5]/60 hover:text-[#d4af37] mb-2"
          aria-label="Edit"
        >
          <Pencil className="w-4 h-4" />
          Edit
        </button>
      )}
      {renderDisplay(title, body)}
    </>
  );
}
