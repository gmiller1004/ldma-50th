"use client";

import { useState, useEffect } from "react";
import { Search, Loader2, Calendar, User, X } from "lucide-react";

type LookupResult = {
  contactId: string;
  memberNumber: string;
  displayName: string;
  isLdmaMember: boolean;
  maintenanceFeesDue: number | null;
  membershipDuesOwed: number | null;
  membershipBalance: number | null;
};

type CheckIn = {
  id: string;
  memberNumber: string;
  memberDisplayName: string | null;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  pointsAwarded: number;
};

function formatCurrency(val: number | null | undefined): string {
  if (val == null || Number.isNaN(val)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);
}

export function CaretakerPortalContent({
  campSlug,
  campName,
}: {
  campSlug: string;
  campName: string;
}) {
  const [memberNumber, setMemberNumber] = useState("");
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [activeCheckIns, setActiveCheckIns] = useState<CheckIn[]>([]);
  const [archivedCheckIns, setArchivedCheckIns] = useState<CheckIn[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [nightsInput, setNightsInput] = useState("1");
  const [checkInSubmitting, setCheckInSubmitting] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingCheckIn, setEditingCheckIn] = useState<CheckIn | null>(null);
  const [newCheckOutDate, setNewCheckOutDate] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancellingCheckIn, setCancellingCheckIn] = useState<CheckIn | null>(null);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  function loadCheckIns() {
    setListLoading(true);
    Promise.all([
      fetch("/api/members/caretaker/check-ins?status=active").then((r) => r.json()),
      fetch("/api/members/caretaker/check-ins?status=archived").then((r) => r.json()),
    ])
      .then(([activeRes, archivedRes]) => {
        setActiveCheckIns(activeRes.checkIns ?? []);
        setArchivedCheckIns(archivedRes.checkIns ?? []);
      })
      .catch(() => {})
      .finally(() => setListLoading(false));
  }

  useEffect(() => {
    loadCheckIns();
  }, []);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!memberNumber.trim()) return;
    setLookupError(null);
    setLookupLoading(true);
    try {
      const res = await fetch("/api/members/caretaker/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberNumber: memberNumber.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLookupError(data.error ?? "Lookup failed");
        setLookupResult(null);
        return;
      }
      setLookupResult(data);
    } catch {
      setLookupError("Lookup failed");
      setLookupResult(null);
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleCheckInSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nights = Math.max(1, Math.min(365, parseInt(nightsInput, 10) || 1));
    if (!lookupResult) return;
    setCheckInSubmitting(true);
    try {
      const res = await fetch("/api/members/caretaker/check-ins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberContactId: lookupResult.contactId,
          memberNumber: lookupResult.memberNumber,
          memberDisplayName: lookupResult.displayName,
          nights,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setLookupError(data.error ?? "Check-in failed");
        return;
      }
      setCheckInModalOpen(false);
      setNightsInput("1");
      loadCheckIns();
    } catch {
      setLookupError("Check-in failed");
    } finally {
      setCheckInSubmitting(false);
    }
  }

  function openEditModal(checkIn: CheckIn) {
    setEditingCheckIn(checkIn);
    setNewCheckOutDate(checkIn.checkOutDate);
    setEditModalOpen(true);
  }

  function openCancelModal(checkIn: CheckIn) {
    setCancellingCheckIn(checkIn);
    setCancelModalOpen(true);
  }

  async function handleCancelConfirm() {
    if (!cancellingCheckIn) return;
    setLookupError(null);
    setCancelSubmitting(true);
    try {
      const res = await fetch(`/api/members/caretaker/check-ins/${cancellingCheckIn.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        setLookupError(data.error ?? "Cancel failed");
        return;
      }
      setCancelModalOpen(false);
      setCancellingCheckIn(null);
      loadCheckIns();
    } catch {
      setLookupError("Cancel failed");
    } finally {
      setCancelSubmitting(false);
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCheckIn || !newCheckOutDate) return;
    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/members/caretaker/check-ins/${editingCheckIn.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkOutDate: newCheckOutDate }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Update failed");
        return;
      }
      setEditModalOpen(false);
      setEditingCheckIn(null);
      loadCheckIns();
    } catch {
      alert("Update failed");
    } finally {
      setEditSubmitting(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-8">
      {/* Member lookup */}
      <section className="p-4 bg-[#0f0a06]/60 border border-[#d4af37]/20 rounded-lg">
        <h2 className="font-semibold text-[#f0d48f] mb-3 flex items-center gap-2">
          <Search className="w-5 h-5" />
          Look up member
        </h2>
        <form onSubmit={handleLookup} className="flex gap-2 flex-wrap">
          <input
            type="text"
            value={memberNumber}
            onChange={(e) => setMemberNumber(e.target.value)}
            placeholder="Member number"
            className="flex-1 min-w-[120px] px-4 py-2.5 bg-[#1a120b] border border-[#d4af37]/30 rounded-lg text-[#e8e0d5] placeholder-[#e8e0d5]/40 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50"
          />
          <button
            type="submit"
            disabled={lookupLoading || !memberNumber.trim()}
            className="px-4 py-2.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] disabled:opacity-50 flex items-center gap-2"
          >
            {lookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Look up
          </button>
        </form>
        {lookupError && (
          <p className="mt-2 text-red-400 text-sm">{lookupError}</p>
        )}
        {lookupResult && (
          <div className="mt-4 p-4 bg-[#1a120b] rounded-lg border border-[#d4af37]/20 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-[#d4af37]" />
                <span className="font-medium text-[#e8e0d5]">{lookupResult.displayName}</span>
                <span className="text-[#e8e0d5]/60">#{lookupResult.memberNumber}</span>
              </div>
              <span
                className={
                  lookupResult.isLdmaMember
                    ? "px-2 py-0.5 rounded bg-[#0f3d1e] text-[#6dd472] text-sm font-medium"
                    : "px-2 py-0.5 rounded bg-[#4a3a0f] text-[#e8c547] text-sm font-medium"
                }
              >
                {lookupResult.isLdmaMember ? "LDMA Member" : "No Valid Membership Found"}
              </span>
              <button
                type="button"
                onClick={() => { setLookupResult(null); setLookupError(null); }}
                className="ml-auto p-1.5 text-[#e8e0d5]/60 hover:text-[#e8e0d5] rounded"
                aria-label="Close lookup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
              <div>
                <dt className="text-[#e8e0d5]/60">Maintenance fees due</dt>
                <dd className="text-[#e8e0d5] font-medium">{formatCurrency(lookupResult.maintenanceFeesDue)}</dd>
              </div>
              <div>
                <dt className="text-[#e8e0d5]/60">Membership dues owed</dt>
                <dd className="text-[#e8e0d5] font-medium">{formatCurrency(lookupResult.membershipDuesOwed)}</dd>
              </div>
              <div>
                <dt className="text-[#e8e0d5]/60">Membership balance</dt>
                <dd className="text-[#e8e0d5] font-medium">{formatCurrency(lookupResult.membershipBalance)}</dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={() => { setNightsInput("1"); setCheckInModalOpen(true); }}
              className="mt-3 px-4 py-2 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f]"
            >
              Check in member
            </button>
          </div>
        )}
      </section>

      {/* Active check-ins */}
      <section>
        <h2 className="font-semibold text-[#f0d48f] mb-3 flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Active check-ins
        </h2>
        {listLoading ? (
          <p className="text-[#e8e0d5]/60">Loading…</p>
        ) : activeCheckIns.length === 0 ? (
          <p className="text-[#e8e0d5]/60">No active check-ins.</p>
        ) : (
          <ul className="space-y-2">
            {activeCheckIns.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 p-3 bg-[#0f0a06]/60 border border-[#d4af37]/20 rounded-lg"
              >
                <div>
                  <span className="font-medium text-[#e8e0d5]">
                    {c.memberDisplayName || `#${c.memberNumber}`}
                  </span>
                  <span className="text-[#e8e0d5]/60 ml-2">#{c.memberNumber}</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-[#e8e0d5]/80">
                  <span>Check-in: {c.checkInDate}</span>
                  <span>Check-out: {c.checkOutDate}</span>
                  <span>{c.nights} night{c.nights !== 1 ? "s" : ""}</span>
                  <span>{c.pointsAwarded} pts</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditModal(c)}
                    className="px-3 py-1.5 text-sm bg-[#d4af37]/20 text-[#d4af37] rounded hover:bg-[#d4af37]/30"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => openCancelModal(c)}
                    className="px-3 py-1.5 text-sm bg-red-950/50 text-red-300 rounded hover:bg-red-900/40 border border-red-800/50"
                  >
                    Cancel reservation
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Archived check-ins */}
      <section>
        <h2 className="font-semibold text-[#e8e0d5]/80 mb-3">Archived check-ins</h2>
        {listLoading ? null : archivedCheckIns.length === 0 ? (
          <p className="text-[#e8e0d5]/60">No archived check-ins.</p>
        ) : (
          <ul className="space-y-2">
            {archivedCheckIns.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 p-3 bg-[#0f0a06]/40 border border-[#d4af37]/10 rounded-lg text-[#e8e0d5]/80"
              >
                <div>
                  <span className="font-medium">{c.memberDisplayName || `#${c.memberNumber}`}</span>
                  <span className="ml-2 opacity-70">#{c.memberNumber}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span>{c.checkInDate} – {c.checkOutDate}</span>
                  <span>{c.nights} night{c.nights !== 1 ? "s" : ""}</span>
                  <span>{c.pointsAwarded} pts</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Check-in modal */}
      {checkInModalOpen && lookupResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={() => setCheckInModalOpen(false)}>
          <div className="bg-[#1a120b] border border-[#d4af37]/30 rounded-xl shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-[#f0d48f]">Check in member</h3>
              <button type="button" onClick={() => setCheckInModalOpen(false)} className="text-[#e8e0d5]/60 hover:text-[#e8e0d5]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-[#e8e0d5]/80 text-sm mb-4">
              {lookupResult.displayName} (#{lookupResult.memberNumber})
            </p>
            <form onSubmit={handleCheckInSubmit}>
              <label className="block text-sm font-medium text-[#e8e0d5] mb-2">How many nights?</label>
              <input
                type="number"
                min={1}
                max={365}
                value={nightsInput}
                onChange={(e) => setNightsInput(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#0f0a06] border border-[#d4af37]/30 rounded-lg text-[#e8e0d5] mb-4"
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setCheckInModalOpen(false)} className="flex-1 py-2.5 text-[#e8e0d5]/80 hover:text-[#d4af37]">
                  Cancel
                </button>
                <button type="submit" disabled={checkInSubmitting} className="flex-1 py-2.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] disabled:opacity-50 flex items-center justify-center gap-2">
                  {checkInSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Check in
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel reservation confirmation modal */}
      {cancelModalOpen && cancellingCheckIn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={() => !cancelSubmitting && (setCancelModalOpen(false), setCancellingCheckIn(null))}>
          <div className="bg-[#1a120b] border border-[#d4af37]/30 rounded-xl shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-[#f0d48f]">Cancel reservation</h3>
              <button type="button" onClick={() => !cancelSubmitting && (setCancelModalOpen(false), setCancellingCheckIn(null))} className="text-[#e8e0d5]/60 hover:text-[#e8e0d5]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-[#e8e0d5]/90 text-sm mb-4">
              Cancel this reservation for {cancellingCheckIn.memberDisplayName || `#${cancellingCheckIn.memberNumber}`}?{" "}
              <strong className="text-[#e8e0d5]">{cancellingCheckIn.pointsAwarded} points</strong> will be deducted and the reservation will move to archives.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => !cancelSubmitting && (setCancelModalOpen(false), setCancellingCheckIn(null))} className="flex-1 py-2.5 text-[#e8e0d5]/80 hover:text-[#d4af37]">
                Keep reservation
              </button>
              <button type="button" onClick={handleCancelConfirm} disabled={cancelSubmitting} className="flex-1 py-2.5 bg-red-800/80 text-red-100 font-semibold rounded-lg hover:bg-red-700/80 disabled:opacity-50 flex items-center justify-center gap-2">
                {cancelSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Yes, cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit checkout modal */}
      {editModalOpen && editingCheckIn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={() => setEditModalOpen(false)}>
          <div className="bg-[#1a120b] border border-[#d4af37]/30 rounded-xl shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-[#f0d48f]">Edit checkout date</h3>
              <button type="button" onClick={() => setEditModalOpen(false)} className="text-[#e8e0d5]/60 hover:text-[#e8e0d5]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-[#e8e0d5]/80 text-sm mb-4">
              {editingCheckIn.memberDisplayName || `#${editingCheckIn.memberNumber}`}
            </p>
            <form onSubmit={handleEditSubmit}>
              <label className="block text-sm font-medium text-[#e8e0d5] mb-2">New checkout date</label>
              <input
                type="date"
                min={editingCheckIn.checkInDate}
                value={newCheckOutDate}
                onChange={(e) => setNewCheckOutDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#0f0a06] border border-[#d4af37]/30 rounded-lg text-[#e8e0d5] mb-4"
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditModalOpen(false)} className="flex-1 py-2.5 text-[#e8e0d5]/80 hover:text-[#d4af37]">
                  Cancel
                </button>
                <button type="submit" disabled={editSubmitting} className="flex-1 py-2.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] disabled:opacity-50 flex items-center justify-center gap-2">
                  {editSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
