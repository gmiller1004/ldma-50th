"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Loader2, Calendar, User, UserPlus, X, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isBefore,
  isAfter,
  parseISO,
  isSameDay,
  getDay,
} from "date-fns";
import { campUsesReservations } from "@/lib/reservation-camps";

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

type GuestCheckIn = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
};

type Site = {
  id: string;
  name: string;
  siteType: string;
  sortOrder: number;
  memberRateDaily: number | null;
  nonMemberRateDaily: number | null;
};

type Reservation = {
  id: string;
  siteId: string;
  siteName: string | null;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  reservationType: string;
  memberNumber: string | null;
  memberDisplayName: string | null;
  guestFirstName: string | null;
  guestLastName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  status: string;
  checkedInAt: string | null;
};

function formatCurrency(val: number | null | undefined): string {
  if (val == null || Number.isNaN(val)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);
}

/** Normalize API date (YYYY-MM-DD or ISO timestamp) to YYYY-MM-DD for display. */
function toDateOnly(dateStr: string): string {
  if (dateStr == null || typeof dateStr !== "string") return String(dateStr ?? "");
  const part = dateStr.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(part) ? part : dateStr;
}

/** Parse YYYY-MM-DD as local date (avoids timezone shifting display by one day). */
function parseLocalDate(dateStr: string): Date {
  const normalized = toDateOnly(dateStr);
  const [y, m, d] = normalized.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Small calendar-tile style display for a date (e.g. "FEB" / "26"). */
function DateTile({ dateStr }: { dateStr: string }) {
  let month = "";
  let day = "";
  try {
    const d = parseLocalDate(dateStr);
    month = format(d, "MMM").toUpperCase();
    day = format(d, "d");
  } catch {
    return <span className="text-[#e8e0d5]/60">{dateStr}</span>;
  }
  return (
    <span className="inline-flex flex-col items-center justify-center w-11 rounded border border-[#d4af37]/30 bg-[#0f0a06]/80 text-center leading-tight">
      <span className="text-[10px] font-medium text-[#d4af37]/90">{month}</span>
      <span className="text-base font-semibold text-[#e8e0d5]">{day}</span>
    </span>
  );
}

/** Date range as two calendar tiles (start → end). */
function ReservationDateRange({ checkInDate, checkOutDate, nights }: { checkInDate: string; checkOutDate: string; nights: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <DateTile dateStr={toDateOnly(checkInDate)} />
      <span className="text-[#d4af37]/60">→</span>
      <DateTile dateStr={toDateOnly(checkOutDate)} />
      <span className="text-[#e8e0d5]/50 text-sm ml-1">({nights} night{nights !== 1 ? "s" : ""})</span>
    </span>
  );
}

/** Date input with popover calendar; min/max in YYYY-MM-DD. */
function DatePickerWithCalendar({
  value,
  onChange,
  min,
  max,
  placeholder = "Select date",
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [viewingMonth, setViewingMonth] = useState(() => {
    if (value) return parseISO(value);
    if (min) return parseISO(min);
    return new Date();
  });
  const ref = useRef<HTMLDivElement>(null);

  const minDate = min ? parseISO(min) : null;
  const maxDate = max ? parseISO(max) : null;
  const start = startOfMonth(viewingMonth);
  const end = endOfMonth(viewingMonth);
  const days = eachDayOfInterval({ start, end });
  const firstDow = getDay(start); // 0 = Sunday

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, [open]);

  const select = (d: Date) => {
    onChange(format(d, "yyyy-MM-dd"));
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <div className="flex gap-1">
        <input
          id={id}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min={min}
          max={max}
          placeholder={placeholder}
          className="flex-1 px-4 py-2.5 bg-[#0f0a06] border border-[#d4af37]/30 rounded-lg text-[#e8e0d5]"
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="px-3 py-2.5 bg-[#0f0a06] border border-[#d4af37]/30 rounded-lg text-[#d4af37] hover:bg-[#d4af37]/10"
          aria-label="Open calendar"
        >
          <Calendar className="w-5 h-5" />
        </button>
      </div>
      {open && (
        <div className="absolute z-50 mt-1 left-0 p-3 rounded-lg border border-[#d4af37]/30 bg-[#1a120b] shadow-xl min-w-[260px]">
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => setViewingMonth((m) => subMonths(m, 1))} className="p-1 text-[#e8e0d5]/80 hover:text-[#d4af37]">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-medium text-[#f0d48f]">{format(viewingMonth, "MMMM yyyy")}</span>
            <button type="button" onClick={() => setViewingMonth((m) => addMonths(m, 1))} className="p-1 text-[#e8e0d5]/80 hover:text-[#d4af37]">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-xs text-[#e8e0d5]/60 mb-1">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: firstDow }, (_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {days.map((d) => {
              const disabled = !!(minDate && isBefore(d, minDate)) || !!(maxDate && isAfter(d, maxDate));
              const selected = value && isSameDay(d, parseISO(value));
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  disabled={disabled}
                  onClick={() => !disabled && select(d)}
                  className={`w-8 h-8 rounded text-sm ${disabled ? "text-[#e8e0d5]/30 cursor-not-allowed" : "text-[#e8e0d5] hover:bg-[#d4af37]/20"} ${selected ? "bg-[#d4af37]/40 font-semibold" : ""}`}
                >
                  {format(d, "d")}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
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

  // Guest check-in
  const [activeGuestCheckIns, setActiveGuestCheckIns] = useState<GuestCheckIn[]>([]);
  const [archivedGuestCheckIns, setArchivedGuestCheckIns] = useState<GuestCheckIn[]>([]);
  const [guestCheckInModalOpen, setGuestCheckInModalOpen] = useState(false);
  const [guestFirstName, setGuestFirstName] = useState("");
  const [guestLastName, setGuestLastName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestNightsInput, setGuestNightsInput] = useState("1");
  const [guestCheckInSubmitting, setGuestCheckInSubmitting] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);
  const [editingGuestCheckIn, setEditingGuestCheckIn] = useState<GuestCheckIn | null>(null);
  const [guestEditModalOpen, setGuestEditModalOpen] = useState(false);
  const [newGuestCheckOutDate, setNewGuestCheckOutDate] = useState("");
  const [guestEditSubmitting, setGuestEditSubmitting] = useState(false);
  const [cancellingGuestCheckIn, setCancellingGuestCheckIn] = useState<GuestCheckIn | null>(null);
  const [guestCancelModalOpen, setGuestCancelModalOpen] = useState(false);
  const [guestCancelSubmitting, setGuestCancelSubmitting] = useState(false);

  // Reservation system (Burnt River)
  const [sites, setSites] = useState<Site[]>([]);
  const [activeReservations, setActiveReservations] = useState<Reservation[]>([]);
  const [archivedReservations, setArchivedReservations] = useState<Reservation[]>([]);
  const [reservationsLoading, setReservationsLoading] = useState(false);
  const [createResModalOpen, setCreateResModalOpen] = useState(false);
  const [resCheckInDate, setResCheckInDate] = useState("");
  const [resCheckOutDate, setResCheckOutDate] = useState("");
  const [resSiteId, setResSiteId] = useState("");
  const [resType, setResType] = useState<"member" | "guest">("member");
  const [resMemberNumber, setResMemberNumber] = useState("");
  const [resMemberLookup, setResMemberLookup] = useState<LookupResult | null>(null);
  const [resMemberLookupLoading, setResMemberLookupLoading] = useState(false);
  const [resGuestFirstName, setResGuestFirstName] = useState("");
  const [resGuestLastName, setResGuestLastName] = useState("");
  const [resGuestEmail, setResGuestEmail] = useState("");
  const [resGuestPhone, setResGuestPhone] = useState("");
  const [resSubmitting, setResSubmitting] = useState(false);
  const [resError, setResError] = useState<string | null>(null);
  const [availableSiteIds, setAvailableSiteIds] = useState<string[]>([]);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [resEditModalOpen, setResEditModalOpen] = useState(false);
  const [resEditCheckInDate, setResEditCheckInDate] = useState("");
  const [resEditCheckOutDate, setResEditCheckOutDate] = useState("");
  const [resEditSubmitting, setResEditSubmitting] = useState(false);
  const [cancellingReservation, setCancellingReservation] = useState<Reservation | null>(null);
  const [resCancelModalOpen, setResCancelModalOpen] = useState(false);
  const [resCancelSubmitting, setResCancelSubmitting] = useState(false);
  const [checkingInReservation, setCheckingInReservation] = useState<Reservation | null>(null);
  const [resCheckInSubmitting, setResCheckInSubmitting] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsReservation, setDetailsReservation] = useState<Reservation | null>(null);
  const [detailsMemberLookup, setDetailsMemberLookup] = useState<LookupResult | null>(null);
  const [detailsMemberLoading, setDetailsMemberLoading] = useState(false);

  function loadCheckIns() {
    setListLoading(true);
    Promise.all([
      fetch("/api/members/caretaker/check-ins?status=active").then((r) => r.json()),
      fetch("/api/members/caretaker/check-ins?status=archived").then((r) => r.json()),
      fetch("/api/members/caretaker/guest-check-ins?status=active").then((r) => r.json()),
      fetch("/api/members/caretaker/guest-check-ins?status=archived").then((r) => r.json()),
    ])
      .then(([activeRes, archivedRes, guestActiveRes, guestArchivedRes]) => {
        setActiveCheckIns(activeRes.checkIns ?? []);
        setArchivedCheckIns(archivedRes.checkIns ?? []);
        setActiveGuestCheckIns(guestActiveRes.checkIns ?? []);
        setArchivedGuestCheckIns(guestArchivedRes.checkIns ?? []);
      })
      .catch(() => {})
      .finally(() => setListLoading(false));
  }

  useEffect(() => {
    loadCheckIns();
  }, []);

  const usesReservations = campUsesReservations(campSlug);

  function loadSites() {
    if (!usesReservations) return;
    fetch("/api/members/caretaker/sites")
      .then((r) => r.json())
      .then((data) => setSites(data.sites ?? []))
      .catch(() => setSites([]));
  }

  function loadReservations() {
    if (!usesReservations) return;
    setReservationsLoading(true);
    Promise.all([
      fetch("/api/members/caretaker/reservations?status=active").then((r) => r.json()),
      fetch("/api/members/caretaker/reservations?status=archived").then((r) => r.json()),
    ])
      .then(([activeRes, archivedRes]) => {
        setActiveReservations(activeRes.reservations ?? []);
        setArchivedReservations(archivedRes.reservations ?? []);
      })
      .catch(() => {})
      .finally(() => setReservationsLoading(false));
  }

  useEffect(() => {
    if (usesReservations) {
      loadSites();
      loadReservations();
    }
  }, [usesReservations]);

  async function fetchAvailability() {
    if (!resCheckInDate || !resCheckOutDate || resCheckInDate >= resCheckOutDate) {
      setAvailableSiteIds([]);
      return;
    }
    const r = await fetch(
      `/api/members/caretaker/sites/availability?from=${encodeURIComponent(resCheckInDate)}&to=${encodeURIComponent(resCheckOutDate)}`
    );
    const data = await r.json();
    setAvailableSiteIds(data.availableSiteIds ?? []);
  }

  useEffect(() => {
    if (resCheckInDate && resCheckOutDate && resCheckInDate < resCheckOutDate) {
      fetchAvailability();
    } else {
      setAvailableSiteIds([]);
    }
  }, [resCheckInDate, resCheckOutDate]);

  async function handleReservationMemberLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!resMemberNumber.trim()) return;
    setResMemberLookupLoading(true);
    setResError(null);
    try {
      const res = await fetch("/api/members/caretaker/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberNumber: resMemberNumber.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResError(data.error ?? "Lookup failed");
        setResMemberLookup(null);
        return;
      }
      setResMemberLookup(data);
    } catch {
      setResError("Lookup failed");
      setResMemberLookup(null);
    } finally {
      setResMemberLookupLoading(false);
    }
  }

  async function handleCreateReservation(e: React.FormEvent) {
    e.preventDefault();
    if (!resSiteId || !resCheckInDate || !resCheckOutDate) {
      setResError("Select site and dates");
      return;
    }
    if (resType === "member") {
      if (!resMemberLookup) {
        setResError("Look up member first");
        return;
      }
    } else {
      if (!resGuestFirstName.trim() || !resGuestLastName.trim() || !resGuestEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resGuestEmail.trim())) {
        setResError("Enter guest first name, last name, and valid email");
        return;
      }
    }
    setResError(null);
    setResSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        siteId: resSiteId,
        checkInDate: resCheckInDate,
        checkOutDate: resCheckOutDate,
        type: resType,
      };
      if (resType === "member" && resMemberLookup) {
        body.memberContactId = resMemberLookup.contactId;
        body.memberNumber = resMemberLookup.memberNumber;
        body.memberDisplayName = resMemberLookup.displayName;
      } else {
        body.guestFirstName = resGuestFirstName.trim();
        body.guestLastName = resGuestLastName.trim();
        body.guestEmail = resGuestEmail.trim();
        body.guestPhone = resGuestPhone.trim() || undefined;
      }
      const res = await fetch("/api/members/caretaker/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setResError(data.error ?? "Failed to create reservation");
        return;
      }
      setCreateResModalOpen(false);
      setResSiteId("");
      setResMemberLookup(null);
      setResMemberNumber("");
      setResGuestFirstName("");
      setResGuestLastName("");
      setResGuestEmail("");
      setResGuestPhone("");
      loadReservations();
    } catch {
      setResError("Failed to create reservation");
    } finally {
      setResSubmitting(false);
    }
  }

  function openResDetailsModal(r: Reservation) {
    setDetailsReservation(r);
    setDetailsMemberLookup(null);
    setDetailsModalOpen(true);
    if (r.reservationType === "member" && r.memberNumber) {
      setDetailsMemberLoading(true);
      fetch("/api/members/caretaker/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberNumber: r.memberNumber.trim() }),
      })
        .then((res) => res.ok ? res.json() : null)
        .then((data) => setDetailsMemberLookup(data ?? null))
        .catch(() => setDetailsMemberLookup(null))
        .finally(() => setDetailsMemberLoading(false));
    }
  }

  function openResEditModal(r: Reservation) {
    setEditingReservation(r);
    setResEditCheckInDate(toDateOnly(r.checkInDate));
    setResEditCheckOutDate(toDateOnly(r.checkOutDate));
    setResEditModalOpen(true);
  }

  async function handleResEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingReservation) return;
    setResEditSubmitting(true);
    try {
      const res = await fetch(`/api/members/caretaker/reservations/${editingReservation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkInDate: resEditCheckInDate, checkOutDate: resEditCheckOutDate }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Update failed");
        return;
      }
      setResEditModalOpen(false);
      setEditingReservation(null);
      loadReservations();
    } catch {
      alert("Update failed");
    } finally {
      setResEditSubmitting(false);
    }
  }

  function openResCancelModal(r: Reservation) {
    setCancellingReservation(r);
    setResCancelModalOpen(true);
  }

  async function handleResCancelConfirm() {
    if (!cancellingReservation) return;
    setResCancelSubmitting(true);
    try {
      const res = await fetch(`/api/members/caretaker/reservations/${cancellingReservation.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setResError(data.error ?? "Cancel failed");
        return;
      }
      setResCancelModalOpen(false);
      setCancellingReservation(null);
      setResError(null);
      loadReservations();
    } catch {
      setResError("Cancel failed");
    } finally {
      setResCancelSubmitting(false);
    }
  }

  async function handleResCheckIn(r: Reservation) {
    setCheckingInReservation(r);
    setResCheckInSubmitting(true);
    try {
      const res = await fetch(`/api/members/caretaker/reservations/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkIn: true }),
      });
      const text = await res.text();
      let data: { error?: string; welcomeEmailSent?: boolean };
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        alert(!res.ok ? `Check-in failed (${res.status}). ${text.slice(0, 100)}` : "Check-in failed: invalid response.");
        return;
      }
      if (!res.ok) {
        alert(data.error ?? `Check-in failed (${res.status})`);
        return;
      }
      setCheckingInReservation(null);
      loadReservations();
      if (data.welcomeEmailSent === false) {
        alert("Check-in recorded. No welcome email was sent (no email on file for this " + (r.reservationType === "member" ? "member" : "guest") + ").");
      } else if (data.welcomeEmailSent === true) {
        alert("Check-in recorded. Welcome email sent.");
      }
    } catch (err) {
      alert("Check-in failed. " + (err instanceof Error ? err.message : "Try again."));
    } finally {
      setResCheckInSubmitting(false);
    }
  }

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

  async function handleGuestCheckInSubmit(e: React.FormEvent) {
    e.preventDefault();
    const firstName = guestFirstName.trim();
    const lastName = guestLastName.trim();
    const email = guestEmail.trim();
    if (!firstName || !lastName || !email) {
      setGuestError("First name, last name, and email are required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setGuestError("Please enter a valid email address");
      return;
    }
    const nights = Math.max(1, Math.min(365, parseInt(guestNightsInput, 10) || 1));
    setGuestError(null);
    setGuestCheckInSubmitting(true);
    try {
      const res = await fetch("/api/members/caretaker/guest-check-ins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone: guestPhone.trim() || undefined,
          nights,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGuestError(data.error ?? "Check-in failed");
        return;
      }
      setGuestCheckInModalOpen(false);
      setGuestFirstName("");
      setGuestLastName("");
      setGuestEmail("");
      setGuestPhone("");
      setGuestNightsInput("1");
      loadCheckIns();
    } catch {
      setGuestError("Check-in failed");
    } finally {
      setGuestCheckInSubmitting(false);
    }
  }

  function openGuestEditModal(guest: GuestCheckIn) {
    setEditingGuestCheckIn(guest);
    setNewGuestCheckOutDate(guest.checkOutDate);
    setGuestEditModalOpen(true);
  }

  function openGuestCancelModal(guest: GuestCheckIn) {
    setCancellingGuestCheckIn(guest);
    setGuestCancelModalOpen(true);
  }

  async function handleGuestEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingGuestCheckIn || !newGuestCheckOutDate) return;
    setGuestEditSubmitting(true);
    try {
      const res = await fetch(`/api/members/caretaker/guest-check-ins/${editingGuestCheckIn.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkOutDate: newGuestCheckOutDate }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Update failed");
        return;
      }
      setGuestEditModalOpen(false);
      setEditingGuestCheckIn(null);
      loadCheckIns();
    } catch {
      alert("Update failed");
    } finally {
      setGuestEditSubmitting(false);
    }
  }

  async function handleGuestCancelConfirm() {
    if (!cancellingGuestCheckIn) return;
    setGuestCancelSubmitting(true);
    try {
      const res = await fetch(`/api/members/caretaker/guest-check-ins/${cancellingGuestCheckIn.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        setGuestError(data.error ?? "Cancel failed");
        return;
      }
      setGuestCancelModalOpen(false);
      setCancellingGuestCheckIn(null);
      setGuestError(null);
      loadCheckIns();
    } catch {
      setGuestError("Cancel failed");
    } finally {
      setGuestCancelSubmitting(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  // Reservation system UI (Burnt River)
  if (usesReservations) {
    return (
      <div className="space-y-8">
        <section className="p-4 bg-[#0f0a06]/60 border border-[#d4af37]/20 rounded-lg">
          <h2 className="font-semibold text-[#f0d48f] mb-3 flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Site reservations
          </h2>
          <p className="text-[#e8e0d5]/80 text-sm mb-3">
            Create and manage site reservations. Only available sites for the chosen dates are shown.
          </p>
          <button
            type="button"
            onClick={() => { setResError(null); setCreateResModalOpen(true); }}
            className="px-4 py-2.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f]"
          >
            Create reservation
          </button>
        </section>

        <section>
          <h2 className="font-semibold text-[#f0d48f] mb-3 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Active reservations
          </h2>
          {reservationsLoading ? (
            <p className="text-[#e8e0d5]/60">Loading…</p>
          ) : activeReservations.length === 0 ? (
            <p className="text-[#e8e0d5]/60">No active reservations.</p>
          ) : (
            <ul className="space-y-2">
              {activeReservations.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 p-3 bg-[#0f0a06]/60 border border-[#d4af37]/20 rounded-lg"
                >
                  <div className="flex flex-wrap items-center gap-2 gap-y-1">
                    <span className="font-medium text-[#e8e0d5]">
                      {r.siteName ?? "Site"} — {r.reservationType === "member" ? (r.memberDisplayName || `#${r.memberNumber}`) : `${r.guestFirstName} ${r.guestLastName}`}
                    </span>
                    <ReservationDateRange checkInDate={r.checkInDate} checkOutDate={r.checkOutDate} nights={r.nights} />
                    {r.checkedInAt ? (
                      <span className="ml-1 px-2 py-0.5 rounded bg-[#0f3d1e] text-[#6dd472] text-sm">Checked in</span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {!r.checkedInAt && (
                      <button
                        type="button"
                        onClick={() => handleResCheckIn(r)}
                        disabled={resCheckInSubmitting || today < toDateOnly(r.checkInDate)}
                        title={today < toDateOnly(r.checkInDate) ? `Check-in available from ${toDateOnly(r.checkInDate)}` : undefined}
                        className="px-3 py-1.5 text-sm bg-[#0f3d1e] text-[#6dd472] rounded hover:bg-[#0f3d1e]/80 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {resCheckInSubmitting && checkingInReservation?.id === r.id ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Check in
                      </button>
                    )}
                    <button type="button" onClick={() => openResDetailsModal(r)} className="px-3 py-1.5 text-sm bg-[#1a120b] text-[#e8e0d5] border border-[#d4af37]/40 rounded hover:bg-[#d4af37]/10">
                      Details
                    </button>
                    <button type="button" onClick={() => openResEditModal(r)} className="px-3 py-1.5 text-sm bg-[#d4af37]/20 text-[#d4af37] rounded hover:bg-[#d4af37]/30">
                      Edit
                    </button>
                    <button type="button" onClick={() => openResCancelModal(r)} className="px-3 py-1.5 text-sm bg-red-950/50 text-red-300 rounded hover:bg-red-900/40 border border-red-800/50">
                      Cancel
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="font-semibold text-[#e8e0d5]/80 mb-3">Archived reservations</h2>
          {reservationsLoading ? null : archivedReservations.length === 0 ? (
            <p className="text-[#e8e0d5]/60">No archived reservations.</p>
          ) : (
            <ul className="space-y-2">
              {archivedReservations.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3 bg-[#0f0a06]/40 border border-[#d4af37]/10 rounded-lg text-[#e8e0d5]/80">
                  <span>{r.siteName ?? "Site"} — {r.reservationType === "member" ? (r.memberDisplayName || `#${r.memberNumber}`) : `${r.guestFirstName} ${r.guestLastName}`}</span>
                  <span className="text-sm">{r.checkInDate} – {r.checkOutDate}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Create reservation modal */}
        {createResModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={() => setCreateResModalOpen(false)}>
            <div className="bg-[#1a120b] border border-[#d4af37]/30 rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-[#f0d48f]">Create reservation</h3>
                <button type="button" onClick={() => setCreateResModalOpen(false)} className="text-[#e8e0d5]/60 hover:text-[#e8e0d5]"><X className="w-5 h-5" /></button>
              </div>
              {resError && <p className="mb-3 text-red-400 text-sm">{resError}</p>}
              <form onSubmit={handleCreateReservation} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#e8e0d5] mb-1">Check-in date *</label>
                  <DatePickerWithCalendar value={resCheckInDate} onChange={setResCheckInDate} min={today} placeholder="Select check-in" id="res-check-in" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#e8e0d5] mb-1">Check-out date *</label>
                  <DatePickerWithCalendar value={resCheckOutDate} onChange={setResCheckOutDate} min={resCheckInDate || today} placeholder="Select check-out" id="res-check-out" />
                  <p className="text-[#e8e0d5]/50 text-xs mt-1">Calendar starts at check-in date so you can pick quickly.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#e8e0d5] mb-1">Site *</label>
                  <select value={resSiteId} onChange={(e) => setResSiteId(e.target.value)} className="w-full px-4 py-2.5 bg-[#0f0a06] border border-[#d4af37]/30 rounded-lg text-[#e8e0d5]" required>
                    <option value="">Select site</option>
                    {sites.filter((s) => availableSiteIds.includes(s.id)).map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.siteType})</option>
                    ))}
                  </select>
                  {resCheckInDate && resCheckOutDate && resCheckInDate < resCheckOutDate && availableSiteIds.length === 0 && (
                    <p className="text-amber-400 text-sm mt-1">No sites available for these dates.</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#e8e0d5] mb-2">Reservation for</label>
                  <div className="flex gap-4 mb-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="resType" checked={resType === "member"} onChange={() => { setResType("member"); setResError(null); }} />
                      <span className="text-[#e8e0d5]">Member</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="resType" checked={resType === "guest"} onChange={() => { setResType("guest"); setResError(null); }} />
                      <span className="text-[#e8e0d5]">Guest</span>
                    </label>
                  </div>
                  {resType === "member" ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input type="text" value={resMemberNumber} onChange={(e) => setResMemberNumber(e.target.value)} placeholder="Member number" className="flex-1 px-4 py-2.5 bg-[#0f0a06] border border-[#d4af37]/30 rounded-lg text-[#e8e0d5]" />
                        <button type="button" onClick={handleReservationMemberLookup} disabled={resMemberLookupLoading || !resMemberNumber.trim()} className="px-4 py-2.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg disabled:opacity-50 flex items-center gap-2">
                          {resMemberLookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Look up
                        </button>
                      </div>
                      {resMemberLookup && (
                        <div className="text-sm">
                          <p className="text-[#e8e0d5]">✓ {resMemberLookup.displayName} (#{resMemberLookup.memberNumber})</p>
                          {(resMemberLookup.maintenanceFeesDue != null && resMemberLookup.maintenanceFeesDue > 0) || (resMemberLookup.membershipDuesOwed != null && resMemberLookup.membershipDuesOwed > 0) ? (
                            <p className="text-amber-400/90 mt-1">
                              {(resMemberLookup.maintenanceFeesDue != null && resMemberLookup.maintenanceFeesDue > 0) && `Maintenance past due: ${formatCurrency(resMemberLookup.maintenanceFeesDue)}`}
                              {(resMemberLookup.maintenanceFeesDue != null && resMemberLookup.maintenanceFeesDue > 0) && (resMemberLookup.membershipDuesOwed != null && resMemberLookup.membershipDuesOwed > 0) && " · "}
                              {(resMemberLookup.membershipDuesOwed != null && resMemberLookup.membershipDuesOwed > 0) && `Membership dues owed: ${formatCurrency(resMemberLookup.membershipDuesOwed)}`}
                            </p>
                          ) : null}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" value={resGuestFirstName} onChange={(e) => setResGuestFirstName(e.target.value)} placeholder="First name" className="px-4 py-2.5 bg-[#0f0a06] border border-[#d4af37]/30 rounded-lg text-[#e8e0d5]" required={resType === "guest"} />
                      <input type="text" value={resGuestLastName} onChange={(e) => setResGuestLastName(e.target.value)} placeholder="Last name" className="px-4 py-2.5 bg-[#0f0a06] border border-[#d4af37]/30 rounded-lg text-[#e8e0d5]" required={resType === "guest"} />
                      <input type="email" value={resGuestEmail} onChange={(e) => setResGuestEmail(e.target.value)} placeholder="Email" className="col-span-2 px-4 py-2.5 bg-[#0f0a06] border border-[#d4af37]/30 rounded-lg text-[#e8e0d5]" required={resType === "guest"} />
                      <input type="tel" value={resGuestPhone} onChange={(e) => setResGuestPhone(e.target.value)} placeholder="Phone (optional)" className="col-span-2 px-4 py-2.5 bg-[#0f0a06] border border-[#d4af37]/30 rounded-lg text-[#e8e0d5]" />
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setCreateResModalOpen(false)} className="flex-1 py-2.5 text-[#e8e0d5]/80 hover:text-[#d4af37]">Cancel</button>
                  <button type="submit" disabled={resSubmitting} className="flex-1 py-2.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] disabled:opacity-50 flex items-center justify-center gap-2">
                    {resSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Create reservation
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Reservation details modal */}
        {detailsModalOpen && detailsReservation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={() => setDetailsModalOpen(false)}>
            <div className="bg-[#1a120b] border border-[#d4af37]/30 rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-[#f0d48f]">Reservation details</h3>
                <button type="button" onClick={() => setDetailsModalOpen(false)} className="text-[#e8e0d5]/60 hover:text-[#e8e0d5]"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-[#e8e0d5]/60 mb-0.5">Site</p>
                  <p className="text-[#e8e0d5] font-medium">{detailsReservation.siteName ?? "Site"}</p>
                </div>
                <div>
                  <p className="text-[#e8e0d5]/60 mb-0.5">Dates</p>
                  <ReservationDateRange checkInDate={detailsReservation.checkInDate} checkOutDate={detailsReservation.checkOutDate} nights={detailsReservation.nights} />
                </div>
                <div>
                  <p className="text-[#e8e0d5]/60 mb-0.5">Status</p>
                  <p className="text-[#e8e0d5]">{detailsReservation.checkedInAt ? "Checked in" : "Reserved"}</p>
                </div>
                {detailsReservation.reservationType === "member" ? (
                  <>
                    <div>
                      <p className="text-[#e8e0d5]/60 mb-0.5">Member</p>
                      <p className="text-[#e8e0d5] font-medium">{detailsReservation.memberDisplayName || `#${detailsReservation.memberNumber}`}</p>
                      <p className="text-[#e8e0d5]/80">Member # {detailsReservation.memberNumber}</p>
                    </div>
                    {detailsMemberLoading ? (
                      <p className="text-[#e8e0d5]/60">Loading member details…</p>
                    ) : detailsMemberLookup ? (
                      <div className="pt-2 border-t border-[#d4af37]/20 space-y-2">
                        <p className="text-[#e8e0d5]/60 mb-1">Dues & contact</p>
                        {(detailsMemberLookup.maintenanceFeesDue != null && detailsMemberLookup.maintenanceFeesDue > 0) || (detailsMemberLookup.membershipDuesOwed != null && detailsMemberLookup.membershipDuesOwed > 0) ? (
                          <>
                            {detailsMemberLookup.maintenanceFeesDue != null && detailsMemberLookup.maintenanceFeesDue > 0 && (
                              <p className="text-[#e8e0d5]">Maintenance past due: <span className="text-amber-400">{formatCurrency(detailsMemberLookup.maintenanceFeesDue)}</span></p>
                            )}
                            {detailsMemberLookup.membershipDuesOwed != null && detailsMemberLookup.membershipDuesOwed > 0 && (
                              <p className="text-[#e8e0d5]">Membership dues owed: <span className="text-amber-400">{formatCurrency(detailsMemberLookup.membershipDuesOwed)}</span></p>
                            )}
                          </>
                        ) : (
                          <p className="text-[#e8e0d5]/80">No past-due amounts</p>
                        )}
                        <p className="text-[#e8e0d5]/80">Email & phone on file for this member</p>
                      </div>
                    ) : detailsReservation.memberNumber ? (
                      <p className="text-[#e8e0d5]/60">Could not load member details.</p>
                    ) : null}
                  </>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[#e8e0d5]/60 mb-0.5">Guest</p>
                    <p className="text-[#e8e0d5] font-medium">{detailsReservation.guestFirstName} {detailsReservation.guestLastName}</p>
                    <p className="text-[#e8e0d5]">Email: {detailsReservation.guestEmail ?? "—"}</p>
                    <p className="text-[#e8e0d5]">Phone: {detailsReservation.guestPhone ?? "—"}</p>
                  </div>
                )}
              </div>
              <div className="mt-6 flex justify-end">
                <button type="button" onClick={() => setDetailsModalOpen(false)} className="px-4 py-2.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f]">
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit reservation modal */}
        {resEditModalOpen && editingReservation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={() => setResEditModalOpen(false)}>
            <div className="bg-[#1a120b] border border-[#d4af37]/30 rounded-xl shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-[#f0d48f]">Edit reservation dates</h3>
                <button type="button" onClick={() => setResEditModalOpen(false)} className="text-[#e8e0d5]/60 hover:text-[#e8e0d5]"><X className="w-5 h-5" /></button>
              </div>
              <p className="text-[#e8e0d5]/80 text-sm mb-4">{editingReservation.siteName} — {editingReservation.reservationType === "member" ? editingReservation.memberDisplayName : `${editingReservation.guestFirstName} ${editingReservation.guestLastName}`}</p>
              <form onSubmit={handleResEditSubmit}>
                <label className="block text-sm font-medium text-[#e8e0d5] mb-2">Check-in date</label>
                <DatePickerWithCalendar value={resEditCheckInDate} onChange={setResEditCheckInDate} min={today} id="edit-res-check-in" />
                <label className="block text-sm font-medium text-[#e8e0d5] mb-2 mt-3">Check-out date</label>
                <DatePickerWithCalendar value={resEditCheckOutDate} onChange={setResEditCheckOutDate} min={resEditCheckInDate || today} id="edit-res-check-out" />
                <p className="text-[#e8e0d5]/50 text-xs mb-4 mt-2">Check-out must be after check-in. Payment adjustments (proration, extensions) will be handled when payment is enabled.</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setResEditModalOpen(false)} className="flex-1 py-2.5 text-[#e8e0d5]/80 hover:text-[#d4af37]">Cancel</button>
                  <button type="submit" disabled={resEditSubmitting || !resEditCheckInDate || !resEditCheckOutDate || resEditCheckInDate >= resEditCheckOutDate} className="flex-1 py-2.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2">
                    {resEditSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Cancel reservation modal */}
        {resCancelModalOpen && cancellingReservation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={() => !resCancelSubmitting && (setResCancelModalOpen(false), setCancellingReservation(null))}>
            <div className="bg-[#1a120b] border border-[#d4af37]/30 rounded-xl shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-[#f0d48f]">Cancel reservation</h3>
                <button type="button" onClick={() => !resCancelSubmitting && (setResCancelModalOpen(false), setCancellingReservation(null))} className="text-[#e8e0d5]/60 hover:text-[#e8e0d5]"><X className="w-5 h-5" /></button>
              </div>
              <p className="text-[#e8e0d5]/90 text-sm mb-4">
                Cancel this reservation for {cancellingReservation.siteName} — {cancellingReservation.reservationType === "member" ? cancellingReservation.memberDisplayName : `${cancellingReservation.guestFirstName} ${cancellingReservation.guestLastName}`}?
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={() => !resCancelSubmitting && (setResCancelModalOpen(false), setCancellingReservation(null))} className="flex-1 py-2.5 text-[#e8e0d5]/80 hover:text-[#d4af37]">Keep</button>
                <button type="button" onClick={handleResCancelConfirm} disabled={resCancelSubmitting} className="flex-1 py-2.5 bg-red-800/80 text-red-100 font-semibold rounded-lg hover:bg-red-700/80 disabled:opacity-50 flex items-center justify-center gap-2">
                  {resCancelSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Yes, cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

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
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-[#e8e0d5]/60">Maintenance fees due</dt>
                <dd className="text-[#e8e0d5] font-medium">{formatCurrency(lookupResult.maintenanceFeesDue)}</dd>
              </div>
              <div>
                <dt className="text-[#e8e0d5]/60">Membership dues owed</dt>
                <dd className="text-[#e8e0d5] font-medium">{formatCurrency(lookupResult.membershipDuesOwed)}</dd>
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

      {/* Check in guest */}
      <section className="p-4 bg-[#0f0a06]/60 border border-[#d4af37]/20 rounded-lg">
        <h2 className="font-semibold text-[#f0d48f] mb-3 flex items-center gap-2">
          <UserPlus className="w-5 h-5" />
          Check in guest
        </h2>
        <p className="text-[#e8e0d5]/80 text-sm mb-3">
          Guest check-in bypasses member lookup. Capture name, email, and phone for marketing; a separate welcome email is sent.
        </p>
        <button
          type="button"
          onClick={() => { setGuestError(null); setGuestCheckInModalOpen(true); }}
          className="px-4 py-2.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f]"
        >
          Check in guest
        </button>
      </section>

      {/* Active check-ins */}
      <section>
        <h2 className="font-semibold text-[#f0d48f] mb-3 flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Active member check-ins
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

      {/* Active guest check-ins */}
      <section>
        <h2 className="font-semibold text-[#f0d48f] mb-3 flex items-center gap-2">
          <UserPlus className="w-5 h-5" />
          Active guest check-ins
        </h2>
        {listLoading ? (
          <p className="text-[#e8e0d5]/60">Loading…</p>
        ) : activeGuestCheckIns.length === 0 ? (
          <p className="text-[#e8e0d5]/60">No active guest check-ins.</p>
        ) : (
          <ul className="space-y-2">
            {activeGuestCheckIns.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 p-3 bg-[#0f0a06]/60 border border-[#d4af37]/20 rounded-lg"
              >
                <div>
                  <span className="font-medium text-[#e8e0d5]">
                    {c.firstName} {c.lastName}
                  </span>
                  <span className="text-[#e8e0d5]/60 ml-2">{c.email}</span>
                  {c.phone ? <span className="text-[#e8e0d5]/50 ml-2 text-sm">{c.phone}</span> : null}
                </div>
                <div className="flex items-center gap-4 text-sm text-[#e8e0d5]/80">
                  <span>Check-in: {c.checkInDate}</span>
                  <span>Check-out: {c.checkOutDate}</span>
                  <span>{c.nights} night{c.nights !== 1 ? "s" : ""}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openGuestEditModal(c)}
                    className="px-3 py-1.5 text-sm bg-[#d4af37]/20 text-[#d4af37] rounded hover:bg-[#d4af37]/30"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => openGuestCancelModal(c)}
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
        <h2 className="font-semibold text-[#e8e0d5]/80 mb-3">Archived member check-ins</h2>
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

      {/* Archived guest check-ins */}
      <section>
        <h2 className="font-semibold text-[#e8e0d5]/80 mb-3">Archived guest check-ins</h2>
        {listLoading ? null : archivedGuestCheckIns.length === 0 ? (
          <p className="text-[#e8e0d5]/60">No archived guest check-ins.</p>
        ) : (
          <ul className="space-y-2">
            {archivedGuestCheckIns.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 p-3 bg-[#0f0a06]/40 border border-[#d4af37]/10 rounded-lg text-[#e8e0d5]/80"
              >
                <div>
                  <span className="font-medium">{c.firstName} {c.lastName}</span>
                  <span className="ml-2 opacity-70">{c.email}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span>{c.checkInDate} – {c.checkOutDate}</span>
                  <span>{c.nights} night{c.nights !== 1 ? "s" : ""}</span>
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

      {/* Guest check-in modal */}
      {guestCheckInModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={() => setGuestCheckInModalOpen(false)}>
          <div className="bg-[#1a120b] border border-[#d4af37]/30 rounded-xl shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-[#f0d48f]">Check in guest</h3>
              <button type="button" onClick={() => setGuestCheckInModalOpen(false)} className="text-[#e8e0d5]/60 hover:text-[#e8e0d5]">
                <X className="w-5 h-5" />
              </button>
            </div>
            {guestError && <p className="mb-3 text-red-400 text-sm">{guestError}</p>}
            <form onSubmit={handleGuestCheckInSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-[#e8e0d5] mb-1">First name *</label>
                <input
                  type="text"
                  value={guestFirstName}
                  onChange={(e) => setGuestFirstName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#0f0a06] border border-[#d4af37]/30 rounded-lg text-[#e8e0d5]"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#e8e0d5] mb-1">Last name *</label>
                <input
                  type="text"
                  value={guestLastName}
                  onChange={(e) => setGuestLastName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#0f0a06] border border-[#d4af37]/30 rounded-lg text-[#e8e0d5]"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#e8e0d5] mb-1">Email *</label>
                <input
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#0f0a06] border border-[#d4af37]/30 rounded-lg text-[#e8e0d5]"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#e8e0d5] mb-1">Phone (optional)</label>
                <input
                  type="tel"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#0f0a06] border border-[#d4af37]/30 rounded-lg text-[#e8e0d5]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#e8e0d5] mb-1">Nights</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={guestNightsInput}
                  onChange={(e) => setGuestNightsInput(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#0f0a06] border border-[#d4af37]/30 rounded-lg text-[#e8e0d5]"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setGuestCheckInModalOpen(false)} className="flex-1 py-2.5 text-[#e8e0d5]/80 hover:text-[#d4af37]">
                  Cancel
                </button>
                <button type="submit" disabled={guestCheckInSubmitting} className="flex-1 py-2.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] disabled:opacity-50 flex items-center justify-center gap-2">
                  {guestCheckInSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Check in guest
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Guest cancel reservation modal */}
      {guestCancelModalOpen && cancellingGuestCheckIn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={() => !guestCancelSubmitting && (setGuestCancelModalOpen(false), setCancellingGuestCheckIn(null))}>
          <div className="bg-[#1a120b] border border-[#d4af37]/30 rounded-xl shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-[#f0d48f]">Cancel guest reservation</h3>
              <button type="button" onClick={() => !guestCancelSubmitting && (setGuestCancelModalOpen(false), setCancellingGuestCheckIn(null))} className="text-[#e8e0d5]/60 hover:text-[#e8e0d5]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-[#e8e0d5]/90 text-sm mb-4">
              Cancel this reservation for {cancellingGuestCheckIn.firstName} {cancellingGuestCheckIn.lastName}? The reservation will move to archives.
            </p>
            {guestError && <p className="mb-2 text-red-400 text-sm">{guestError}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => !guestCancelSubmitting && (setGuestCancelModalOpen(false), setCancellingGuestCheckIn(null))} className="flex-1 py-2.5 text-[#e8e0d5]/80 hover:text-[#d4af37]">
                Keep reservation
              </button>
              <button type="button" onClick={handleGuestCancelConfirm} disabled={guestCancelSubmitting} className="flex-1 py-2.5 bg-red-800/80 text-red-100 font-semibold rounded-lg hover:bg-red-700/80 disabled:opacity-50 flex items-center justify-center gap-2">
                {guestCancelSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Yes, cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guest edit checkout modal */}
      {guestEditModalOpen && editingGuestCheckIn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={() => setGuestEditModalOpen(false)}>
          <div className="bg-[#1a120b] border border-[#d4af37]/30 rounded-xl shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-[#f0d48f]">Edit guest checkout date</h3>
              <button type="button" onClick={() => setGuestEditModalOpen(false)} className="text-[#e8e0d5]/60 hover:text-[#e8e0d5]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-[#e8e0d5]/80 text-sm mb-4">
              {editingGuestCheckIn.firstName} {editingGuestCheckIn.lastName}
            </p>
            <form onSubmit={handleGuestEditSubmit}>
              <label className="block text-sm font-medium text-[#e8e0d5] mb-2">New checkout date</label>
              <input
                type="date"
                min={editingGuestCheckIn.checkInDate}
                value={newGuestCheckOutDate}
                onChange={(e) => setNewGuestCheckOutDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#0f0a06] border border-[#d4af37]/30 rounded-lg text-[#e8e0d5] mb-4"
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setGuestEditModalOpen(false)} className="flex-1 py-2.5 text-[#e8e0d5]/80 hover:text-[#d4af37]">
                  Cancel
                </button>
                <button type="submit" disabled={guestEditSubmitting} className="flex-1 py-2.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] disabled:opacity-50 flex items-center justify-center gap-2">
                  {guestEditSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
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
