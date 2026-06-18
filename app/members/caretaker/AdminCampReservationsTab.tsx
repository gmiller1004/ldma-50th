"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { caretakerAllowsCashCheckIn, caretakerEarliestCheckInDate } from "@/lib/reservation-camps";
import { countNights } from "@/lib/reservation-dates";
import { formatCentsAsCurrency } from "@/lib/reservation-pricing";

export type AdminReservationListRow = {
  id: string;
  siteName: string | null;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  reservationType: string;
  memberDisplayName: string | null;
  memberNumber: string | null;
  guestFirstName: string | null;
  guestLastName: string | null;
  guestEmail: string | null;
  status: string;
  balanceDueCents?: number;
  hasOverdueSiteFee?: boolean;
};

type ReservationDetail = AdminReservationListRow & {
  siteId: string;
  memberContactId: string | null;
  guestPhone: string | null;
};

type CancelPreview = {
  totalPaidCents: number;
  earnedCents: number;
  nightsStayed: number;
  refundCents: number;
};

function toDateOnly(val: string): string {
  return val.slice(0, 10);
}

function partyLabel(r: AdminReservationListRow): string {
  if (r.reservationType === "member") {
    return r.memberDisplayName || (r.memberNumber ? `#${r.memberNumber}` : "Member");
  }
  const name = [r.guestFirstName, r.guestLastName].filter(Boolean).join(" ").trim();
  return name || "Guest";
}

export function AdminCampReservationsTab({
  campSlug,
  reservations,
  onUpdated,
}: {
  campSlug: string;
  reservations: AdminReservationListRow[] | undefined;
  onUpdated: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const earliestCheckIn = caretakerEarliestCheckInDate(today);

  const [editing, setEditing] = useState<ReservationDetail | null>(null);
  const [editCheckIn, setEditCheckIn] = useState("");
  const [editCheckOut, setEditCheckOut] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [paymentDueCents, setPaymentDueCents] = useState<number | null>(null);
  const [memberEmail, setMemberEmail] = useState<string | null>(null);

  const [cancelling, setCancelling] = useState<AdminReservationListRow | null>(null);
  const [cancelPreview, setCancelPreview] = useState<CancelPreview | null>(null);
  const [cancelPreviewLoading, setCancelPreviewLoading] = useState(false);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  const editNights =
    editCheckIn && editCheckOut && editCheckIn < editCheckOut
      ? countNights(editCheckIn, editCheckOut)
      : 0;
  const editAllowsCash = editCheckIn ? caretakerAllowsCashCheckIn(editCheckIn, today) : false;

  const apiQs = `?campSlug=${encodeURIComponent(campSlug)}`;

  async function openEdit(row: AdminReservationListRow) {
    if (row.status === "cancelled") return;
    setEditLoading(true);
    setPaymentDueCents(null);
    try {
      const res = await fetch(`/api/members/caretaker/reservations/${row.id}${apiQs}`);
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Failed to load reservation");
        return;
      }
      const detail: ReservationDetail = {
        ...row,
        siteId: data.siteId,
        memberContactId: data.memberContactId ?? null,
        guestPhone: data.guestPhone ?? null,
      };
      setEditing(detail);
      setEditCheckIn(toDateOnly(data.checkInDate ?? row.checkInDate));
      setEditCheckOut(toDateOnly(data.checkOutDate ?? row.checkOutDate));
      setMemberEmail(null);
      if (row.reservationType === "member" && row.memberNumber) {
        fetch("/api/members/caretaker/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memberNumber: row.memberNumber }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((lookup) => setMemberEmail(lookup?.email?.trim() || null))
          .catch(() => setMemberEmail(null));
      }
    } catch {
      alert("Failed to load reservation");
    } finally {
      setEditLoading(false);
    }
  }

  function closeEdit() {
    setEditing(null);
    setPaymentDueCents(null);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setEditSubmitting(true);
    setPaymentDueCents(null);
    try {
      const res = await fetch(`/api/members/caretaker/reservations/${editing.id}${apiQs}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkInDate: editCheckIn, checkOutDate: editCheckOut }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.requirePayment && typeof data.amountDueCents === "number") {
          setPaymentDueCents(data.amountDueCents);
          return;
        }
        alert(data.error ?? "Update failed");
        return;
      }
      closeEdit();
      onUpdated();
    } catch {
      alert("Update failed");
    } finally {
      setEditSubmitting(false);
    }
  }

  function recipientForEdit() {
    if (!editing) return null;
    const email =
      editing.reservationType === "member"
        ? memberEmail?.trim() || editing.guestEmail?.trim()
        : editing.guestEmail?.trim();
    const displayName =
      editing.reservationType === "member"
        ? editing.memberDisplayName || `#${editing.memberNumber}`
        : [editing.guestFirstName, editing.guestLastName].filter(Boolean).join(" ").trim() || "Guest";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
    return { email, displayName };
  }

  async function handleEditPayCash() {
    if (!editing || paymentDueCents == null || paymentDueCents < 1) return;
    const recipient = recipientForEdit();
    if (!recipient) {
      alert("Recipient email required for receipt.");
      return;
    }
    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/members/caretaker/reservations/${editing.id}${apiQs}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkInDate: editCheckIn,
          checkOutDate: editCheckOut,
          paymentMethod: "cash",
          amountCents: paymentDueCents,
          recipientEmail: recipient.email,
          recipientDisplayName: recipient.displayName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Payment failed");
        return;
      }
      closeEdit();
      onUpdated();
    } catch {
      alert("Payment failed");
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleEditPayCard() {
    if (!editing || paymentDueCents == null || paymentDueCents < 1) return;
    const recipient = recipientForEdit();
    if (!recipient) {
      alert("Recipient email required for receipt.");
      return;
    }
    setEditSubmitting(true);
    try {
      const checkoutBody: Record<string, unknown> = {
        amountCents: paymentDueCents,
        paymentType: "reservation",
        reservationId: editing.id,
        recipientEmail: recipient.email,
        recipientDisplayName: recipient.displayName,
        siteId: editing.siteId,
        checkInDate: editCheckIn,
        checkOutDate: editCheckOut,
        nights: editNights,
        reservationType: editing.reservationType,
        campSlug,
      };
      if (editing.reservationType === "member") {
        checkoutBody.memberContactId = editing.memberContactId ?? "";
        checkoutBody.memberNumber = editing.memberNumber ?? "";
        checkoutBody.memberDisplayName = editing.memberDisplayName ?? "";
      } else {
        checkoutBody.guestFirstName = editing.guestFirstName ?? "";
        checkoutBody.guestLastName = editing.guestLastName ?? "";
        checkoutBody.guestEmail = editing.guestEmail ?? "";
        checkoutBody.guestPhone = editing.guestPhone ?? undefined;
      }
      const res = await fetch("/api/members/caretaker/payments/checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checkoutBody),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        alert(data.error ?? "Failed to start checkout");
        return;
      }
      window.location.href = data.url;
    } catch {
      alert("Checkout failed");
    } finally {
      setEditSubmitting(false);
    }
  }

  async function openCancel(row: AdminReservationListRow) {
    if (row.status === "cancelled") return;
    setCancelling(row);
    setCancelPreview(null);
    setCancelPreviewLoading(true);
    try {
      const res = await fetch(
        `/api/members/caretaker/reservations/${row.id}/cancel-preview${apiQs}`
      );
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Could not preview cancellation");
        setCancelling(null);
        return;
      }
      setCancelPreview(data.preview);
    } catch {
      alert("Could not preview cancellation");
      setCancelling(null);
    } finally {
      setCancelPreviewLoading(false);
    }
  }

  async function confirmCancel() {
    if (!cancelling) return;
    setCancelSubmitting(true);
    try {
      const res = await fetch(
        `/api/members/caretaker/reservations/${cancelling.id}/cancel${apiQs}`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Cancel failed");
        return;
      }
      setCancelling(null);
      setCancelPreview(null);
      onUpdated();
    } catch {
      alert("Cancel failed");
    } finally {
      setCancelSubmitting(false);
    }
  }

  if (reservations === undefined) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-[#e8e0d5]/60">
        <Loader2 className="h-4 w-4 animate-spin text-[#d4af37]" />
        Loading reservations…
      </div>
    );
  }

  if (reservations.length === 0) {
    return <p className="py-2 text-sm text-[#e8e0d5]/55">No reservations on record for this camp.</p>;
  }

  return (
    <>
      <div className="overflow-x-auto rounded border border-[#d4af37]/15">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead>
            <tr className="bg-[#1a1208]/80 text-[#d4af37]/90">
              <th className="p-2 font-semibold">Site</th>
              <th className="p-2 font-semibold">Guest / member</th>
              <th className="p-2 font-semibold">Check in</th>
              <th className="p-2 font-semibold">Check out</th>
              <th className="p-2 text-center font-semibold">Nights</th>
              <th className="p-2 font-semibold">Balance</th>
              <th className="p-2 font-semibold">Status</th>
              <th className="p-2 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((r) => (
              <tr key={r.id} className="border-t border-[#d4af37]/10 text-[#e8e0d5]/90">
                <td className="p-2">{r.siteName ?? "—"}</td>
                <td className="p-2">{partyLabel(r)}</td>
                <td className="p-2 tabular-nums">{r.checkInDate.slice(0, 10)}</td>
                <td className="p-2 tabular-nums">{r.checkOutDate.slice(0, 10)}</td>
                <td className="p-2 text-center tabular-nums">{r.nights}</td>
                <td className="p-2 tabular-nums">
                  {(r.balanceDueCents ?? 0) > 0 ? (
                    <span className={r.hasOverdueSiteFee ? "text-amber-400" : "ct-cell-gold"}>
                      {formatCentsAsCurrency(r.balanceDueCents ?? 0)}
                    </span>
                  ) : (
                    <span className="ct-cell-muted">Paid</span>
                  )}
                </td>
                <td className="p-2 capitalize">{r.status.replace(/_/g, " ")}</td>
                <td className="p-2">
                  {r.status !== "cancelled" ? (
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        disabled={editLoading}
                        className="px-2 py-1 text-xs bg-[#d4af37]/20 text-[#d4af37] rounded hover:bg-[#d4af37]/30 disabled:opacity-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => openCancel(r)}
                        className="px-2 py-1 text-xs border border-red-500/40 text-red-300/90 rounded hover:bg-red-950/30"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <span className="text-[#e8e0d5]/40">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-[#d4af37]/10 px-2 py-1.5 text-[11px] text-[#e8e0d5]/45">
          Showing up to 300 reservations, newest checkout first.
        </p>
      </div>

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
          onClick={() => !editSubmitting && closeEdit()}
        >
          <div
            className="bg-[#1a120b] border border-[#d4af37]/30 rounded-xl shadow-xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-[#f0d48f]">
                {paymentDueCents != null ? "Pay for additional nights" : "Edit reservation dates"}
              </h3>
              <button
                type="button"
                onClick={() => !editSubmitting && closeEdit()}
                className="text-[#e8e0d5]/60 hover:text-[#e8e0d5]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-[#e8e0d5]/80 text-sm mb-4">
              {editing.siteName} — {partyLabel(editing)}
            </p>
            {paymentDueCents != null ? (
              <div className="space-y-4">
                <p className="text-[#e8e0d5]">
                  Additional amount due: <strong>{formatCentsAsCurrency(paymentDueCents)}</strong>
                </p>
                <div className="flex gap-2">
                  {editAllowsCash && (
                    <button
                      type="button"
                      onClick={handleEditPayCash}
                      disabled={editSubmitting}
                      className="flex-1 py-2.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {editSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Pay cash
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleEditPayCard}
                    disabled={editSubmitting}
                    className="flex-1 py-2.5 bg-[#2a1f14] border border-[#d4af37]/50 text-[#f0d48f] font-semibold rounded-lg hover:bg-[#d4af37]/10 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {editSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Pay card
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setPaymentDueCents(null)}
                  className="w-full py-2.5 text-[#e8e0d5]/80 hover:text-[#d4af37]"
                >
                  Back to dates
                </button>
              </div>
            ) : (
              <form onSubmit={handleEditSubmit}>
                <label className="block text-sm font-medium text-[#e8e0d5] mb-2">Check-in date</label>
                <input
                  type="date"
                  value={editCheckIn}
                  onChange={(e) => setEditCheckIn(e.target.value)}
                  min={earliestCheckIn}
                  className="w-full px-4 py-2.5 bg-[#0f0a06] border border-[#d4af37]/30 rounded-lg text-[#e8e0d5]"
                />
                <label className="block text-sm font-medium text-[#e8e0d5] mb-2 mt-3">Check-out date</label>
                <input
                  type="date"
                  value={editCheckOut}
                  onChange={(e) => setEditCheckOut(e.target.value)}
                  min={editCheckIn || today}
                  className="w-full px-4 py-2.5 bg-[#0f0a06] border border-[#d4af37]/30 rounded-lg text-[#e8e0d5]"
                />
                <p className="text-[#e8e0d5]/50 text-xs mb-4 mt-2">
                  Shortening the stay does not issue a refund. Extending requires paying the difference.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={closeEdit}
                    className="flex-1 py-2.5 text-[#e8e0d5]/80 hover:text-[#d4af37]"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={
                      editSubmitting ||
                      !editCheckIn ||
                      !editCheckOut ||
                      editCheckIn >= editCheckOut
                    }
                    className="flex-1 py-2.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {editSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {cancelling && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
          onClick={() => !cancelSubmitting && (setCancelling(null), setCancelPreview(null))}
        >
          <div
            className="bg-[#1a120b] border border-[#d4af37]/30 rounded-xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-[#f0d48f]">Cancel reservation</h3>
              <button
                type="button"
                onClick={() =>
                  !cancelSubmitting && (setCancelling(null), setCancelPreview(null))
                }
                className="text-[#e8e0d5]/60 hover:text-[#e8e0d5]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-[#e8e0d5]/90 text-sm mb-3">
              Cancel {cancelling.siteName} — {partyLabel(cancelling)}?
            </p>
            {cancelPreviewLoading ? (
              <div className="flex items-center gap-2 text-[#e8e0d5]/70 text-sm mb-4">
                <Loader2 className="w-4 h-4 animate-spin" /> Calculating refund…
              </div>
            ) : cancelPreview ? (
              <div className="bg-[#0f0a06]/80 border border-[#d4af37]/15 rounded-lg p-3 mb-4 text-sm space-y-1.5">
                <div className="flex justify-between text-[#e8e0d5]/80">
                  <span>Site fees paid</span>
                  <span>{formatCentsAsCurrency(cancelPreview.totalPaidCents)}</span>
                </div>
                <div className="flex justify-between text-[#f0d48f] font-medium">
                  <span>Refund</span>
                  <span>{formatCentsAsCurrency(cancelPreview.refundCents)}</span>
                </div>
              </div>
            ) : null}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => (setCancelling(null), setCancelPreview(null))}
                disabled={cancelSubmitting}
                className="flex-1 py-2.5 text-[#e8e0d5]/80 hover:text-[#d4af37]"
              >
                Keep reservation
              </button>
              <button
                type="button"
                onClick={confirmCancel}
                disabled={cancelSubmitting || cancelPreviewLoading}
                className="flex-1 py-2.5 bg-red-900/60 border border-red-500/40 text-red-100 font-semibold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {cancelSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
