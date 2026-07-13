"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { caretakerAllowsCashCheckIn, caretakerEarliestCheckInDate, caretakerEarliestCheckInDateForEdit } from "@/lib/reservation-camps";
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
  cancellationFeeWaived?: boolean;
  cancellationFeeWaivedCents?: number | null;
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
  cancellationFeeCents: number;
  policyCancellationFeeCents: number;
  cancellationFeeWaived: boolean;
};

type MoveSite = {
  id: string;
  name: string;
  siteType: string;
};

type MovePreview = {
  newSiteId: string;
  newSiteName: string;
  sameSite: boolean;
  available: boolean;
  currentTotalCents: number;
  newTotalCents: number;
  netPaidCents: number;
  additionalDueCents: number;
  refundCents: number;
  refundBreakdown: { stripeRefundCents: number; cashRefundCents: number };
  cashAllowed: boolean;
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
  const [editPreview, setEditPreview] = useState<{
    available: boolean;
    datesUnchanged: boolean;
    current: {
      checkInDate: string;
      checkOutDate: string;
      nights: number;
      totalCents: number;
      pricingBasis: string;
    };
    proposed: {
      checkInDate: string;
      checkOutDate: string;
      nights: number;
      totalCents: number;
      pricingBasis: string;
    };
    netPaidCents: number;
    additionalDueCents: number;
    creditCents: number;
    refundBreakdown: { stripeRefundCents: number; cashRefundCents: number };
  } | null>(null);
  const [editPreviewLoading, setEditPreviewLoading] = useState(false);
  const [editPreviewError, setEditPreviewError] = useState<string | null>(null);
  const [editIssueRefund, setEditIssueRefund] = useState(false);

  const [cancelling, setCancelling] = useState<AdminReservationListRow | null>(null);
  const [cancelPreview, setCancelPreview] = useState<CancelPreview | null>(null);
  const [cancelPreviewLoading, setCancelPreviewLoading] = useState(false);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelWaiveFee, setCancelWaiveFee] = useState(false);

  const [moving, setMoving] = useState<ReservationDetail | null>(null);
  const [moveSites, setMoveSites] = useState<MoveSite[]>([]);
  const [moveNewSiteId, setMoveNewSiteId] = useState("");
  const [movePreview, setMovePreview] = useState<MovePreview | null>(null);
  const [movePreviewLoading, setMovePreviewLoading] = useState(false);
  const [moveSubmitting, setMoveSubmitting] = useState(false);
  const [movePaymentDue, setMovePaymentDue] = useState<number | null>(null);
  const [moveCashAllowed, setMoveCashAllowed] = useState(false);
  const [moveMemberEmail, setMoveMemberEmail] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  const editCheckInMin = editing
    ? caretakerEarliestCheckInDateForEdit(toDateOnly(editing.checkInDate), today)
    : earliestCheckIn;

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
    setEditPreview(null);
    setEditPreviewError(null);
    setEditIssueRefund(false);
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
    setEditPreview(null);
    setEditPreviewError(null);
    setEditIssueRefund(false);
  }

  function pricingBasisLabel(basis: string): string {
    if (basis === "member_monthly_prorated") return "Monthly (prorated)";
    if (basis === "member_daily") return "Daily member rate";
    if (basis === "guest_daily") return "Daily guest rate";
    return basis;
  }

  async function handleEditPreview(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setEditPreviewLoading(true);
    setEditPreviewError(null);
    setEditPreview(null);
    setEditIssueRefund(false);
    try {
      const params = new URLSearchParams({
        checkInDate: editCheckIn,
        checkOutDate: editCheckOut,
      });
      const res = await fetch(
        `/api/members/caretaker/reservations/${editing.id}/edit-preview${apiQs}&${params}`
      );
      const data = await res.json();
      if (!res.ok) {
        setEditPreviewError(data.error ?? "Could not preview date change");
        return;
      }
      setEditPreview(data);
      setEditIssueRefund(false);
    } catch {
      setEditPreviewError("Could not preview date change");
    } finally {
      setEditPreviewLoading(false);
    }
  }

  async function handleEditConfirmSave() {
    if (!editing || !editPreview) return;
    if (!editPreview.available) {
      setEditPreviewError("Site is not available for the new dates");
      return;
    }
    setEditSubmitting(true);
    setPaymentDueCents(null);
    setEditPreviewError(null);
    try {
      const res = await fetch(`/api/members/caretaker/reservations/${editing.id}${apiQs}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkInDate: editCheckIn,
          checkOutDate: editCheckOut,
          issueRefund: editIssueRefund && editPreview.creditCents > 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.requirePayment && typeof data.amountDueCents === "number") {
          setPaymentDueCents(data.amountDueCents);
          return;
        }
        setEditPreviewError(data.error ?? "Update failed");
        return;
      }
      closeEdit();
      onUpdated();
    } catch {
      setEditPreviewError("Update failed");
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
    setCancelWaiveFee(false);
    await refreshCancelPreview(row.id, false);
  }

  async function refreshCancelPreview(reservationId: string, waiveCancellationFee: boolean) {
    setCancelPreviewLoading(true);
    try {
      const waiveQ = waiveCancellationFee
        ? `${apiQs.includes("?") ? "&" : "?"}waiveCancellationFee=1`
        : "";
      const res = await fetch(
        `/api/members/caretaker/reservations/${reservationId}/cancel-preview${apiQs}${waiveQ}`
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
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ waiveCancellationFee: cancelWaiveFee }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Cancel failed");
        return;
      }
      setCancelling(null);
      setCancelPreview(null);
      setCancelWaiveFee(false);
      onUpdated();
    } catch {
      alert("Cancel failed");
    } finally {
      setCancelSubmitting(false);
    }
  }

  async function openMove(row: AdminReservationListRow) {
    if (row.status === "cancelled") return;
    setEditLoading(true);
    setMoveNewSiteId("");
    setMovePreview(null);
    setMovePaymentDue(null);
    setMoveError(null);
    setMoveMemberEmail(null);
    try {
      const [detailRes, sitesRes] = await Promise.all([
        fetch(`/api/members/caretaker/reservations/${row.id}${apiQs}`),
        fetch(`/api/members/caretaker/admin/sites${apiQs}`),
      ]);
      const detailData = await detailRes.json();
      if (!detailRes.ok) {
        alert(detailData.error ?? "Failed to load reservation");
        return;
      }
      const sitesData = await sitesRes.json().catch(() => ({}));
      const detail: ReservationDetail = {
        ...row,
        siteId: detailData.siteId,
        memberContactId: detailData.memberContactId ?? null,
        guestPhone: detailData.guestPhone ?? null,
      };
      const allSites = (Array.isArray(sitesData.sites) ? sitesData.sites : []) as MoveSite[];
      setMoveSites(allSites.filter((s) => s.id !== detailData.siteId));
      setMoving(detail);
      if (row.reservationType === "member" && row.memberNumber) {
        fetch("/api/members/caretaker/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memberNumber: row.memberNumber }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((lookup) => setMoveMemberEmail(lookup?.email?.trim() || null))
          .catch(() => setMoveMemberEmail(null));
      }
    } catch {
      alert("Failed to load reservation");
    } finally {
      setEditLoading(false);
    }
  }

  function closeMove() {
    setMoving(null);
    setMovePreview(null);
    setMovePaymentDue(null);
    setMoveError(null);
  }

  async function loadMovePreview(newSiteId: string) {
    if (!moving || !newSiteId) return;
    setMovePreviewLoading(true);
    setMovePreview(null);
    setMovePaymentDue(null);
    setMoveError(null);
    try {
      const res = await fetch(
        `/api/members/caretaker/reservations/${moving.id}/move-preview${apiQs}&newSiteId=${encodeURIComponent(newSiteId)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setMoveError(data.error ?? "Could not preview move");
        return;
      }
      setMovePreview(data as MovePreview);
    } catch {
      setMoveError("Could not preview move");
    } finally {
      setMovePreviewLoading(false);
    }
  }

  function moveRecipient() {
    if (!moving) return null;
    const email =
      moving.reservationType === "member"
        ? moveMemberEmail?.trim() || moving.guestEmail?.trim()
        : moving.guestEmail?.trim();
    const displayName =
      moving.reservationType === "member"
        ? moving.memberDisplayName || `#${moving.memberNumber}`
        : [moving.guestFirstName, moving.guestLastName].filter(Boolean).join(" ").trim() || "Guest";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
    return { email, displayName };
  }

  async function confirmMove() {
    if (!moving || !movePreview || !movePreview.available) return;
    setMoveSubmitting(true);
    setMoveError(null);
    try {
      const res = await fetch(`/api/members/caretaker/reservations/${moving.id}/move${apiQs}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newSiteId: movePreview.newSiteId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMoveError(data.error ?? "Move failed");
        return;
      }
      if (data.requirePayment && typeof data.amountDueCents === "number") {
        setMovePaymentDue(data.amountDueCents);
        setMoveCashAllowed(Boolean(data.cashAllowed));
        return;
      }
      closeMove();
      onUpdated();
    } catch {
      setMoveError("Move failed");
    } finally {
      setMoveSubmitting(false);
    }
  }

  async function handleMovePayCash() {
    if (!moving || !movePreview || movePaymentDue == null || movePaymentDue < 1) return;
    const recipient = moveRecipient();
    if (!recipient) {
      setMoveError("Recipient email required for receipt.");
      return;
    }
    setMoveSubmitting(true);
    setMoveError(null);
    try {
      const res = await fetch(`/api/members/caretaker/reservations/${moving.id}/move${apiQs}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newSiteId: movePreview.newSiteId,
          paymentMethod: "cash",
          amountCents: movePaymentDue,
          recipientEmail: recipient.email,
          recipientDisplayName: recipient.displayName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMoveError(data.error ?? "Payment failed");
        return;
      }
      closeMove();
      onUpdated();
    } catch {
      setMoveError("Payment failed");
    } finally {
      setMoveSubmitting(false);
    }
  }

  async function handleMovePayCard() {
    if (!moving || !movePreview || movePaymentDue == null || movePaymentDue < 1) return;
    const recipient = moveRecipient();
    if (!recipient) {
      setMoveError("Recipient email required for receipt.");
      return;
    }
    setMoveSubmitting(true);
    setMoveError(null);
    try {
      const checkoutBody: Record<string, unknown> = {
        amountCents: movePaymentDue,
        paymentType: "reservation",
        reservationId: moving.id,
        recipientEmail: recipient.email,
        recipientDisplayName: recipient.displayName,
        siteId: movePreview.newSiteId,
        checkInDate: toDateOnly(moving.checkInDate),
        checkOutDate: toDateOnly(moving.checkOutDate),
        nights: countNights(toDateOnly(moving.checkInDate), toDateOnly(moving.checkOutDate)),
        reservationType: moving.reservationType,
        campSlug,
      };
      if (moving.reservationType === "member") {
        checkoutBody.memberContactId = moving.memberContactId ?? "";
        checkoutBody.memberNumber = moving.memberNumber ?? "";
        checkoutBody.memberDisplayName = moving.memberDisplayName ?? "";
      } else {
        checkoutBody.guestFirstName = moving.guestFirstName ?? "";
        checkoutBody.guestLastName = moving.guestLastName ?? "";
        checkoutBody.guestEmail = moving.guestEmail ?? "";
        checkoutBody.guestPhone = moving.guestPhone ?? undefined;
      }
      const res = await fetch("/api/members/caretaker/payments/checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checkoutBody),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setMoveError(data.error ?? "Failed to start checkout");
        return;
      }
      window.location.href = data.url;
    } catch {
      setMoveError("Checkout failed");
    } finally {
      setMoveSubmitting(false);
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
                <td className="p-2 capitalize">
                  {r.status.replace(/_/g, " ")}
                  {r.cancellationFeeWaived ? (
                    <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-200 normal-case">
                      Cancel fee waived
                    </span>
                  ) : null}
                </td>
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
                        onClick={() => openMove(r)}
                        disabled={editLoading}
                        className="px-2 py-1 text-xs bg-[#2a1f14] border border-[#d4af37]/40 text-[#f0d48f] rounded hover:bg-[#d4af37]/10 disabled:opacity-50"
                      >
                        Move site
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
          className="bg-[#1a120b] border border-[#d4af37]/30 rounded-xl shadow-xl max-w-md w-full p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-[#f0d48f]">
                {paymentDueCents != null
                  ? "Pay for additional nights"
                  : editPreview
                    ? "Review date change"
                    : "Edit reservation dates"}
              </h3>
              <button
                type="button"
                onClick={() => !editSubmitting && !editPreviewLoading && closeEdit()}
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
                  onClick={() => { setPaymentDueCents(null); setEditPreview(null); }}
                  className="w-full py-2.5 text-[#e8e0d5]/80 hover:text-[#d4af37]"
                >
                  Back to dates
                </button>
              </div>
            ) : editPreview ? (
              <div className="space-y-4">
                <div className="bg-[#0f0a06]/80 border border-[#d4af37]/15 rounded-lg p-3 text-sm space-y-1.5">
                  <div className="flex justify-between text-[#e8e0d5]/80">
                    <span>Current</span>
                    <span>
                      {editPreview.current.nights} nights · {formatCentsAsCurrency(editPreview.current.totalCents)}
                    </span>
                  </div>
                  <p className="text-[#e8e0d5]/50 text-xs">
                    {editPreview.current.checkInDate} → {editPreview.current.checkOutDate} ·{" "}
                    {pricingBasisLabel(editPreview.current.pricingBasis)}
                  </p>
                  <div className="flex justify-between text-[#f0d48f] font-medium pt-1 border-t border-[#d4af37]/20">
                    <span>New total</span>
                    <span>
                      {editPreview.proposed.nights} nights · {formatCentsAsCurrency(editPreview.proposed.totalCents)}
                    </span>
                  </div>
                  <p className="text-[#e8e0d5]/50 text-xs">
                    {editPreview.proposed.checkInDate} → {editPreview.proposed.checkOutDate} ·{" "}
                    {pricingBasisLabel(editPreview.proposed.pricingBasis)}
                  </p>
                  <div className="flex justify-between text-[#e8e0d5]/80 pt-1">
                    <span>Already paid</span>
                    <span>{formatCentsAsCurrency(editPreview.netPaidCents)}</span>
                  </div>
                  {editPreview.additionalDueCents > 0 && (
                    <div className="flex justify-between text-amber-200 font-medium">
                      <span>Amount due</span>
                      <span>{formatCentsAsCurrency(editPreview.additionalDueCents)}</span>
                    </div>
                  )}
                  {editPreview.creditCents > 0 && (
                    <div className="flex justify-between text-[#6dd472] font-medium">
                      <span>Credit / refund available</span>
                      <span>{formatCentsAsCurrency(editPreview.creditCents)}</span>
                    </div>
                  )}
                  {editPreview.creditCents > 0 && (
                    <p className="text-[#e8e0d5]/50 text-xs pt-1">
                      {editPreview.refundBreakdown.stripeRefundCents > 0 &&
                        `Card: ${formatCentsAsCurrency(editPreview.refundBreakdown.stripeRefundCents)}`}
                      {editPreview.refundBreakdown.stripeRefundCents > 0 &&
                        editPreview.refundBreakdown.cashRefundCents > 0 &&
                        " · "}
                      {editPreview.refundBreakdown.cashRefundCents > 0 &&
                        `Cash: ${formatCentsAsCurrency(editPreview.refundBreakdown.cashRefundCents)}`}
                    </p>
                  )}
                </div>
                {!editPreview.available && (
                  <p className="text-red-400 text-sm">Site is not available for these dates.</p>
                )}
                {editPreview.creditCents > 0 && (
                  <label className="flex items-start gap-2 text-sm text-[#e8e0d5]/90 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={editIssueRefund}
                      disabled={editSubmitting}
                      onChange={(e) => setEditIssueRefund(e.target.checked)}
                    />
                    <span>
                      Issue refund of {formatCentsAsCurrency(editPreview.creditCents)} on save
                      {editPreview.refundBreakdown.stripeRefundCents > 0
                        ? " (card first, then cash)"
                        : " (cash)"}
                      .
                    </span>
                  </label>
                )}
                {editPreview.creditCents > 0 && !editIssueRefund && (
                  <p className="text-[#e8e0d5]/50 text-xs">
                    If unchecked, the credit stays on the reservation (no refund issued).
                  </p>
                )}
                {editPreviewError && <p className="text-red-400 text-sm">{editPreviewError}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditPreview(null);
                      setEditPreviewError(null);
                      setEditIssueRefund(false);
                    }}
                    disabled={editSubmitting}
                    className="flex-1 py-2.5 text-[#e8e0d5]/80 hover:text-[#d4af37]"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleEditConfirmSave}
                    disabled={
                      editSubmitting ||
                      !editPreview.available ||
                      editPreview.datesUnchanged
                    }
                    className="flex-1 py-2.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {editSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Confirm save
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleEditPreview}>
                <label className="block text-sm font-medium text-[#e8e0d5] mb-2">Check-in date</label>
                <input
                  type="date"
                  value={editCheckIn}
                  onChange={(e) => {
                    setEditCheckIn(e.target.value);
                    setEditPreview(null);
                    setEditPreviewError(null);
                  }}
                  min={editCheckInMin}
                  className="w-full px-4 py-2.5 bg-[#0f0a06] border border-[#d4af37]/30 rounded-lg text-[#e8e0d5]"
                />
                <label className="block text-sm font-medium text-[#e8e0d5] mb-2 mt-3">Check-out date</label>
                <input
                  type="date"
                  value={editCheckOut}
                  onChange={(e) => {
                    setEditCheckOut(e.target.value);
                    setEditPreview(null);
                    setEditPreviewError(null);
                  }}
                  min={editCheckIn || today}
                  className="w-full px-4 py-2.5 bg-[#0f0a06] border border-[#d4af37]/30 rounded-lg text-[#e8e0d5]"
                />
                <p className="text-[#e8e0d5]/50 text-xs mb-4 mt-2">
                  Preview the rerate before saving. Shortening does not auto-refund.
                </p>
                {editPreviewError && <p className="mb-3 text-red-400 text-sm">{editPreviewError}</p>}
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
                      editPreviewLoading ||
                      !editCheckIn ||
                      !editCheckOut ||
                      editCheckIn >= editCheckOut
                    }
                    className="flex-1 py-2.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {editPreviewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Preview
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {moving && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
          onClick={() => !moveSubmitting && closeMove()}
        >
          <div
            className="bg-[#1a120b] border border-[#d4af37]/30 rounded-xl shadow-xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-[#f0d48f]">
                {movePaymentDue != null ? "Charge site difference" : "Move to a different site"}
              </h3>
              <button
                type="button"
                onClick={() => !moveSubmitting && closeMove()}
                className="text-[#e8e0d5]/60 hover:text-[#e8e0d5]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-[#e8e0d5]/80 text-sm mb-4">
              {moving.siteName} — {partyLabel(moving)} · {toDateOnly(moving.checkInDate)} → {toDateOnly(moving.checkOutDate)}
            </p>

            {movePaymentDue != null ? (
              <div className="space-y-4">
                <p className="text-[#e8e0d5]">
                  Additional amount due: <strong>{formatCentsAsCurrency(movePaymentDue)}</strong>
                </p>
                {moveError && <p className="text-red-300 text-sm">{moveError}</p>}
                <div className="flex gap-2">
                  {moveCashAllowed && (
                    <button
                      type="button"
                      onClick={handleMovePayCash}
                      disabled={moveSubmitting}
                      className="flex-1 py-2.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {moveSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Pay cash
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleMovePayCard}
                    disabled={moveSubmitting}
                    className="flex-1 py-2.5 bg-[#2a1f14] border border-[#d4af37]/50 text-[#f0d48f] font-semibold rounded-lg hover:bg-[#d4af37]/10 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {moveSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Pay card
                  </button>
                </div>
                <p className="text-[#e8e0d5]/50 text-xs">The reservation has already been moved. Collect the difference to settle the balance.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#e8e0d5] mb-2">Destination site</label>
                  <select
                    value={moveNewSiteId}
                    onChange={(e) => {
                      setMoveNewSiteId(e.target.value);
                      if (e.target.value) loadMovePreview(e.target.value);
                      else setMovePreview(null);
                    }}
                    className="w-full px-4 py-2.5 bg-[#0f0a06] border border-[#d4af37]/30 rounded-lg text-[#e8e0d5]"
                  >
                    <option value="">Select a site…</option>
                    {moveSites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                        {s.siteType ? ` (${s.siteType})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {movePreviewLoading ? (
                  <div className="flex items-center gap-2 text-[#e8e0d5]/70 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" /> Checking availability & price…
                  </div>
                ) : movePreview ? (
                  <div className="bg-[#0f0a06]/80 border border-[#d4af37]/15 rounded-lg p-3 text-sm space-y-1.5">
                    {!movePreview.available ? (
                      <p className="text-red-300">Not available for these dates. Pick another site.</p>
                    ) : (
                      <>
                        <div className="flex justify-between text-[#e8e0d5]/80">
                          <span>New stay total</span>
                          <span>{formatCentsAsCurrency(movePreview.newTotalCents)}</span>
                        </div>
                        <div className="flex justify-between text-[#e8e0d5]/80">
                          <span>Paid so far</span>
                          <span>{formatCentsAsCurrency(movePreview.netPaidCents)}</span>
                        </div>
                        {movePreview.additionalDueCents > 0 ? (
                          <div className="flex justify-between text-amber-400 font-medium pt-1 border-t border-[#d4af37]/20">
                            <span>Additional to collect</span>
                            <span>{formatCentsAsCurrency(movePreview.additionalDueCents)}</span>
                          </div>
                        ) : movePreview.refundCents > 0 ? (
                          <div className="flex justify-between text-[#6dd472] font-medium pt-1 border-t border-[#d4af37]/20">
                            <span>Refund on move</span>
                            <span>{formatCentsAsCurrency(movePreview.refundCents)}</span>
                          </div>
                        ) : (
                          <div className="flex justify-between text-[#6dd472] font-medium pt-1 border-t border-[#d4af37]/20">
                            <span>No price change</span>
                            <span>$0.00</span>
                          </div>
                        )}
                        {movePreview.refundCents > 0 && movePreview.refundBreakdown.stripeRefundCents > 0 && (
                          <p className="text-[#e8e0d5]/50 text-xs">
                            {formatCentsAsCurrency(movePreview.refundBreakdown.stripeRefundCents)} back to card
                            {movePreview.refundBreakdown.cashRefundCents > 0
                              ? ` · ${formatCentsAsCurrency(movePreview.refundBreakdown.cashRefundCents)} cash`
                              : ""}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                ) : null}

                {moveError && <p className="text-red-300 text-sm">{moveError}</p>}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={closeMove}
                    className="flex-1 py-2.5 text-[#e8e0d5]/80 hover:text-[#d4af37]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmMove}
                    disabled={
                      moveSubmitting ||
                      movePreviewLoading ||
                      !movePreview ||
                      !movePreview.available
                    }
                    className="flex-1 py-2.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {moveSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {movePreview && movePreview.refundCents > 0 ? "Move & refund" : "Move site"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {cancelling && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
          onClick={() => !cancelSubmitting && (setCancelling(null), setCancelPreview(null), setCancelWaiveFee(false))}
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
                  !cancelSubmitting && (setCancelling(null), setCancelPreview(null), setCancelWaiveFee(false))
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
                {cancelPreview.earnedCents > 0 && (
                  <div className="flex justify-between text-[#e8e0d5]/80">
                    <span>Earned ({cancelPreview.nightsStayed} nights)</span>
                    <span>−{formatCentsAsCurrency(cancelPreview.earnedCents)}</span>
                  </div>
                )}
                {cancelPreview.policyCancellationFeeCents > 0 && (
                  <div
                    className={`flex justify-between ${cancelPreview.cancellationFeeWaived ? "text-[#e8e0d5]/50 line-through" : "text-[#e8e0d5]/80"}`}
                  >
                    <span>Cancellation fee</span>
                    <span>−{formatCentsAsCurrency(cancelPreview.policyCancellationFeeCents)}</span>
                  </div>
                )}
                {cancelPreview.cancellationFeeWaived && (
                  <p className="text-amber-200/90 text-xs">Cancellation fee waived by caretaker.</p>
                )}
                <div className="flex justify-between text-[#f0d48f] font-medium">
                  <span>Refund</span>
                  <span>{formatCentsAsCurrency(cancelPreview.refundCents)}</span>
                </div>
              </div>
            ) : null}
            {(cancelPreview?.policyCancellationFeeCents ?? 0) > 0 && (
              <label className="mb-4 flex items-start gap-2 text-sm text-[#e8e0d5]/90 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={cancelWaiveFee}
                  disabled={cancelSubmitting || cancelPreviewLoading}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setCancelWaiveFee(next);
                    if (cancelling) void refreshCancelPreview(cancelling.id, next);
                  }}
                />
                <span>
                  Waive cancellation fee ({formatCentsAsCurrency(cancelPreview?.policyCancellationFeeCents ?? 0)}).
                  This will be flagged on the reservation.
                </span>
              </label>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => (setCancelling(null), setCancelPreview(null), setCancelWaiveFee(false))}
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
