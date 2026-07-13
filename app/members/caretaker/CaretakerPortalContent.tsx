"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Search, Loader2, Calendar, User, UserPlus, X, MapPin, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";
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
import { campUsesReservations, caretakerAllowsCashCheckIn, caretakerEarliestCheckInDate, caretakerEarliestCheckInDateForEdit } from "@/lib/reservation-camps";
import { EVENT_RESERVATION_PRODUCTS } from "@/lib/events-config";
import { computeStayPricing, formatCentsAsCurrency, generateBillingPeriods } from "@/lib/reservation-pricing";
import { countNights } from "@/lib/reservation-dates";
import { suggestedReservationPaymentCents } from "@/lib/reservation-billing";
import { scalePeriodDraftsToTotal } from "@/lib/reservation-price-override";
import { resolveCreateReservationPricing } from "@/lib/reservation-create-metadata";
import { ReservationCalendarView } from "@/app/members/caretaker/ReservationCalendarView";
import {
  ReservationBillingSection,
  PaymentDueBadge,
  type BillingPeriodRow,
  type SiteBalance,
} from "@/app/members/caretaker/ReservationBillingSection";

import { parseCaretakerLookupInput } from "@/lib/member-contact-search";

type LookupResult = {
  contactId: string;
  memberNumber: string;
  displayName: string;
  email: string | null;
  phone?: string | null;
  isLdmaMember: boolean;
  maintenanceFeesDue: number | null;
  membershipDuesOwed: number | null;
  membershipBalance: number | null;
};

type LookupMatch = {
  contactId: string;
  memberNumber: string | null;
  displayName: string;
  email: string | null;
  phone: string | null;
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
  memberRateMonthly: number | null;
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
  memberContactId?: string | null;
  memberNumber: string | null;
  memberDisplayName: string | null;
  guestFirstName: string | null;
  guestLastName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  status: string;
  checkedInAt: string | null;
  createdAt?: string;
  cancelledAt?: string | null;
  cancellationRefundCents?: number | null;
  cancellationFeeWaived?: boolean;
  cancellationFeeWaivedCents?: number | null;
  cancellationFeeWaivedAt?: string | null;
  invoiceNumber?: string | null;
  calculatedTotalCents?: number | null;
  amountOverrideCents?: number | null;
  overrideReason?: string | null;
  priceOverrideFlag?: boolean;
  balanceDueCents?: number;
  siteFeesPaidCents?: number;
  siteFeesDueCents?: number;
  hasOverdueSiteFee?: boolean;
  eventProductHandle?: string | null;
  eventSiteType?: string | null;
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

function reservationIsArchived(r: { checkOutDate: string; status: string }): boolean {
  if (r.status === "cancelled") return true;
  const today = new Date().toISOString().slice(0, 10);
  return toDateOnly(r.checkOutDate) < today;
}

function reservationStatusLabel(r: {
  status: string;
  checkOutDate: string;
  checkedInAt?: string | null;
}): string {
  if (r.status === "cancelled") return "Cancelled";
  const today = new Date().toISOString().slice(0, 10);
  if (toDateOnly(r.checkOutDate) < today) {
    return r.checkedInAt ? "Completed (checked in)" : "Completed";
  }
  if (r.checkedInAt) return "Checked in";
  return "Reserved";
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
  const [resMemberLookupMatches, setResMemberLookupMatches] = useState<LookupMatch[]>([]);
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
  const [resEditMemberLookup, setResEditMemberLookup] = useState<LookupResult | null>(null);
  const [resEditPaymentDueCents, setResEditPaymentDueCents] = useState<number | null>(null);
  const [resEditPayAmountCents, setResEditPayAmountCents] = useState(0);
  const [resEditPreview, setResEditPreview] = useState<{
    available: boolean;
    datesUnchanged: boolean;
    current: {
      checkInDate: string;
      checkOutDate: string;
      nights: number;
      totalCents: number;
      calculatedTotalCents: number;
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
  const [resEditPreviewLoading, setResEditPreviewLoading] = useState(false);
  const [resEditPreviewError, setResEditPreviewError] = useState<string | null>(null);
  const [resEditIssueRefund, setResEditIssueRefund] = useState(false);
  const [movingReservation, setMovingReservation] = useState<Reservation | null>(null);
  const [resMoveModalOpen, setResMoveModalOpen] = useState(false);
  const [resMoveNewSiteId, setResMoveNewSiteId] = useState("");
  const [resMovePreview, setResMovePreview] = useState<{
    newSiteId: string;
    newSiteName: string;
    available: boolean;
    newTotalCents: number;
    netPaidCents: number;
    additionalDueCents: number;
    refundCents: number;
    refundBreakdown: { stripeRefundCents: number; cashRefundCents: number };
    cashAllowed: boolean;
  } | null>(null);
  const [resMovePreviewLoading, setResMovePreviewLoading] = useState(false);
  const [resMoveSubmitting, setResMoveSubmitting] = useState(false);
  const [resMovePaymentDueCents, setResMovePaymentDueCents] = useState<number | null>(null);
  const [resMoveCashAllowed, setResMoveCashAllowed] = useState(false);
  const [resMoveMemberLookup, setResMoveMemberLookup] = useState<LookupResult | null>(null);
  const [resMoveError, setResMoveError] = useState<string | null>(null);
  const [cancellingReservation, setCancellingReservation] = useState<Reservation | null>(null);
  const [resCancelModalOpen, setResCancelModalOpen] = useState(false);
  const [resCancelSubmitting, setResCancelSubmitting] = useState(false);
  const [resCancelPreview, setResCancelPreview] = useState<{
    refundCents: number;
    totalPaidCents: number;
    earnedCents: number;
    cancellationFeeCents: number;
    policyCancellationFeeCents: number;
    cancellationFeeWaived: boolean;
    nightsStayed: number;
    pricingMode: string;
    stripeRefundCents: number;
    cashRefundCents: number;
  } | null>(null);
  const [resCancelPreviewLoading, setResCancelPreviewLoading] = useState(false);
  const [resCancelError, setResCancelError] = useState<string | null>(null);
  const [resCancelWaiveFee, setResCancelWaiveFee] = useState(false);
  const [checkingInReservation, setCheckingInReservation] = useState<Reservation | null>(null);
  const [resCheckInSubmitting, setResCheckInSubmitting] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsFocusPayment, setDetailsFocusPayment] = useState(false);
  const [detailsReservation, setDetailsReservation] = useState<Reservation | null>(null);
  const [detailsMemberLookup, setDetailsMemberLookup] = useState<LookupResult | null>(null);
  const [detailsMemberLoading, setDetailsMemberLoading] = useState(false);
  const [detailsPastDueMaintenanceCents, setDetailsPastDueMaintenanceCents] = useState<number>(0);
  const [detailsPastDueMembershipCents, setDetailsPastDueMembershipCents] = useState<number>(0);
  const [detailsPastDueSubmitting, setDetailsPastDueSubmitting] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsBillingPeriods, setDetailsBillingPeriods] = useState<BillingPeriodRow[]>([]);
  const [detailsSiteBalance, setDetailsSiteBalance] = useState<SiteBalance | null>(null);
  const [resPastDueMaintenanceCents, setResPastDueMaintenanceCents] = useState<number>(0);
  const [resPastDueMembershipCents, setResPastDueMembershipCents] = useState<number>(0);
  const [resPastDueSubmitting, setResPastDueSubmitting] = useState(false);
  const [resStayTotalOverride, setResStayTotalOverride] = useState("");
  const [resPaymentAmount, setResPaymentAmount] = useState("");
  const [resOverrideReason, setResOverrideReason] = useState("");
  const [resQuotedTotalCents, setResQuotedTotalCents] = useState<number | null>(null);
  const [resQuotedNights, setResQuotedNights] = useState<number | null>(null);
  const [resQuoteLoading, setResQuoteLoading] = useState(false);
  const [detailsPayments, setDetailsPayments] = useState<Array<{
    id: string;
    method: string;
    amountCents: number;
    paymentType: string;
    invoiceNumber: string | null;
    stripeCheckoutSessionId: string | null;
    stripePaymentIntentId: string | null;
    createdAt: string;
  }>>([]);
  const [detailsPaymentSummary, setDetailsPaymentSummary] = useState<{
    totalPaidCents: number;
    totalRefundedCents: number;
    netPaidCents: number;
  } | null>(null);
  const [detailsContactLookupInput, setDetailsContactLookupInput] = useState("");
  const [detailsContactLookupLoading, setDetailsContactLookupLoading] = useState(false);
  const [detailsContactLookupMatches, setDetailsContactLookupMatches] = useState<LookupMatch[]>([]);
  const [detailsContactLookupResult, setDetailsContactLookupResult] = useState<LookupResult | null>(null);
  const [detailsContactLinkSubmitting, setDetailsContactLinkSubmitting] = useState(false);
  const [detailsContactEmail, setDetailsContactEmail] = useState("");
  const [detailsContactPhone, setDetailsContactPhone] = useState("");
  const [detailsContactSaving, setDetailsContactSaving] = useState(false);
  const [detailsContactError, setDetailsContactError] = useState<string | null>(null);
  const [detailsGuestEmail, setDetailsGuestEmail] = useState("");
  const [detailsGuestPhone, setDetailsGuestPhone] = useState("");
  const [detailsGuestContactSaving, setDetailsGuestContactSaving] = useState(false);
  const [paymentsDue, setPaymentsDue] = useState<Array<{
    reservationId: string;
    siteName: string | null;
    guestLabel: string;
    balanceDueCents: number;
    nextDueDate: string | null;
    isOverdue: boolean;
  }>>([]);
  const [resViewMode, setResViewMode] = useState<"list" | "calendar">("list");
  const [resCalendarStart, setResCalendarStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [archivedReservationsExpanded, setArchivedReservationsExpanded] = useState(false);

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
      fetch("/api/members/caretaker/payments-due")
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((data) => setPaymentsDue(data.items ?? []))
        .catch(() => setPaymentsDue([]));
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

  useEffect(() => {
    if (!resSiteId || !resCheckInDate || !resCheckOutDate || resCheckInDate >= resCheckOutDate) {
      setResQuotedTotalCents(null);
      setResQuotedNights(null);
      return;
    }
    const controller = new AbortController();
    setResQuoteLoading(true);
    const params = new URLSearchParams({
      siteId: resSiteId,
      checkInDate: resCheckInDate,
      checkOutDate: resCheckOutDate,
      type: resType,
    });
    fetch(`/api/members/caretaker/reservations/quote?${params}`, { signal: controller.signal })
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          setResQuotedTotalCents(null);
          setResQuotedNights(null);
          return;
        }
        setResQuotedTotalCents(
          typeof data.calculatedTotalCents === "number" ? data.calculatedTotalCents : null
        );
        setResQuotedNights(typeof data.nights === "number" ? data.nights : null);
      })
      .catch((err: Error) => {
        if (err.name !== "AbortError") {
          setResQuotedTotalCents(null);
          setResQuotedNights(null);
        }
      })
      .finally(() => setResQuoteLoading(false));
    return () => controller.abort();
  }, [resSiteId, resCheckInDate, resCheckOutDate, resType]);

  async function runCaretakerMemberLookup(
    body: Record<string, string>,
    onSuccess: (result: LookupResult) => void,
    onMatches: (matches: LookupMatch[]) => void,
    onError: (message: string) => void
  ) {
    const res = await fetch("/api/members/caretaker/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      onError(data.error ?? "Lookup failed");
      return;
    }
    if (data.multiple && Array.isArray(data.matches) && data.matches.length > 0) {
      onMatches(data.matches as LookupMatch[]);
      return;
    }
    if (!data.memberNumber) {
      onError("No member number on file for this contact");
      return;
    }
    onSuccess(data as LookupResult);
  }

  function applyReservationMemberLookup(result: LookupResult) {
    setResMemberLookup(result);
    setResMemberLookupMatches([]);
    setResMemberNumber(result.memberNumber);
    setResPastDueMaintenanceCents(Math.round((result.maintenanceFeesDue ?? 0) * 100));
    setResPastDueMembershipCents(Math.round((result.membershipDuesOwed ?? 0) * 100));
  }

  async function handleReservationMemberLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!resMemberNumber.trim()) return;
    setResMemberLookupLoading(true);
    setResError(null);
    setResMemberLookupMatches([]);
    try {
      const fields = parseCaretakerLookupInput(resMemberNumber);
      await runCaretakerMemberLookup(
        fields,
        applyReservationMemberLookup,
        setResMemberLookupMatches,
        (message) => {
          setResError(message);
          setResMemberLookup(null);
        }
      );
    } catch {
      setResError("Lookup failed");
      setResMemberLookup(null);
    } finally {
      setResMemberLookupLoading(false);
    }
  }

  async function handleReservationMemberPick(match: LookupMatch) {
    setResMemberLookupLoading(true);
    setResError(null);
    try {
      await runCaretakerMemberLookup(
        { contactId: match.contactId },
        applyReservationMemberLookup,
        setResMemberLookupMatches,
        (message) => {
          setResError(message);
          setResMemberLookup(null);
        }
      );
    } catch {
      setResError("Lookup failed");
      setResMemberLookup(null);
    } finally {
      setResMemberLookupLoading(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const earliestCheckIn = caretakerEarliestCheckInDate(today);
  const resEditCheckInMin = editingReservation
    ? caretakerEarliestCheckInDateForEdit(toDateOnly(editingReservation.checkInDate), today)
    : earliestCheckIn;
  const resNights =
    resQuotedNights ??
    (resCheckInDate && resCheckOutDate && resCheckInDate < resCheckOutDate
      ? countNights(resCheckInDate, resCheckOutDate)
      : 0);
  const resSelectedSite = sites.find((s) => s.id === resSiteId);
  const resLocalTotalCents =
    resNights > 0 && resSelectedSite
      ? computeStayPricing({
          checkInDate: resCheckInDate,
          checkOutDate: resCheckOutDate,
          isMember: resType === "member",
          rates: {
            memberRateDaily: resSelectedSite.memberRateDaily,
            memberRateMonthly: resSelectedSite.memberRateMonthly,
            nonMemberRateDaily: resSelectedSite.nonMemberRateDaily,
          },
        }).totalCents
      : 0;
  const resTotalCents = resQuotedTotalCents ?? resLocalTotalCents;
  const resAllowsCash = resCheckInDate ? caretakerAllowsCashCheckIn(resCheckInDate, today) : false;

  const createPricingResolved = useMemo(() => {
    const r = resolveCreateReservationPricing(Math.max(0, resTotalCents), {
      stayTotalOverrideDollars: resStayTotalOverride,
      overrideReason: resOverrideReason,
      paymentAmountDollars: resPaymentAmount,
    });
    return r.ok ? r : null;
  }, [resTotalCents, resStayTotalOverride, resOverrideReason, resPaymentAmount]);

  const resStayTotalCents = createPricingResolved?.stayTotalCents ?? resTotalCents;
  const resCollectCents = createPricingResolved?.collectCents ?? resStayTotalCents;
  const resBalanceAfterCents = createPricingResolved?.balanceAfterCents ?? 0;

  const resSuggestedFirstPeriodCents = useMemo(() => {
    if (!resSelectedSite || resNights < 1 || resStayTotalCents < 1) return null;
    let drafts = generateBillingPeriods({
      checkInDate: resCheckInDate,
      checkOutDate: resCheckOutDate,
      isMember: resType === "member",
      rates: {
        memberRateDaily: resSelectedSite.memberRateDaily,
        memberRateMonthly: resSelectedSite.memberRateMonthly,
        nonMemberRateDaily: resSelectedSite.nonMemberRateDaily,
      },
    });
    if (resStayTotalCents !== resTotalCents && resTotalCents > 0) {
      drafts = scalePeriodDraftsToTotal(drafts, resStayTotalCents);
    }
    return suggestedReservationPaymentCents(
      drafts.map((d) => ({
        status: "unpaid",
        amountDueCents: d.amountDueCents,
        amountPaidCents: 0,
      })),
      resStayTotalCents
    );
  }, [
    resSelectedSite,
    resNights,
    resCheckInDate,
    resCheckOutDate,
    resType,
    resStayTotalCents,
    resTotalCents,
  ]);

  function applyCreatePricingFields(body: Record<string, unknown>): string | null {
    const resolved = resolveCreateReservationPricing(Math.max(0, resTotalCents), {
      stayTotalOverrideDollars: resStayTotalOverride,
      overrideReason: resOverrideReason,
      paymentAmountDollars: resPaymentAmount,
    });
    if (!resolved.ok) return resolved.error;
    Object.assign(body, resolved.fields);
    return null;
  }

  const availableSitesForDropdown = sites.filter((s) => availableSiteIds.includes(s.id));

  useEffect(() => {
    if (resSiteId && !availableSitesForDropdown.some((s) => s.id === resSiteId)) {
      setResSiteId("");
    }
  }, [resSiteId, availableSitesForDropdown]);

  async function handleCreateReservationComp() {
    if (!resSiteId || !resCheckInDate || !resCheckOutDate) {
      setResError("Select site and dates");
      return;
    }
    if (resType === "member") {
      if (!resMemberLookup) {
        setResError("Look up member first");
        return;
      }
    } else if (!resGuestFirstName.trim() || !resGuestLastName.trim() || !resGuestEmail.trim()) {
      setResError("Enter guest name and email");
      return;
    }
    if (resTotalCents > 0 && resOverrideReason.trim().length < 3) {
      setResError("Override reason required for $0 comp");
      return;
    }
    setResError(null);
    setResSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        siteId: resSiteId,
        checkInDate: resCheckInDate,
        checkOutDate: resCheckOutDate,
        type: resType,
        paymentMethod: "none",
        recipientEmail:
          resType === "member"
            ? resMemberLookup?.email?.trim() || "noreply@ldma.org"
            : resGuestEmail.trim(),
        recipientDisplayName:
          resType === "member"
            ? resMemberLookup?.displayName || `#${resMemberLookup?.memberNumber}`
            : `${resGuestFirstName.trim()} ${resGuestLastName.trim()}`.trim() || "Guest",
      };
      const resolved = resolveCreateReservationPricing(Math.max(0, resTotalCents), {
        stayTotalOverrideDollars: "0",
        overrideReason: resOverrideReason,
        paymentAmountDollars: "0",
      });
      if (!resolved.ok) {
        setResError(resolved.error);
        return;
      }
      Object.assign(body, resolved.fields);
      body.paymentMethod = "none";
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

  async function handleCreateReservationCash(e: React.FormEvent) {
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
      if (!resMemberLookup.email?.trim()) {
        setResError("Member email is required for receipt; not on file. Use card payment or add email in Salesforce.");
        return;
      }
    } else {
      if (!resGuestFirstName.trim() || !resGuestLastName.trim() || !resGuestEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resGuestEmail.trim())) {
        setResError("Enter guest first name, last name, and valid email");
        return;
      }
    }
    if (resStayTotalCents === 0) {
      return handleCreateReservationComp();
    }
    if (resStayTotalCents < 1) {
      setResError("Invalid stay total");
      return;
    }
    if (resQuoteLoading) {
      setResError("Stay total is still loading — please wait a moment");
      return;
    }
    setResError(null);
    setResSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        siteId: resSiteId,
        checkInDate: resCheckInDate,
        checkOutDate: resCheckOutDate,
        type: resType,
        paymentMethod: "cash",
        recipientEmail: resType === "member" ? resMemberLookup!.email!.trim() : resGuestEmail.trim(),
        recipientDisplayName:
          resType === "member"
            ? resMemberLookup!.displayName || `#${resMemberLookup!.memberNumber}`
            : `${resGuestFirstName.trim()} ${resGuestLastName.trim()}`.trim() || "Guest",
      };
      const pricingErr = applyCreatePricingFields(body);
      if (pricingErr) {
        setResError(pricingErr);
        return;
      }
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

  async function handleCreateReservationCard(e: React.FormEvent) {
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
      if (!resMemberLookup.email?.trim()) {
        setResError("Member email is required for receipt; not on file. Use cash or add email in Salesforce.");
        return;
      }
    } else {
      if (!resGuestFirstName.trim() || !resGuestLastName.trim() || !resGuestEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resGuestEmail.trim())) {
        setResError("Enter guest first name, last name, and valid email");
        return;
      }
    }
    if (resStayTotalCents === 0) {
      return handleCreateReservationComp();
    }
    if (resStayTotalCents < 1) {
      setResError("Invalid stay total");
      return;
    }
    if (resQuoteLoading) {
      setResError("Stay total is still loading — please wait a moment");
      return;
    }
    setResError(null);
    setResSubmitting(true);
    try {
      const checkoutBody: Record<string, unknown> = {
        paymentType: "reservation",
        recipientEmail: resType === "member" ? (resMemberLookup?.email?.trim() || resGuestEmail.trim()) : resGuestEmail.trim(),
        recipientDisplayName: resType === "member" ? (resMemberLookup?.displayName || `#${resMemberLookup?.memberNumber}`) : `${resGuestFirstName.trim()} ${resGuestLastName.trim()}`.trim() || "Guest",
        siteId: resSiteId,
        checkInDate: resCheckInDate,
        checkOutDate: resCheckOutDate,
        nights: resNights,
        reservationType: resType,
      };
      const pricingErr = applyCreatePricingFields(checkoutBody);
      if (pricingErr) {
        setResError(pricingErr);
        return;
      }
      if (resType === "member" && resMemberLookup) {
        checkoutBody.memberContactId = resMemberLookup.contactId;
        checkoutBody.memberNumber = resMemberLookup.memberNumber;
        checkoutBody.memberDisplayName = resMemberLookup.displayName;
      } else {
        checkoutBody.guestFirstName = resGuestFirstName.trim();
        checkoutBody.guestLastName = resGuestLastName.trim();
        checkoutBody.guestEmail = resGuestEmail.trim();
        checkoutBody.guestPhone = resGuestPhone.trim() || undefined;
      }
      const res = await fetch("/api/members/caretaker/payments/checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checkoutBody),
      });
      const data = await res.json();
      if (!res.ok) {
        setResError(data.error ?? "Failed to start checkout");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setResError("No checkout URL returned");
    } catch {
      setResError("Failed to start checkout");
    } finally {
      setResSubmitting(false);
    }
  }

  function handleCreateReservation(e: React.FormEvent) {
    e.preventDefault();
    // Form submit from "Pay with cash" or "Pay with card" is handled by those buttons
  }

  function openResDetailsModal(r: Reservation, opts?: { focusPayment?: boolean }) {
    setDetailsFocusPayment(opts?.focusPayment ?? false);
    setDetailsReservation(r);
    setDetailsMemberLookup(null);
    setDetailsPastDueMaintenanceCents(0);
    setDetailsPastDueMembershipCents(0);
    setDetailsBillingPeriods([]);
    setDetailsSiteBalance(null);
    setDetailsPayments([]);
    setDetailsPaymentSummary(null);
    setDetailsContactLookupInput(r.memberNumber ?? "");
    setDetailsContactLookupMatches([]);
    setDetailsContactLookupResult(null);
    setDetailsContactEmail("");
    setDetailsContactPhone("");
    setDetailsContactError(null);
    setDetailsGuestEmail(r.guestEmail?.trim() ?? "");
    setDetailsGuestPhone(r.guestPhone?.trim() ?? "");
    setDetailsModalOpen(true);
    setDetailsLoading(true);

    const campQ = `?campSlug=${encodeURIComponent(campSlug)}`;
    fetch(`/api/members/caretaker/reservations/${r.id}${campQ}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((detail) => {
        if (detail) {
          setDetailsReservation((prev) => (prev ? { ...prev, ...detail } : prev));
          setDetailsBillingPeriods(detail.billingPeriods ?? []);
          setDetailsSiteBalance(detail.balance ?? null);
          setDetailsPayments(detail.payments ?? []);
          setDetailsPaymentSummary(detail.paymentSummary ?? null);
          setDetailsGuestEmail(detail.guestEmail?.trim() ?? "");
          setDetailsGuestPhone(detail.guestPhone?.trim() ?? "");
        }
      })
      .catch(() => {})
      .finally(() => setDetailsLoading(false));

    if (r.reservationType === "member" && (r.memberContactId || r.memberNumber)) {
      setDetailsMemberLoading(true);
      const lookupBody = r.memberContactId
        ? { contactId: r.memberContactId }
        : { memberNumber: r.memberNumber!.trim() };
      fetch("/api/members/caretaker/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lookupBody),
      })
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          const lookup = data?.multiple ? null : (data ?? null);
          setDetailsMemberLookup(lookup);
          if (lookup) {
            setDetailsContactEmail(lookup.email?.trim() || "");
            setDetailsContactPhone(lookup.phone?.trim() || "");
            setDetailsPastDueMaintenanceCents(Math.round((lookup.maintenanceFeesDue ?? 0) * 100));
            setDetailsPastDueMembershipCents(Math.round((lookup.membershipDuesOwed ?? 0) * 100));
          }
        })
        .catch(() => setDetailsMemberLookup(null))
        .finally(() => setDetailsMemberLoading(false));
    }
  }

  async function handleDetailsContactLookup() {
    const fields = parseCaretakerLookupInput(detailsContactLookupInput);
    if (!fields.memberNumber && !fields.email && !fields.phone) {
      setDetailsContactError("Enter member #, email, or phone");
      return;
    }
    setDetailsContactLookupLoading(true);
    setDetailsContactError(null);
    setDetailsContactLookupMatches([]);
    setDetailsContactLookupResult(null);
    try {
      const res = await fetch("/api/members/caretaker/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const data = await res.json();
      if (!res.ok) {
        setDetailsContactError(data.error ?? "Lookup failed");
        return;
      }
      if (data.multiple && Array.isArray(data.matches)) {
        setDetailsContactLookupMatches(data.matches);
        return;
      }
      setDetailsContactLookupResult(data as LookupResult);
    } catch {
      setDetailsContactError("Lookup failed");
    } finally {
      setDetailsContactLookupLoading(false);
    }
  }

  function handleDetailsContactPick(match: LookupMatch) {
    setDetailsContactLookupMatches([]);
    setDetailsContactLookupResult({
      contactId: match.contactId,
      memberNumber: match.memberNumber ?? "",
      displayName: match.displayName,
      email: match.email,
      phone: match.phone,
      isLdmaMember: true,
      maintenanceFeesDue: null,
      membershipDuesOwed: null,
      membershipBalance: null,
    });
  }

  async function handleDetailsContactLink() {
    if (!detailsReservation || !detailsContactLookupResult) return;
    setDetailsContactLinkSubmitting(true);
    setDetailsContactError(null);
    try {
      const campQ = `?campSlug=${encodeURIComponent(campSlug)}`;
      const res = await fetch(
        `/api/members/caretaker/reservations/${detailsReservation.id}/contact${campQ}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            linkMember: {
              contactId: detailsContactLookupResult.contactId,
              memberNumber: detailsContactLookupResult.memberNumber,
              memberDisplayName: detailsContactLookupResult.displayName,
            },
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setDetailsContactError(data.error ?? "Could not link contact");
        return;
      }
      setDetailsReservation((prev) =>
        prev
          ? {
              ...prev,
              memberContactId: data.memberContactId,
              memberNumber: data.memberNumber,
              memberDisplayName: data.memberDisplayName,
            }
          : prev
      );
      setDetailsMemberLookup(detailsContactLookupResult);
      setDetailsContactEmail(data.email?.trim() || detailsContactLookupResult.email?.trim() || "");
      setDetailsContactPhone(data.phone?.trim() || detailsContactLookupResult.phone?.trim() || "");
      setDetailsContactLookupResult(null);
      setDetailsContactLookupMatches([]);
      loadReservations();
    } catch {
      setDetailsContactError("Could not link contact");
    } finally {
      setDetailsContactLinkSubmitting(false);
    }
  }

  async function handleDetailsContactSave() {
    if (!detailsReservation?.memberContactId) return;
    setDetailsContactSaving(true);
    setDetailsContactError(null);
    try {
      const campQ = `?campSlug=${encodeURIComponent(campSlug)}`;
      const res = await fetch(
        `/api/members/caretaker/reservations/${detailsReservation.id}/contact${campQ}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            salesforceContact: {
              email: detailsContactEmail.trim(),
              phone: detailsContactPhone.trim(),
            },
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setDetailsContactError(data.error ?? "Save failed");
        return;
      }
      setDetailsMemberLookup((prev) =>
        prev
          ? {
              ...prev,
              email: detailsContactEmail.trim() || null,
              phone: detailsContactPhone.trim() || null,
            }
          : prev
      );
    } catch {
      setDetailsContactError("Save failed");
    } finally {
      setDetailsContactSaving(false);
    }
  }

  async function handleDetailsGuestContactSave() {
    if (!detailsReservation || detailsReservation.reservationType !== "guest") return;
    setDetailsGuestContactSaving(true);
    setDetailsContactError(null);
    try {
      const campQ = `?campSlug=${encodeURIComponent(campSlug)}`;
      const res = await fetch(
        `/api/members/caretaker/reservations/${detailsReservation.id}/contact${campQ}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            guestContact: {
              email: detailsGuestEmail.trim(),
              phone: detailsGuestPhone.trim(),
            },
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setDetailsContactError(data.error ?? "Save failed");
        return;
      }
      setDetailsReservation((prev) =>
        prev
          ? {
              ...prev,
              guestEmail: data.guestEmail ?? prev.guestEmail,
              guestPhone: data.guestPhone ?? prev.guestPhone,
            }
          : prev
      );
    } catch {
      setDetailsContactError("Save failed");
    } finally {
      setDetailsGuestContactSaving(false);
    }
  }

  function refreshDetailsReservation() {
    if (!detailsReservation) return;
    setDetailsLoading(true);
    const campQ = `?campSlug=${encodeURIComponent(campSlug)}`;
    fetch(`/api/members/caretaker/reservations/${detailsReservation.id}${campQ}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((detail) => {
        if (detail) {
          setDetailsReservation((prev) => (prev ? { ...prev, ...detail } : prev));
          setDetailsBillingPeriods(detail.billingPeriods ?? []);
          setDetailsSiteBalance(detail.balance ?? null);
          setDetailsPayments(detail.payments ?? []);
          setDetailsPaymentSummary(detail.paymentSummary ?? null);
          setDetailsGuestEmail(detail.guestEmail?.trim() ?? "");
          setDetailsGuestPhone(detail.guestPhone?.trim() ?? "");
        }
      })
      .catch(() => {})
      .finally(() => setDetailsLoading(false));
    loadReservations();
  }

  function openResEditModal(r: Reservation) {
    setEditingReservation(r);
    setResEditCheckInDate(toDateOnly(r.checkInDate));
    setResEditCheckOutDate(toDateOnly(r.checkOutDate));
    setResEditPaymentDueCents(null);
    setResEditPayAmountCents(0);
    setResEditPreview(null);
    setResEditPreviewError(null);
    setResEditIssueRefund(false);
    setResEditMemberLookup(null);
    setResEditModalOpen(true);
    if (r.reservationType === "member" && r.memberNumber) {
      fetch("/api/members/caretaker/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberNumber: r.memberNumber.trim() }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => setResEditMemberLookup(data ?? null))
        .catch(() => setResEditMemberLookup(null));
    }
  }

  function closeResEditModal() {
    setResEditModalOpen(false);
    setEditingReservation(null);
    setResEditPaymentDueCents(null);
    setResEditPayAmountCents(0);
    setResEditPreview(null);
    setResEditPreviewError(null);
    setResEditIssueRefund(false);
  }

  function pricingBasisLabel(basis: string): string {
    if (basis === "member_monthly_prorated") return "Monthly (prorated)";
    if (basis === "member_daily") return "Daily member rate";
    if (basis === "guest_daily") return "Daily guest rate";
    return basis;
  }

  async function handleResEditPreview(e: React.FormEvent) {
    e.preventDefault();
    if (!editingReservation) return;
    setResEditPreviewLoading(true);
    setResEditPreviewError(null);
    setResEditPreview(null);
    setResEditIssueRefund(false);
    try {
      const params = new URLSearchParams({
        checkInDate: resEditCheckInDate,
        checkOutDate: resEditCheckOutDate,
      });
      const res = await fetch(
        `/api/members/caretaker/reservations/${editingReservation.id}/edit-preview?${params}`
      );
      const data = await res.json();
      if (!res.ok) {
        setResEditPreviewError(data.error ?? "Could not preview date change");
        return;
      }
      setResEditPreview(data);
      setResEditIssueRefund(false);
    } catch {
      setResEditPreviewError("Could not preview date change");
    } finally {
      setResEditPreviewLoading(false);
    }
  }

  async function handleResEditConfirmSave() {
    if (!editingReservation || !resEditPreview) return;
    if (!resEditPreview.available) {
      setResEditPreviewError("Site is not available for the new dates");
      return;
    }
    setResEditSubmitting(true);
    setResEditPaymentDueCents(null);
    setResEditPreviewError(null);
    try {
      const res = await fetch(`/api/members/caretaker/reservations/${editingReservation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkInDate: resEditCheckInDate,
          checkOutDate: resEditCheckOutDate,
          issueRefund: resEditIssueRefund && (resEditPreview.creditCents ?? 0) > 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.requirePayment && typeof data.amountDueCents === "number") {
          setResEditPaymentDueCents(data.amountDueCents);
          setResEditPayAmountCents(data.amountDueCents);
          return;
        }
        setResEditPreviewError(data.error ?? "Update failed");
        return;
      }
      closeResEditModal();
      loadReservations();
    } catch {
      setResEditPreviewError("Update failed");
    } finally {
      setResEditSubmitting(false);
    }
  }

  function openResMoveModal(r: Reservation) {
    setMovingReservation(r);
    setResMoveNewSiteId("");
    setResMovePreview(null);
    setResMovePaymentDueCents(null);
    setResMoveError(null);
    setResMoveMemberLookup(null);
    setResMoveModalOpen(true);
    if (r.reservationType === "member" && r.memberNumber) {
      fetch("/api/members/caretaker/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberNumber: r.memberNumber.trim() }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => setResMoveMemberLookup(data ?? null))
        .catch(() => setResMoveMemberLookup(null));
    }
  }

  function closeResMoveModal() {
    setResMoveModalOpen(false);
    setMovingReservation(null);
    setResMovePreview(null);
    setResMovePaymentDueCents(null);
    setResMoveError(null);
  }

  async function loadResMovePreview(newSiteId: string) {
    if (!movingReservation || !newSiteId) return;
    setResMovePreviewLoading(true);
    setResMovePreview(null);
    setResMovePaymentDueCents(null);
    setResMoveError(null);
    try {
      const res = await fetch(
        `/api/members/caretaker/reservations/${movingReservation.id}/move-preview?newSiteId=${encodeURIComponent(newSiteId)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setResMoveError(data.error ?? "Could not preview move");
        return;
      }
      setResMovePreview(data);
    } catch {
      setResMoveError("Could not preview move");
    } finally {
      setResMovePreviewLoading(false);
    }
  }

  function resMoveRecipient() {
    if (!movingReservation) return null;
    const email =
      movingReservation.reservationType === "member"
        ? resMoveMemberLookup?.email?.trim() || movingReservation.guestEmail?.trim()
        : movingReservation.guestEmail?.trim();
    const displayName =
      movingReservation.reservationType === "member"
        ? movingReservation.memberDisplayName || `#${movingReservation.memberNumber}`
        : `${movingReservation.guestFirstName ?? ""} ${movingReservation.guestLastName ?? ""}`.trim() || "Guest";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
    return { email, displayName };
  }

  async function confirmResMove() {
    if (!movingReservation || !resMovePreview || !resMovePreview.available) return;
    setResMoveSubmitting(true);
    setResMoveError(null);
    try {
      const res = await fetch(`/api/members/caretaker/reservations/${movingReservation.id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newSiteId: resMovePreview.newSiteId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResMoveError(data.error ?? "Move failed");
        return;
      }
      if (data.requirePayment && typeof data.amountDueCents === "number") {
        setResMovePaymentDueCents(data.amountDueCents);
        setResMoveCashAllowed(Boolean(data.cashAllowed));
        return;
      }
      closeResMoveModal();
      loadReservations();
    } catch {
      setResMoveError("Move failed");
    } finally {
      setResMoveSubmitting(false);
    }
  }

  async function handleResMovePayCash() {
    if (!movingReservation || !resMovePreview || resMovePaymentDueCents == null || resMovePaymentDueCents < 1) return;
    const recipient = resMoveRecipient();
    if (!recipient) {
      setResMoveError("Recipient email required for receipt.");
      return;
    }
    setResMoveSubmitting(true);
    setResMoveError(null);
    try {
      const res = await fetch(`/api/members/caretaker/reservations/${movingReservation.id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newSiteId: resMovePreview.newSiteId,
          paymentMethod: "cash",
          amountCents: resMovePaymentDueCents,
          recipientEmail: recipient.email,
          recipientDisplayName: recipient.displayName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResMoveError(data.error ?? "Payment failed");
        return;
      }
      closeResMoveModal();
      loadReservations();
    } catch {
      setResMoveError("Payment failed");
    } finally {
      setResMoveSubmitting(false);
    }
  }

  async function handleResMovePayCard() {
    if (!movingReservation || !resMovePreview || resMovePaymentDueCents == null || resMovePaymentDueCents < 1) return;
    const recipient = resMoveRecipient();
    if (!recipient) {
      setResMoveError("Recipient email required for receipt.");
      return;
    }
    setResMoveSubmitting(true);
    setResMoveError(null);
    try {
      const checkoutBody: Record<string, unknown> = {
        amountCents: resMovePaymentDueCents,
        paymentType: "reservation",
        reservationId: movingReservation.id,
        recipientEmail: recipient.email,
        recipientDisplayName: recipient.displayName,
        siteId: resMovePreview.newSiteId,
        checkInDate: toDateOnly(movingReservation.checkInDate),
        checkOutDate: toDateOnly(movingReservation.checkOutDate),
        nights: countNights(toDateOnly(movingReservation.checkInDate), toDateOnly(movingReservation.checkOutDate)),
        reservationType: movingReservation.reservationType,
      };
      if (movingReservation.reservationType === "member") {
        checkoutBody.memberContactId = movingReservation.memberContactId ?? "";
        checkoutBody.memberNumber = movingReservation.memberNumber ?? "";
        checkoutBody.memberDisplayName = movingReservation.memberDisplayName ?? "";
      } else {
        checkoutBody.guestFirstName = movingReservation.guestFirstName ?? "";
        checkoutBody.guestLastName = movingReservation.guestLastName ?? "";
        checkoutBody.guestEmail = movingReservation.guestEmail ?? "";
        checkoutBody.guestPhone = movingReservation.guestPhone ?? undefined;
      }
      const res = await fetch("/api/members/caretaker/payments/checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checkoutBody),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setResMoveError(data.error ?? "Failed to start checkout");
        return;
      }
      window.location.href = data.url;
    } catch {
      setResMoveError("Checkout failed");
    } finally {
      setResMoveSubmitting(false);
    }
  }

  async function handleDetailsPayPastDueCash() {
    if (!detailsReservation || detailsReservation.reservationType !== "member" || !detailsMemberLookup) return;
    const totalCents = detailsPastDueMaintenanceCents + detailsPastDueMembershipCents;
    if (totalCents < 1) {
      alert("Enter amounts to pay");
      return;
    }
    const recipientEmail = detailsMemberLookup.email?.trim();
    if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      alert("Member email required for receipt; not on file.");
      return;
    }
    setDetailsPastDueSubmitting(true);
    try {
      const res = await fetch("/api/members/caretaker/payments/record-cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentType: "past_due",
          amountCents: totalCents,
          maintenanceAmountCents: detailsPastDueMaintenanceCents,
          membershipAmountCents: detailsPastDueMembershipCents,
          memberContactId: detailsMemberLookup.contactId,
          memberNumber: detailsMemberLookup.memberNumber,
          recipientEmail,
          recipientDisplayName: detailsMemberLookup.displayName || `#${detailsMemberLookup.memberNumber}`,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Payment failed");
        return;
      }
      setDetailsModalOpen(false);
      setDetailsReservation(null);
      setDetailsMemberLookup(null);
      loadReservations();
    } catch {
      alert("Payment failed");
    } finally {
      setDetailsPastDueSubmitting(false);
    }
  }

  async function handleResPayPastDueCash() {
    if (!resMemberLookup) return;
    const totalCents = resPastDueMaintenanceCents + resPastDueMembershipCents;
    if (totalCents < 1) {
      setResError("Enter amounts to pay");
      return;
    }
    const recipientEmail = resMemberLookup.email?.trim();
    if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      setResError("Member email required for receipt; not on file.");
      return;
    }
    setResPastDueSubmitting(true);
    setResError(null);
    try {
      const res = await fetch("/api/members/caretaker/payments/record-cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentType: "past_due",
          amountCents: totalCents,
          maintenanceAmountCents: resPastDueMaintenanceCents,
          membershipAmountCents: resPastDueMembershipCents,
          memberContactId: resMemberLookup.contactId,
          memberNumber: resMemberLookup.memberNumber,
          recipientEmail,
          recipientDisplayName: resMemberLookup.displayName || `#${resMemberLookup.memberNumber}`,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setResError(data.error ?? "Payment failed");
        return;
      }
      setResPastDueMaintenanceCents(0);
      setResPastDueMembershipCents(0);
      loadReservations();
    } catch {
      setResError("Payment failed");
    } finally {
      setResPastDueSubmitting(false);
    }
  }

  async function handleResPayPastDueCard() {
    if (!resMemberLookup) return;
    const totalCents = resPastDueMaintenanceCents + resPastDueMembershipCents;
    if (totalCents < 1) {
      setResError("Enter amounts to pay");
      return;
    }
    const recipientEmail = resMemberLookup.email?.trim();
    if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      setResError("Member email required for receipt; not on file.");
      return;
    }
    setResPastDueSubmitting(true);
    setResError(null);
    try {
      const res = await fetch("/api/members/caretaker/payments/checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents: totalCents,
          paymentType: "past_due",
          recipientEmail,
          recipientDisplayName: resMemberLookup.displayName || `#${resMemberLookup.memberNumber}`,
          maintenanceAmountCents: resPastDueMaintenanceCents,
          membershipAmountCents: resPastDueMembershipCents,
          memberContactId: resMemberLookup.contactId,
          memberNumber: resMemberLookup.memberNumber,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResError(data.error ?? "Checkout failed");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setResError("Checkout failed");
    } catch {
      setResError("Checkout failed");
    } finally {
      setResPastDueSubmitting(false);
    }
  }

  async function handleDetailsPayPastDueCard() {
    if (!detailsReservation || detailsReservation.reservationType !== "member" || !detailsMemberLookup) return;
    const totalCents = detailsPastDueMaintenanceCents + detailsPastDueMembershipCents;
    if (totalCents < 1) {
      alert("Enter amounts to pay");
      return;
    }
    const recipientEmail = detailsMemberLookup.email?.trim();
    if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      alert("Member email required for receipt; not on file.");
      return;
    }
    setDetailsPastDueSubmitting(true);
    try {
      const res = await fetch("/api/members/caretaker/payments/checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents: totalCents,
          paymentType: "past_due",
          recipientEmail,
          recipientDisplayName: detailsMemberLookup.displayName || `#${detailsMemberLookup.memberNumber}`,
          maintenanceAmountCents: detailsPastDueMaintenanceCents,
          membershipAmountCents: detailsPastDueMembershipCents,
          memberContactId: detailsMemberLookup.contactId,
          memberNumber: detailsMemberLookup.memberNumber,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Checkout failed");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      alert("Checkout failed");
    } catch {
      alert("Checkout failed");
    } finally {
      setDetailsPastDueSubmitting(false);
    }
  }

  const resEditNights =
    resEditCheckInDate && resEditCheckOutDate && resEditCheckInDate < resEditCheckOutDate
      ? countNights(resEditCheckInDate, resEditCheckOutDate)
      : 0;
  const resEditAllowsCash =
    editingReservation && resEditCheckInDate
      ? caretakerAllowsCashCheckIn(resEditCheckInDate, today)
      : false;

  async function handleResEditPayCash() {
    if (!editingReservation || resEditPaymentDueCents == null || resEditPaymentDueCents < 1) return;
    const payAmount = Math.min(
      Math.max(1, resEditPayAmountCents),
      resEditPaymentDueCents
    );
    const recipientEmail =
      editingReservation.reservationType === "member"
        ? resEditMemberLookup?.email?.trim()
        : editingReservation.guestEmail?.trim();
    const recipientDisplayName =
      editingReservation.reservationType === "member"
        ? (resEditMemberLookup?.displayName || `#${editingReservation.memberNumber}`)
        : `${editingReservation.guestFirstName ?? ""} ${editingReservation.guestLastName ?? ""}`.trim() || "Guest";
    if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      alert("Recipient email required for receipt. For members, ensure lookup has email on file.");
      return;
    }
    setResEditSubmitting(true);
    try {
      const res = await fetch(`/api/members/caretaker/reservations/${editingReservation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkInDate: resEditCheckInDate,
          checkOutDate: resEditCheckOutDate,
          paymentMethod: "cash",
          amountCents: payAmount,
          recipientEmail,
          recipientDisplayName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Payment failed");
        return;
      }
      closeResEditModal();
      loadReservations();
    } catch {
      alert("Payment failed");
    } finally {
      setResEditSubmitting(false);
    }
  }

  async function handleResEditPayCard() {
    if (!editingReservation || resEditPaymentDueCents == null || resEditPaymentDueCents < 1) return;
    const payAmount = Math.min(
      Math.max(1, resEditPayAmountCents),
      resEditPaymentDueCents
    );
    const recipientEmail =
      editingReservation.reservationType === "member"
        ? resEditMemberLookup?.email?.trim()
        : editingReservation.guestEmail?.trim();
    const recipientDisplayName =
      editingReservation.reservationType === "member"
        ? (resEditMemberLookup?.displayName || `#${editingReservation.memberNumber}`)
        : `${editingReservation.guestFirstName ?? ""} ${editingReservation.guestLastName ?? ""}`.trim() || "Guest";
    if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      alert("Recipient email required for receipt. For members, ensure lookup has email on file.");
      return;
    }
    setResEditSubmitting(true);
    try {
      const checkoutBody: Record<string, unknown> = {
        amountCents: payAmount,
        paymentType: "reservation",
        reservationId: editingReservation.id,
        recipientEmail,
        recipientDisplayName,
        siteId: editingReservation.siteId,
        checkInDate: resEditCheckInDate,
        checkOutDate: resEditCheckOutDate,
        nights: resEditNights,
        reservationType: editingReservation.reservationType,
      };
      if (editingReservation.reservationType === "member") {
        checkoutBody.memberContactId = editingReservation.memberContactId ?? "";
        checkoutBody.memberNumber = editingReservation.memberNumber ?? "";
        checkoutBody.memberDisplayName = editingReservation.memberDisplayName ?? "";
      } else {
        checkoutBody.guestFirstName = editingReservation.guestFirstName ?? "";
        checkoutBody.guestLastName = editingReservation.guestLastName ?? "";
        checkoutBody.guestEmail = editingReservation.guestEmail ?? "";
        checkoutBody.guestPhone = editingReservation.guestPhone ?? undefined;
      }
      const res = await fetch("/api/members/caretaker/payments/checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checkoutBody),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Checkout failed");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      alert("Checkout failed");
    } catch {
      alert("Checkout failed");
    } finally {
      setResEditSubmitting(false);
    }
  }

  function openResCancelModal(r: Reservation) {
    setCancellingReservation(r);
    setResCancelPreview(null);
    setResCancelError(null);
    setResCancelWaiveFee(false);
    setResCancelModalOpen(true);
    void loadResCancelPreview(r.id, false);
  }

  async function loadResCancelPreview(reservationId: string, waiveCancellationFee: boolean) {
    setResCancelPreviewLoading(true);
    setResCancelError(null);
    const campQ = `?campSlug=${encodeURIComponent(campSlug)}${waiveCancellationFee ? "&waiveCancellationFee=1" : ""}`;
    try {
      const res = await fetch(`/api/members/caretaker/reservations/${reservationId}/cancel-preview${campQ}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setResCancelError((data as { error?: string }).error ?? "Could not load refund preview");
        setResCancelPreview(null);
        return;
      }
      const data = await res.json();
      setResCancelPreview(data.preview ?? null);
    } catch {
      setResCancelPreview(null);
      setResCancelError("Could not load refund preview");
    } finally {
      setResCancelPreviewLoading(false);
    }
  }

  async function handleResCancelConfirm() {
    if (!cancellingReservation) return;
    setResCancelSubmitting(true);
    setResCancelError(null);
    try {
      const campQ = `?campSlug=${encodeURIComponent(campSlug)}`;
      const res = await fetch(
        `/api/members/caretaker/reservations/${cancellingReservation.id}/cancel${campQ}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ waiveCancellationFee: resCancelWaiveFee }),
        }
      );
      const text = await res.text();
      let data: { error?: string };
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        setResCancelError(!res.ok ? `Cancel failed (${res.status}). ${text.slice(0, 120)}` : "Cancel failed: invalid response");
        return;
      }
      if (!res.ok) {
        setResCancelError(data.error ?? `Cancel failed (${res.status})`);
        return;
      }
      setResCancelModalOpen(false);
      setCancellingReservation(null);
      setResCancelPreview(null);
      setResCancelError(null);
      setResCancelWaiveFee(false);
      setResError(null);
      loadReservations();
    } catch {
      setResCancelError("Cancel failed");
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

  // Reservation system UI (Burnt River)
  if (usesReservations) {
    return (
      <div className="space-y-8 caretaker-themed">
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

        {paymentsDue.length > 0 && (
          <section className="p-4 bg-amber-950/20 border border-amber-500/30 rounded-lg">
            <h2 className="font-semibold text-amber-200 mb-2 text-sm">Payments to collect</h2>
            <ul className="space-y-2">
              {paymentsDue.map((item) => (
                <li key={item.reservationId}>
                  <button
                    type="button"
                    onClick={() => {
                      const r = activeReservations.find((x) => x.id === item.reservationId);
                      if (r) openResDetailsModal(r, { focusPayment: true });
                    }}
                    className="w-full flex flex-wrap justify-between gap-2 text-sm text-[#e8e0d5] rounded-lg px-2 py-1.5 hover:bg-[#d4af37]/10 text-left"
                  >
                    <span>
                      {item.siteName ?? "Site"} — {item.guestLabel}
                      {item.nextDueDate ? ` · due ${item.nextDueDate}` : ""}
                    </span>
                    <span className={item.isOverdue ? "text-red-300 font-medium" : "text-amber-200"}>
                      {item.isOverdue ? "Overdue " : "Due "}{formatCentsAsCurrency(item.balanceDueCents)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="font-semibold text-[#f0d48f] flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Active reservations
            </h2>
            <div className="flex rounded-lg border border-[#d4af37]/30 p-0.5 bg-[#0f0a06]/60">
              <button
                type="button"
                onClick={() => setResViewMode("list")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${resViewMode === "list" ? "bg-[#d4af37] text-[#1a120b]" : "text-[#e8e0d5]/80 hover:text-[#e8e0d5]"}`}
              >
                List
              </button>
              <button
                type="button"
                onClick={() => setResViewMode("calendar")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${resViewMode === "calendar" ? "bg-[#d4af37] text-[#1a120b]" : "text-[#e8e0d5]/80 hover:text-[#e8e0d5]"}`}
              >
                Calendar
              </button>
            </div>
          </div>
          {reservationsLoading ? (
            <p className="text-[#e8e0d5]/60">Loading…</p>
          ) : resViewMode === "calendar" ? (
            <>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <label className="text-[#e8e0d5]/80 text-sm">Start date:</label>
                <input
                  type="date"
                  value={resCalendarStart}
                  onChange={(e) => setResCalendarStart(e.target.value.slice(0, 10))}
                  className="px-2 py-1.5 bg-[#0f0a06] border border-[#d4af37]/30 rounded text-[#e8e0d5] text-sm"
                />
                <span className="text-[#e8e0d5]/50 text-sm">(45-day view)</span>
              </div>
              {sites.length === 0 ? (
                <p className="text-[#e8e0d5]/60">No sites loaded.</p>
              ) : (
                <ReservationCalendarView
                  reservations={activeReservations}
                  sites={sites.map((s) => ({ id: s.id, name: s.name, siteType: s.siteType }))}
                  onSelectReservation={(r) => openResDetailsModal(r as Reservation)}
                  startDate={resCalendarStart}
                  numDays={45}
                />
              )}
            </>
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
                    {r.eventProductHandle ? <span className="text-xs px-1.5 py-0.5 rounded bg-[#d4af37]/20 text-[#f0d48f]">Event{r.eventSiteType === "upgrade_hookup" ? " (hookup)" : ""}</span> : null}
                    <ReservationDateRange checkInDate={r.checkInDate} checkOutDate={r.checkOutDate} nights={r.nights} />
                    {r.checkedInAt ? (
                      <span className="ml-1 px-2 py-0.5 rounded bg-[#0f3d1e] text-[#6dd472] text-sm">Checked in</span>
                    ) : null}
                    <PaymentDueBadge
                      balanceDueCents={r.balanceDueCents ?? 0}
                      hasOverdue={r.hasOverdueSiteFee}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    {(r.balanceDueCents ?? 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => openResDetailsModal(r, { focusPayment: true })}
                        className="px-3 py-1.5 text-sm bg-amber-950/50 text-amber-200 border border-amber-500/40 rounded hover:bg-amber-900/40"
                      >
                        Collect payment
                      </button>
                    )}
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
                    <button type="button" onClick={() => openResMoveModal(r)} className="px-3 py-1.5 text-sm bg-[#2a1f14] border border-[#d4af37]/40 text-[#f0d48f] rounded hover:bg-[#d4af37]/10">
                      Move site
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
          <button
            type="button"
            onClick={() => setArchivedReservationsExpanded((v) => !v)}
            className="flex items-center gap-2 w-full text-left font-semibold text-[#e8e0d5]/80 mb-3 hover:text-[#e8e0d5]"
          >
            {archivedReservationsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            Archived reservations
            {!reservationsLoading && archivedReservations.length > 0 && (
              <span className="text-sm font-normal text-[#e8e0d5]/60">({archivedReservations.length})</span>
            )}
          </button>
          {archivedReservationsExpanded && (
            reservationsLoading ? null : archivedReservations.length === 0 ? (
              <p className="text-[#e8e0d5]/60">No archived reservations.</p>
            ) : (
              <ul className="space-y-2">
                {archivedReservations.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3 bg-[#0f0a06]/40 border border-[#d4af37]/10 rounded-lg text-[#e8e0d5]/80">
                    <span>
                      {r.siteName ?? "Site"} — {r.reservationType === "member" ? (r.memberDisplayName || `#${r.memberNumber}`) : `${r.guestFirstName} ${r.guestLastName}`}
                      {r.status === "cancelled" ? (
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-red-950/60 text-red-300">Cancelled</span>
                      ) : null}
                      {r.cancellationFeeWaived ? (
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-200">Cancel fee waived</span>
                      ) : null}
                      {r.eventProductHandle ? <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-[#d4af37]/20 text-[#f0d48f]">Event{r.eventSiteType === "upgrade_hookup" ? " (hookup)" : ""}</span> : null}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{r.checkInDate} – {r.checkOutDate}</span>
                      <button
                        type="button"
                        onClick={() => openResDetailsModal(r)}
                        className="px-3 py-1.5 text-sm bg-[#1a120b] text-[#e8e0d5] border border-[#d4af37]/40 rounded hover:bg-[#d4af37]/10"
                      >
                        Details
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )
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
                  <DatePickerWithCalendar value={resCheckInDate} onChange={setResCheckInDate} min={earliestCheckIn} placeholder="Select check-in" id="res-check-in" />
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
                    {availableSitesForDropdown.map((s) => (
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
                        <input type="text" value={resMemberNumber} onChange={(e) => { setResMemberNumber(e.target.value); setResMemberLookup(null); setResMemberLookupMatches([]); }} placeholder="Member #, email, or phone" className="flex-1 px-4 py-2.5 bg-[#0f0a06] border border-[#d4af37]/30 rounded-lg text-[#e8e0d5]" />
                        <button type="button" onClick={handleReservationMemberLookup} disabled={resMemberLookupLoading || !resMemberNumber.trim()} className="px-4 py-2.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg disabled:opacity-50 flex items-center gap-2">
                          {resMemberLookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Look up
                        </button>
                      </div>
                      {resMemberLookupMatches.length > 0 && (
                        <div className="rounded-lg border border-amber-500/40 bg-amber-950/20 p-3 space-y-2">
                          <p className="text-amber-200/90 text-xs font-medium">Multiple members matched — select one:</p>
                          {resMemberLookupMatches.map((m) => (
                            <button
                              key={m.contactId}
                              type="button"
                              onClick={() => handleReservationMemberPick(m)}
                              disabled={resMemberLookupLoading}
                              className="w-full text-left px-3 py-2 rounded border border-[#d4af37]/20 bg-[#0f0a06]/80 hover:border-[#d4af37]/50 disabled:opacity-50"
                            >
                              <p className="text-[#e8e0d5] text-sm font-medium">{m.displayName}{m.memberNumber ? ` (#${m.memberNumber})` : ""}</p>
                              <p className="text-[#e8e0d5]/60 text-xs">
                                {[m.email, m.phone].filter(Boolean).join(" · ") || "No email or phone on file"}
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                      {resMemberLookup && (
                        <div className="text-sm space-y-2">
                          <p className="text-[#e8e0d5]">✓ {resMemberLookup.displayName} (#{resMemberLookup.memberNumber})</p>
                          {(resMemberLookup.maintenanceFeesDue != null && resMemberLookup.maintenanceFeesDue > 0) || (resMemberLookup.membershipDuesOwed != null && resMemberLookup.membershipDuesOwed > 0) ? (
                            <>
                              <p className="text-[#f0d48f] text-xs font-medium mt-2">Membership & maintenance (Salesforce)</p>
                              <p className="text-amber-400/90">
                                {(resMemberLookup.maintenanceFeesDue != null && resMemberLookup.maintenanceFeesDue > 0) && `Maintenance past due: ${formatCurrency(resMemberLookup.maintenanceFeesDue)}`}
                                {(resMemberLookup.maintenanceFeesDue != null && resMemberLookup.maintenanceFeesDue > 0) && (resMemberLookup.membershipDuesOwed != null && resMemberLookup.membershipDuesOwed > 0) && " · "}
                                {(resMemberLookup.membershipDuesOwed != null && resMemberLookup.membershipDuesOwed > 0) && `Membership dues owed: ${formatCurrency(resMemberLookup.membershipDuesOwed)}`}
                              </p>
                              <div className="pt-2 border-t border-[#d4af37]/20 space-y-2">
                                <p className="text-[#e8e0d5]/80 text-xs">Pay past due now (optional)</p>
                                <div className="flex gap-2 items-center">
                                  <label className="text-[#e8e0d5]/80 text-xs shrink-0">Maintenance $</label>
                                  <input type="number" min={0} step={0.01} value={resPastDueMaintenanceCents / 100} onChange={(e) => setResPastDueMaintenanceCents(Math.round((parseFloat(e.target.value) || 0) * 100))} className="w-20 px-2 py-1 bg-[#0f0a06] border border-[#d4af37]/30 rounded text-[#e8e0d5] text-sm" />
                                  <label className="text-[#e8e0d5]/80 text-xs shrink-0">Membership $</label>
                                  <input type="number" min={0} step={0.01} value={resPastDueMembershipCents / 100} onChange={(e) => setResPastDueMembershipCents(Math.round((parseFloat(e.target.value) || 0) * 100))} className="w-20 px-2 py-1 bg-[#0f0a06] border border-[#d4af37]/30 rounded text-[#e8e0d5] text-sm" />
                                </div>
                                {resPastDueMaintenanceCents + resPastDueMembershipCents > 0 && (
                                  <div className="flex gap-2">
                                    <button type="button" onClick={handleResPayPastDueCash} disabled={resPastDueSubmitting} className="py-1.5 px-3 bg-[#d4af37] text-[#1a120b] font-semibold rounded text-xs disabled:opacity-50 flex items-center gap-1">
                                      {resPastDueSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Pay past due (cash)
                                    </button>
                                    <button type="button" onClick={handleResPayPastDueCard} disabled={resPastDueSubmitting} className="py-1.5 px-3 border border-[#d4af37]/50 text-[#f0d48f] font-semibold rounded text-xs disabled:opacity-50 flex items-center gap-1">
                                      {resPastDueSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Pay past due (card)
                                    </button>
                                  </div>
                                )}
                              </div>
                            </>
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
                {resTotalCents > 0 && (
                  <div className="pt-2 border-t border-[#d4af37]/20 space-y-3">
                    <p className="text-[#e8e0d5] font-medium">
                      Calculated stay total: {formatCentsAsCurrency(resTotalCents)}
                      {resQuoteLoading ? (
                        <span className="text-[#e8e0d5]/50 text-xs font-normal"> (updating…)</span>
                      ) : null}
                      {resNights > 0 ? (
                        <span className="text-[#e8e0d5]/60 text-xs font-normal">
                          {" "}
                          · {resNights} night{resNights === 1 ? "" : "s"}
                        </span>
                      ) : null}
                      {resStayTotalCents !== resTotalCents && (
                        <span className="text-amber-300">
                          {" "}
                          → Stay total: {formatCentsAsCurrency(resStayTotalCents)}
                        </span>
                      )}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[#e8e0d5]/70 text-xs block mb-1">Collect now $</label>
                        <input
                          type="number"
                          min={0}
                          max={resStayTotalCents / 100}
                          step={0.01}
                          value={resPaymentAmount}
                          onChange={(e) => setResPaymentAmount(e.target.value)}
                          placeholder={(resCollectCents / 100).toFixed(2)}
                          className="w-full px-3 py-2 bg-[#0f0a06] border border-[#d4af37]/30 rounded-lg text-[#e8e0d5] text-sm"
                        />
                        {resSuggestedFirstPeriodCents != null &&
                          resSuggestedFirstPeriodCents > 0 &&
                          resSuggestedFirstPeriodCents < resStayTotalCents && (
                            <button
                              type="button"
                              onClick={() =>
                                setResPaymentAmount((resSuggestedFirstPeriodCents / 100).toFixed(2))
                              }
                              className="mt-1 text-xs text-[#d4af37] hover:underline"
                            >
                              Use first period ({formatCentsAsCurrency(resSuggestedFirstPeriodCents)})
                            </button>
                          )}
                      </div>
                      <div>
                        <label className="text-[#e8e0d5]/70 text-xs block mb-1">Adjust stay total $ (optional)</label>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={resStayTotalOverride}
                          onChange={(e) => setResStayTotalOverride(e.target.value)}
                          placeholder="Discount / comp on full stay"
                          className="w-full px-3 py-2 bg-[#0f0a06] border border-[#d4af37]/30 rounded-lg text-[#e8e0d5] text-sm"
                        />
                      </div>
                    </div>
                    <input
                      type="text"
                      value={resOverrideReason}
                      onChange={(e) => setResOverrideReason(e.target.value)}
                      placeholder="Reason if stay total differs from calculated"
                      className="w-full px-3 py-2 bg-[#0f0a06] border border-[#d4af37]/30 rounded-lg text-[#e8e0d5] text-sm"
                    />
                    {resBalanceAfterCents > 0 && (
                      <p className="text-amber-300/90 text-xs">
                        Balance after this payment: {formatCentsAsCurrency(resBalanceAfterCents)} (collect later in
                        reservation details)
                      </p>
                    )}
                    <p className="text-[#e8e0d5]/60 text-xs">
                      Pay with cash at the camp or send a card checkout link.
                    </p>
                  </div>
                )}
                <div className="flex flex-col gap-2 pt-2">
                  <div className="flex gap-2">
                    {resStayTotalCents === 0 ? (
                      <button type="button" onClick={() => void handleCreateReservationComp()} disabled={resSubmitting} className="flex-1 py-2.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] disabled:opacity-50 flex items-center justify-center gap-2">
                        {resSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Create comp (no payment)
                      </button>
                    ) : (
                      <>
                        {resAllowsCash && (
                          <button type="button" onClick={handleCreateReservationCash} disabled={resSubmitting} className="flex-1 py-2.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] disabled:opacity-50 flex items-center justify-center gap-2">
                            {resSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Pay with cash
                          </button>
                        )}
                        <button type="button" onClick={handleCreateReservationCard} disabled={resSubmitting} className={resAllowsCash ? "flex-1 py-2.5 bg-[#2a1f14] border border-[#d4af37]/50 text-[#f0d48f] font-semibold rounded-lg hover:bg-[#d4af37]/10 disabled:opacity-50 flex items-center justify-center gap-2" : "flex-1 py-2.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] disabled:opacity-50 flex items-center justify-center gap-2"}>
                          {resSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Pay with card
                        </button>
                      </>
                    )}
                  </div>
                  <button type="button" onClick={() => setCreateResModalOpen(false)} className="py-2.5 text-[#e8e0d5]/80 hover:text-[#d4af37]">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Reservation details modal */}
        {detailsModalOpen && detailsReservation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={() => setDetailsModalOpen(false)}>
            <div className="bg-[#1a120b] border border-[#d4af37]/30 rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-[#f0d48f]">Reservation details</h3>
                <button type="button" onClick={() => { setDetailsModalOpen(false); setDetailsFocusPayment(false); }} className="text-[#e8e0d5]/60 hover:text-[#e8e0d5]"><X className="w-5 h-5" /></button>
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
                <div className="flex flex-wrap gap-4">
                  <div>
                    <p className="text-[#e8e0d5]/60 mb-0.5">Status</p>
                    <p className="text-[#e8e0d5]">{reservationStatusLabel(detailsReservation)}</p>
                  </div>
                  {detailsReservation.status === "cancelled" && detailsReservation.cancelledAt && (
                    <div>
                      <p className="text-[#e8e0d5]/60 mb-0.5">Cancelled</p>
                      <p className="text-[#e8e0d5]">{toDateOnly(detailsReservation.cancelledAt)}</p>
                    </div>
                  )}
                  {detailsReservation.cancellationFeeWaived && (
                    <div>
                      <p className="text-[#e8e0d5]/60 mb-0.5">Cancel fee</p>
                      <p className="text-amber-200">Waived{detailsReservation.cancellationFeeWaivedCents != null ? ` (${formatCentsAsCurrency(detailsReservation.cancellationFeeWaivedCents)})` : ""}</p>
                    </div>
                  )}
                  {detailsReservation.createdAt && (
                    <div>
                      <p className="text-[#e8e0d5]/60 mb-0.5">Created</p>
                      <p className="text-[#e8e0d5]">{toDateOnly(detailsReservation.createdAt)}</p>
                    </div>
                  )}
                  {detailsReservation.invoiceNumber && (
                    <div>
                      <p className="text-[#e8e0d5]/60 mb-0.5">Invoice</p>
                      <p className="text-[#e8e0d5] font-mono text-xs">{detailsReservation.invoiceNumber}</p>
                    </div>
                  )}
                </div>
                {detailsReservation.priceOverrideFlag && (
                  <div className="rounded border border-amber-500/30 bg-amber-950/20 p-2 text-xs text-amber-100/90">
                    Price override: charged {formatCentsAsCurrency(detailsReservation.amountOverrideCents ?? 0)} vs calculated {formatCentsAsCurrency(detailsReservation.calculatedTotalCents ?? 0)}
                    {detailsReservation.overrideReason ? ` — ${detailsReservation.overrideReason}` : ""}
                  </div>
                )}
                {detailsReservation.cancellationFeeWaived && (
                  <div className="rounded border border-amber-500/30 bg-amber-950/20 p-2 text-xs text-amber-100/90">
                    Cancellation fee waived
                    {detailsReservation.cancellationFeeWaivedCents != null
                      ? ` (${formatCentsAsCurrency(detailsReservation.cancellationFeeWaivedCents)})`
                      : ""}
                    {detailsReservation.cancellationFeeWaivedAt
                      ? ` on ${toDateOnly(detailsReservation.cancellationFeeWaivedAt)}`
                      : ""}
                    .
                  </div>
                )}
                {detailsReservation.eventProductHandle ? (
                  <div>
                    <p className="text-[#e8e0d5]/60 mb-0.5">Event (legacy)</p>
                    <p className="text-[#e8e0d5]">
                      {EVENT_RESERVATION_PRODUCTS.find((ev) => ev.handle === detailsReservation.eventProductHandle)?.label ?? detailsReservation.eventProductHandle}
                      {detailsReservation.eventSiteType === "upgrade_hookup" ? " (hookup upgrade)" : " (included dry)"}
                    </p>
                  </div>
                ) : null}

                {detailsReservation.status === "cancelled" && detailsPaymentSummary && (
                  <div className="rounded-lg border border-red-900/40 bg-red-950/20 p-3 space-y-2">
                    <p className="text-red-200/90 font-medium text-sm">Refund summary</p>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#e8e0d5]/70">Site fees paid</span>
                      <span>{formatCentsAsCurrency(detailsPaymentSummary.totalPaidCents)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#e8e0d5]/70">Refunded</span>
                      <span className="text-red-300">−{formatCentsAsCurrency(detailsPaymentSummary.totalRefundedCents)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold text-[#f0d48f] pt-1 border-t border-[#d4af37]/20">
                      <span>Net retained</span>
                      <span>{formatCentsAsCurrency(detailsPaymentSummary.netPaidCents)}</span>
                    </div>
                    {detailsReservation.cancellationRefundCents != null && detailsReservation.cancellationRefundCents > 0 && (
                      <p className="text-[#e8e0d5]/50 text-xs">
                        Policy refund amount: {formatCentsAsCurrency(detailsReservation.cancellationRefundCents)}
                      </p>
                    )}
                  </div>
                )}

                {detailsLoading ? (
                  <p className="text-[#e8e0d5]/60 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading billing…</p>
                ) : reservationIsArchived(detailsReservation) && detailsReservation.status !== "cancelled" && detailsSiteBalance ? (
                  <div className="rounded-lg border border-[#d4af37]/15 bg-[#0f0a06]/80 p-3 space-y-2">
                    <p className="text-[#f0d48f] font-medium text-sm">Stay summary</p>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#e8e0d5]/70">Total site fees</span>
                      <span>{formatCentsAsCurrency(detailsSiteBalance.totalDueCents)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#e8e0d5]/70">Total paid</span>
                      <span>{formatCentsAsCurrency(detailsSiteBalance.totalPaidCents)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold pt-1 border-t border-[#d4af37]/20">
                      <span className="text-[#e8e0d5]/70">Balance due</span>
                      <span className={detailsSiteBalance.balanceDueCents > 0 ? "text-amber-400" : "text-[#6dd472]"}>
                        {detailsSiteBalance.balanceDueCents > 0
                          ? formatCentsAsCurrency(detailsSiteBalance.balanceDueCents)
                          : "Paid in full"}
                      </span>
                    </div>
                  </div>
                ) : !reservationIsArchived(detailsReservation) && detailsSiteBalance ? (
                  <ReservationBillingSection
                    key={`${detailsReservation.id}-${detailsSiteBalance.balanceDueCents}`}
                    reservationId={detailsReservation.id}
                    checkInDate={toDateOnly(detailsReservation.checkInDate)}
                    balance={detailsSiteBalance}
                    billingPeriods={detailsBillingPeriods}
                    recipientEmail={
                      detailsReservation.reservationType === "member"
                        ? detailsMemberLookup?.email?.trim() || ""
                        : detailsReservation.guestEmail?.trim() || ""
                    }
                    recipientDisplayName={
                      detailsReservation.reservationType === "member"
                        ? detailsReservation.memberDisplayName || `#${detailsReservation.memberNumber}`
                        : `${detailsReservation.guestFirstName ?? ""} ${detailsReservation.guestLastName ?? ""}`.trim() || "Guest"
                    }
                    onPaymentComplete={refreshDetailsReservation}
                    autoFocusAmount={detailsFocusPayment}
                  />
                ) : null}

                {reservationIsArchived(detailsReservation) && detailsBillingPeriods.length > 0 && (
                  <div className="pt-2 border-t border-[#d4af37]/20">
                    <p className="text-[#f0d48f] font-medium text-sm mb-2">Billing periods</p>
                    <ul className="space-y-1.5 text-xs">
                      {detailsBillingPeriods.map((p) => (
                        <li key={p.id} className="flex flex-wrap justify-between gap-2 text-[#e8e0d5]/80">
                          <span>
                            {p.periodStart} – {p.periodEnd} ({p.nights} night{p.nights === 1 ? "" : "s"})
                          </span>
                          <span>
                            {formatCentsAsCurrency(p.amountPaidCents)} / {formatCentsAsCurrency(p.amountDueCents)}
                            {" · "}
                            <span className="capitalize">{p.status.replace(/_/g, " ")}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {detailsPayments.length > 0 && (
                  <div className="pt-2 border-t border-[#d4af37]/20">
                    <p className="text-[#f0d48f] font-medium text-sm mb-2">Payment history</p>
                    <ul className="space-y-2 text-xs">
                      {detailsPayments.map((p) => (
                        <li key={p.id} className="text-[#e8e0d5]/80">
                          {p.paymentType === "refund" ? (
                            <span className="text-red-300">Refund {formatCentsAsCurrency(p.amountCents)}</span>
                          ) : (
                            <span className="text-[#e8e0d5]">{formatCentsAsCurrency(p.amountCents)}</span>
                          )}
                          {" · "}{p.method === "card" ? "Card" : "Cash"}
                          {" · "}{toDateOnly(p.createdAt)}
                          {p.stripePaymentIntentId && (
                            <p className="text-[#e8e0d5]/50 font-mono truncate" title={p.stripePaymentIntentId}>PI: {p.stripePaymentIntentId}</p>
                          )}
                          {p.method === "cash" && p.paymentType !== "refund" && (
                            <p className="text-[#e8e0d5]/50 font-mono truncate" title={p.id}>ID: {p.id}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {detailsReservation.reservationType === "member" ? (
                  <>
                    <div>
                      <p className="text-[#e8e0d5]/60 mb-0.5">Member</p>
                      <p className="text-[#e8e0d5] font-medium">
                        {detailsReservation.memberDisplayName || detailsMemberLookup?.displayName || "Member"}
                      </p>
                      {(detailsReservation.memberNumber || detailsMemberLookup?.memberNumber) && (
                        <p className="text-[#e8e0d5]/80">
                          Member # {detailsReservation.memberNumber || detailsMemberLookup?.memberNumber}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-[#d4af37]/20 space-y-3">
                      <p className="text-[#f0d48f] font-medium text-sm">Salesforce contact</p>
                      {detailsContactError && (
                        <p className="text-red-400 text-xs">{detailsContactError}</p>
                      )}

                      {!detailsReservation.memberContactId ? (
                        <div className="space-y-2">
                          <p className="text-amber-400/90 text-xs">
                            Not linked to Salesforce — look up the member to connect this reservation.
                          </p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={detailsContactLookupInput}
                              onChange={(e) => setDetailsContactLookupInput(e.target.value)}
                              placeholder="Member #, email, or phone"
                              className="flex-1 px-3 py-2 bg-[#0f0a06] border border-[#d4af37]/30 rounded-lg text-[#e8e0d5] text-sm"
                            />
                            <button
                              type="button"
                              onClick={handleDetailsContactLookup}
                              disabled={detailsContactLookupLoading || !detailsContactLookupInput.trim()}
                              className="px-3 py-2 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg text-sm disabled:opacity-50 flex items-center gap-1"
                            >
                              {detailsContactLookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                              Look up
                            </button>
                          </div>
                          {detailsContactLookupMatches.length > 0 && (
                            <div className="rounded-lg border border-amber-500/40 bg-amber-950/20 p-2 space-y-2">
                              <p className="text-amber-200/90 text-xs font-medium">Multiple matches — select one:</p>
                              {detailsContactLookupMatches.map((m) => (
                                <button
                                  key={m.contactId}
                                  type="button"
                                  onClick={() => handleDetailsContactPick(m)}
                                  className="w-full text-left px-3 py-2 rounded border border-[#d4af37]/20 bg-[#0f0a06]/80 hover:border-[#d4af37]/50"
                                >
                                  <p className="text-[#e8e0d5] text-sm font-medium">
                                    {m.displayName}{m.memberNumber ? ` (#${m.memberNumber})` : ""}
                                  </p>
                                  <p className="text-[#e8e0d5]/60 text-xs">
                                    {[m.email, m.phone].filter(Boolean).join(" · ") || "No email or phone on file"}
                                  </p>
                                </button>
                              ))}
                            </div>
                          )}
                          {detailsContactLookupResult && (
                            <div className="rounded-lg border border-[#d4af37]/25 bg-[#0f0a06]/80 p-3 space-y-2">
                              <p className="text-[#e8e0d5] text-sm">
                                ✓ {detailsContactLookupResult.displayName}
                                {detailsContactLookupResult.memberNumber
                                  ? ` (#${detailsContactLookupResult.memberNumber})`
                                  : ""}
                              </p>
                              <p className="text-[#e8e0d5]/60 text-xs">
                                {[detailsContactLookupResult.email, detailsContactLookupResult.phone]
                                  .filter(Boolean)
                                  .join(" · ") || "No email or phone on file"}
                              </p>
                              <button
                                type="button"
                                onClick={handleDetailsContactLink}
                                disabled={detailsContactLinkSubmitting}
                                className="w-full py-2 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-1"
                              >
                                {detailsContactLinkSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                Link to reservation
                              </button>
                            </div>
                          )}
                        </div>
                      ) : detailsMemberLoading ? (
                        <p className="text-[#e8e0d5]/60 text-sm">Loading contact…</p>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-[#6dd472]/90 text-xs">Linked to Salesforce</p>
                          <div>
                            <label className="block text-[#e8e0d5]/60 text-xs mb-1">Email</label>
                            <input
                              type="email"
                              value={detailsContactEmail}
                              onChange={(e) => setDetailsContactEmail(e.target.value)}
                              className="w-full px-3 py-2 bg-[#0f0a06] border border-[#d4af37]/30 rounded-lg text-[#e8e0d5] text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-[#e8e0d5]/60 text-xs mb-1">Phone</label>
                            <input
                              type="tel"
                              value={detailsContactPhone}
                              onChange={(e) => setDetailsContactPhone(e.target.value)}
                              className="w-full px-3 py-2 bg-[#0f0a06] border border-[#d4af37]/30 rounded-lg text-[#e8e0d5] text-sm"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handleDetailsContactSave}
                            disabled={detailsContactSaving}
                            className="py-2 px-4 bg-[#2a1f14] border border-[#d4af37]/50 text-[#f0d48f] font-semibold rounded-lg text-sm disabled:opacity-50 flex items-center gap-1"
                          >
                            {detailsContactSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            Save to Salesforce
                          </button>
                        </div>
                      )}
                    </div>

                    {!reservationIsArchived(detailsReservation) && detailsMemberLookup && (
                      <div className="pt-2 border-t border-[#d4af37]/20 space-y-2">
                        <p className="text-[#f0d48f] font-medium text-sm">Membership & maintenance (Salesforce)</p>
                        <p className="text-[#e8e0d5]/60 text-xs">Separate from site fees above.</p>
                        {(detailsMemberLookup.maintenanceFeesDue != null && detailsMemberLookup.maintenanceFeesDue > 0) || (detailsMemberLookup.membershipDuesOwed != null && detailsMemberLookup.membershipDuesOwed > 0) ? (
                          <>
                            {detailsMemberLookup.maintenanceFeesDue != null && detailsMemberLookup.maintenanceFeesDue > 0 && (
                              <p className="text-[#e8e0d5]">Maintenance past due: <span className="text-amber-400">{formatCurrency(detailsMemberLookup.maintenanceFeesDue)}</span></p>
                            )}
                            {detailsMemberLookup.membershipDuesOwed != null && detailsMemberLookup.membershipDuesOwed > 0 && (
                              <p className="text-[#e8e0d5]">Membership dues owed: <span className="text-amber-400">{formatCurrency(detailsMemberLookup.membershipDuesOwed)}</span></p>
                            )}
                            <div className="pt-3 space-y-2">
                              <p className="text-[#e8e0d5]/80 text-sm">Pay past due (optional)</p>
                              <div className="flex gap-2 items-center">
                                <label className="text-[#e8e0d5]/80 text-sm shrink-0">Maintenance $</label>
                                <input type="number" min={0} step={0.01} value={detailsPastDueMaintenanceCents / 100} onChange={(e) => setDetailsPastDueMaintenanceCents(Math.round((parseFloat(e.target.value) || 0) * 100))} className="w-24 px-2 py-1.5 bg-[#0f0a06] border border-[#d4af37]/30 rounded text-[#e8e0d5] text-sm" />
                              </div>
                              <div className="flex gap-2 items-center">
                                <label className="text-[#e8e0d5]/80 text-sm shrink-0">Membership $</label>
                                <input type="number" min={0} step={0.01} value={detailsPastDueMembershipCents / 100} onChange={(e) => setDetailsPastDueMembershipCents(Math.round((parseFloat(e.target.value) || 0) * 100))} className="w-24 px-2 py-1.5 bg-[#0f0a06] border border-[#d4af37]/30 rounded text-[#e8e0d5] text-sm" />
                              </div>
                              {detailsPastDueMaintenanceCents + detailsPastDueMembershipCents > 0 && (
                                <>
                                  <p className="text-[#e8e0d5] text-sm">Total: <strong>{formatCentsAsCurrency(detailsPastDueMaintenanceCents + detailsPastDueMembershipCents)}</strong></p>
                                  <div className="flex gap-2">
                                    <button type="button" onClick={handleDetailsPayPastDueCash} disabled={detailsPastDueSubmitting} className="flex-1 py-2 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-1">
                                      {detailsPastDueSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Pay cash
                                    </button>
                                    <button type="button" onClick={handleDetailsPayPastDueCard} disabled={detailsPastDueSubmitting} className="flex-1 py-2 bg-[#2a1f14] border border-[#d4af37]/50 text-[#f0d48f] font-semibold rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-1">
                                      {detailsPastDueSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Pay card
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </>
                        ) : (
                          <p className="text-[#e8e0d5]/80">No past-due amounts</p>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <p className="text-[#e8e0d5]/60 mb-0.5">Guest</p>
                      <p className="text-[#e8e0d5] font-medium">
                        {detailsReservation.guestFirstName} {detailsReservation.guestLastName}
                      </p>
                    </div>
                    <div className="pt-2 border-t border-[#d4af37]/20 space-y-2">
                      <p className="text-[#f0d48f] font-medium text-sm">Contact on reservation</p>
                      {detailsContactError && (
                        <p className="text-red-400 text-xs">{detailsContactError}</p>
                      )}
                      <div>
                        <label className="block text-[#e8e0d5]/60 text-xs mb-1">Email</label>
                        <input
                          type="email"
                          value={detailsGuestEmail}
                          onChange={(e) => setDetailsGuestEmail(e.target.value)}
                          className="w-full px-3 py-2 bg-[#0f0a06] border border-[#d4af37]/30 rounded-lg text-[#e8e0d5] text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[#e8e0d5]/60 text-xs mb-1">Phone</label>
                        <input
                          type="tel"
                          value={detailsGuestPhone}
                          onChange={(e) => setDetailsGuestPhone(e.target.value)}
                          className="w-full px-3 py-2 bg-[#0f0a06] border border-[#d4af37]/30 rounded-lg text-[#e8e0d5] text-sm"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleDetailsGuestContactSave}
                        disabled={detailsGuestContactSaving}
                        className="py-2 px-4 bg-[#2a1f14] border border-[#d4af37]/50 text-[#f0d48f] font-semibold rounded-lg text-sm disabled:opacity-50 flex items-center gap-1"
                      >
                        {detailsGuestContactSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Save contact
                      </button>
                    </div>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={() => !resEditSubmitting && !resEditPreviewLoading && closeResEditModal()}>
            <div className="bg-[#1a120b] border border-[#d4af37]/30 rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-[#f0d48f]">
                  {resEditPaymentDueCents != null
                    ? "Pay for additional nights"
                    : resEditPreview
                      ? "Review date change"
                      : "Edit reservation dates"}
                </h3>
                <button type="button" onClick={() => !resEditSubmitting && !resEditPreviewLoading && closeResEditModal()} className="text-[#e8e0d5]/60 hover:text-[#e8e0d5]"><X className="w-5 h-5" /></button>
              </div>
              <p className="text-[#e8e0d5]/80 text-sm mb-4">{editingReservation.siteName} — {editingReservation.reservationType === "member" ? editingReservation.memberDisplayName : `${editingReservation.guestFirstName} ${editingReservation.guestLastName}`}</p>
              {resEditPaymentDueCents != null ? (
                <div className="space-y-4">
                  <p className="text-[#e8e0d5]">
                    Additional amount due: <strong>{formatCentsAsCurrency(resEditPaymentDueCents)}</strong>
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-[#e8e0d5] mb-2">Payment amount $</label>
                    <input
                      type="number"
                      min={0.01}
                      max={resEditPaymentDueCents / 100}
                      step={0.01}
                      value={resEditPayAmountCents / 100}
                      onChange={(e) =>
                        setResEditPayAmountCents(Math.round((parseFloat(e.target.value) || 0) * 100))
                      }
                      className="w-full px-4 py-2.5 bg-[#0f0a06] border border-[#d4af37]/30 rounded-lg text-[#e8e0d5]"
                    />
                    <p className="text-[#e8e0d5]/50 text-xs mt-1">
                      Partial payment allowed — up to {formatCentsAsCurrency(resEditPaymentDueCents)} for this date change.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {resEditAllowsCash && (
                      <button type="button" onClick={handleResEditPayCash} disabled={resEditSubmitting} className="flex-1 py-2.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2">
                        {resEditSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Pay cash
                      </button>
                    )}
                    <button type="button" onClick={handleResEditPayCard} disabled={resEditSubmitting} className="flex-1 py-2.5 bg-[#2a1f14] border border-[#d4af37]/50 text-[#f0d48f] font-semibold rounded-lg hover:bg-[#d4af37]/10 disabled:opacity-50 flex items-center justify-center gap-2">
                      {resEditSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Pay card
                    </button>
                  </div>
                  <button type="button" onClick={() => { setResEditPaymentDueCents(null); setResEditPreview(null); }} className="w-full py-2.5 text-[#e8e0d5]/80 hover:text-[#d4af37]">Back to dates</button>
                </div>
              ) : resEditPreview ? (
                <div className="space-y-4">
                  <div className="bg-[#0f0a06]/80 border border-[#d4af37]/15 rounded-lg p-3 text-sm space-y-1.5">
                    <div className="flex justify-between text-[#e8e0d5]/80">
                      <span>Current</span>
                      <span>
                        {resEditPreview.current.nights} nights · {formatCentsAsCurrency(resEditPreview.current.totalCents)}
                      </span>
                    </div>
                    <p className="text-[#e8e0d5]/50 text-xs">
                      {resEditPreview.current.checkInDate} → {resEditPreview.current.checkOutDate} · {pricingBasisLabel(resEditPreview.current.pricingBasis)}
                    </p>
                    <div className="flex justify-between text-[#f0d48f] font-medium pt-1 border-t border-[#d4af37]/20">
                      <span>New total</span>
                      <span>
                        {resEditPreview.proposed.nights} nights · {formatCentsAsCurrency(resEditPreview.proposed.totalCents)}
                      </span>
                    </div>
                    <p className="text-[#e8e0d5]/50 text-xs">
                      {resEditPreview.proposed.checkInDate} → {resEditPreview.proposed.checkOutDate} · {pricingBasisLabel(resEditPreview.proposed.pricingBasis)}
                    </p>
                    <div className="flex justify-between text-[#e8e0d5]/80 pt-1">
                      <span>Already paid</span>
                      <span>{formatCentsAsCurrency(resEditPreview.netPaidCents)}</span>
                    </div>
                    {resEditPreview.additionalDueCents > 0 && (
                      <div className="flex justify-between text-amber-200 font-medium">
                        <span>Amount due</span>
                        <span>{formatCentsAsCurrency(resEditPreview.additionalDueCents)}</span>
                      </div>
                    )}
                    {resEditPreview.creditCents > 0 && (
                      <div className="flex justify-between text-[#6dd472] font-medium">
                        <span>Credit / refund available</span>
                        <span>{formatCentsAsCurrency(resEditPreview.creditCents)}</span>
                      </div>
                    )}
                    {resEditPreview.creditCents > 0 && (
                      <p className="text-[#e8e0d5]/50 text-xs pt-1">
                        {resEditPreview.refundBreakdown.stripeRefundCents > 0 &&
                          `Card: ${formatCentsAsCurrency(resEditPreview.refundBreakdown.stripeRefundCents)}`}
                        {resEditPreview.refundBreakdown.stripeRefundCents > 0 &&
                          resEditPreview.refundBreakdown.cashRefundCents > 0 &&
                          " · "}
                        {resEditPreview.refundBreakdown.cashRefundCents > 0 &&
                          `Cash: ${formatCentsAsCurrency(resEditPreview.refundBreakdown.cashRefundCents)}`}
                      </p>
                    )}
                  </div>
                  {!resEditPreview.available && (
                    <p className="text-red-400 text-sm">Site is not available for these dates.</p>
                  )}
                  {resEditPreview.creditCents > 0 && (
                    <label className="flex items-start gap-2 text-sm text-[#e8e0d5]/90 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={resEditIssueRefund}
                        disabled={resEditSubmitting}
                        onChange={(e) => setResEditIssueRefund(e.target.checked)}
                      />
                      <span>
                        Issue refund of {formatCentsAsCurrency(resEditPreview.creditCents)} on save
                        {resEditPreview.refundBreakdown.stripeRefundCents > 0
                          ? " (card first, then cash)"
                          : " (cash)"}
                        .
                      </span>
                    </label>
                  )}
                  {resEditPreview.creditCents > 0 && !resEditIssueRefund && (
                    <p className="text-[#e8e0d5]/50 text-xs">
                      If unchecked, the credit stays on the reservation (no refund issued).
                    </p>
                  )}
                  {resEditPreview.additionalDueCents > 0 && (
                    <p className="text-[#e8e0d5]/50 text-xs">
                      Confirming will ask for payment of the additional amount.
                    </p>
                  )}
                  {resEditPreviewError && <p className="text-red-400 text-sm">{resEditPreviewError}</p>}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setResEditPreview(null); setResEditPreviewError(null); setResEditIssueRefund(false); }}
                      disabled={resEditSubmitting}
                      className="flex-1 py-2.5 text-[#e8e0d5]/80 hover:text-[#d4af37]"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleResEditConfirmSave}
                      disabled={
                        resEditSubmitting ||
                        !resEditPreview.available ||
                        resEditPreview.datesUnchanged
                      }
                      className="flex-1 py-2.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {resEditSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Confirm save
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleResEditPreview}>
                  <label className="block text-sm font-medium text-[#e8e0d5] mb-2">Check-in date</label>
                  <DatePickerWithCalendar
                    value={resEditCheckInDate}
                    onChange={(v) => { setResEditCheckInDate(v); setResEditPreview(null); setResEditPreviewError(null); }}
                    min={resEditCheckInMin}
                    id="edit-res-check-in"
                  />
                  <label className="block text-sm font-medium text-[#e8e0d5] mb-2 mt-3">Check-out date</label>
                  <DatePickerWithCalendar
                    value={resEditCheckOutDate}
                    onChange={(v) => { setResEditCheckOutDate(v); setResEditPreview(null); setResEditPreviewError(null); }}
                    min={resEditCheckInDate || today}
                    id="edit-res-check-out"
                  />
                  <p className="text-[#e8e0d5]/50 text-xs mb-4 mt-2">Preview the rerate before saving. Shortening does not auto-refund.</p>
                  {resEditPreviewError && <p className="mb-3 text-red-400 text-sm">{resEditPreviewError}</p>}
                  <div className="flex gap-2">
                    <button type="button" onClick={closeResEditModal} className="flex-1 py-2.5 text-[#e8e0d5]/80 hover:text-[#d4af37]">Cancel</button>
                    <button
                      type="submit"
                      disabled={
                        resEditPreviewLoading ||
                        !resEditCheckInDate ||
                        !resEditCheckOutDate ||
                        resEditCheckInDate >= resEditCheckOutDate
                      }
                      className="flex-1 py-2.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {resEditPreviewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Preview
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Move reservation to a different site */}
        {resMoveModalOpen && movingReservation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={() => !resMoveSubmitting && closeResMoveModal()}>
            <div className="bg-[#1a120b] border border-[#d4af37]/30 rounded-xl shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-[#f0d48f]">{resMovePaymentDueCents != null ? "Charge site difference" : "Move to a different site"}</h3>
                <button type="button" onClick={() => !resMoveSubmitting && closeResMoveModal()} className="text-[#e8e0d5]/60 hover:text-[#e8e0d5]"><X className="w-5 h-5" /></button>
              </div>
              <p className="text-[#e8e0d5]/80 text-sm mb-4">
                {movingReservation.siteName} — {movingReservation.reservationType === "member" ? movingReservation.memberDisplayName : `${movingReservation.guestFirstName} ${movingReservation.guestLastName}`} · {toDateOnly(movingReservation.checkInDate)} → {toDateOnly(movingReservation.checkOutDate)}
              </p>

              {resMovePaymentDueCents != null ? (
                <div className="space-y-4">
                  <p className="text-[#e8e0d5]">Additional amount due: <strong>{formatCentsAsCurrency(resMovePaymentDueCents)}</strong></p>
                  {resMoveError && <p className="text-red-300 text-sm">{resMoveError}</p>}
                  <div className="flex gap-2">
                    {resMoveCashAllowed && (
                      <button type="button" onClick={handleResMovePayCash} disabled={resMoveSubmitting} className="flex-1 py-2.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2">
                        {resMoveSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Pay cash
                      </button>
                    )}
                    <button type="button" onClick={handleResMovePayCard} disabled={resMoveSubmitting} className="flex-1 py-2.5 bg-[#2a1f14] border border-[#d4af37]/50 text-[#f0d48f] font-semibold rounded-lg hover:bg-[#d4af37]/10 disabled:opacity-50 flex items-center justify-center gap-2">
                      {resMoveSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Pay card
                    </button>
                  </div>
                  <p className="text-[#e8e0d5]/50 text-xs">The reservation has already been moved. Collect the difference to settle the balance.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#e8e0d5] mb-2">Destination site</label>
                    <select
                      value={resMoveNewSiteId}
                      onChange={(e) => {
                        setResMoveNewSiteId(e.target.value);
                        if (e.target.value) loadResMovePreview(e.target.value);
                        else setResMovePreview(null);
                      }}
                      className="w-full px-4 py-2.5 bg-[#0f0a06] border border-[#d4af37]/30 rounded-lg text-[#e8e0d5]"
                    >
                      <option value="">Select a site…</option>
                      {sites.filter((s) => s.id !== movingReservation.siteId).map((s) => (
                        <option key={s.id} value={s.id}>{s.name}{s.siteType ? ` (${s.siteType})` : ""}</option>
                      ))}
                    </select>
                  </div>

                  {resMovePreviewLoading ? (
                    <div className="flex items-center gap-2 text-[#e8e0d5]/70 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Checking availability & price…</div>
                  ) : resMovePreview ? (
                    <div className="bg-[#0f0a06]/80 border border-[#d4af37]/15 rounded-lg p-3 text-sm space-y-1.5">
                      {!resMovePreview.available ? (
                        <p className="text-red-300">Not available for these dates. Pick another site.</p>
                      ) : (
                        <>
                          <div className="flex justify-between text-[#e8e0d5]/80"><span>New stay total</span><span>{formatCentsAsCurrency(resMovePreview.newTotalCents)}</span></div>
                          <div className="flex justify-between text-[#e8e0d5]/80"><span>Paid so far</span><span>{formatCentsAsCurrency(resMovePreview.netPaidCents)}</span></div>
                          {resMovePreview.additionalDueCents > 0 ? (
                            <div className="flex justify-between text-amber-400 font-medium pt-1 border-t border-[#d4af37]/20"><span>Additional to collect</span><span>{formatCentsAsCurrency(resMovePreview.additionalDueCents)}</span></div>
                          ) : resMovePreview.refundCents > 0 ? (
                            <div className="flex justify-between text-[#6dd472] font-medium pt-1 border-t border-[#d4af37]/20"><span>Refund on move</span><span>{formatCentsAsCurrency(resMovePreview.refundCents)}</span></div>
                          ) : (
                            <div className="flex justify-between text-[#6dd472] font-medium pt-1 border-t border-[#d4af37]/20"><span>No price change</span><span>$0.00</span></div>
                          )}
                          {resMovePreview.refundCents > 0 && resMovePreview.refundBreakdown.stripeRefundCents > 0 && (
                            <p className="text-[#e8e0d5]/50 text-xs">
                              {formatCentsAsCurrency(resMovePreview.refundBreakdown.stripeRefundCents)} back to card
                              {resMovePreview.refundBreakdown.cashRefundCents > 0 ? ` · ${formatCentsAsCurrency(resMovePreview.refundBreakdown.cashRefundCents)} cash` : ""}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  ) : null}

                  {resMoveError && <p className="text-red-300 text-sm">{resMoveError}</p>}

                  <div className="flex gap-2">
                    <button type="button" onClick={closeResMoveModal} className="flex-1 py-2.5 text-[#e8e0d5]/80 hover:text-[#d4af37]">Cancel</button>
                    <button type="button" onClick={confirmResMove} disabled={resMoveSubmitting || resMovePreviewLoading || !resMovePreview || !resMovePreview.available} className="flex-1 py-2.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2">
                      {resMoveSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      {resMovePreview && resMovePreview.refundCents > 0 ? "Move & refund" : "Move site"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Cancel reservation modal */}
        {resCancelModalOpen && cancellingReservation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={() => !resCancelSubmitting && (setResCancelModalOpen(false), setCancellingReservation(null), setResCancelPreview(null), setResCancelError(null), setResCancelWaiveFee(false))}>
            <div className="bg-[#1a120b] border border-[#d4af37]/30 rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-[#f0d48f]">Cancel reservation</h3>
                <button type="button" onClick={() => !resCancelSubmitting && (setResCancelModalOpen(false), setCancellingReservation(null), setResCancelPreview(null), setResCancelError(null), setResCancelWaiveFee(false))} className="text-[#e8e0d5]/60 hover:text-[#e8e0d5]"><X className="w-5 h-5" /></button>
              </div>
              <p className="text-[#e8e0d5]/90 text-sm mb-3">
                Cancel this reservation for {cancellingReservation.siteName} — {cancellingReservation.reservationType === "member" ? cancellingReservation.memberDisplayName : `${cancellingReservation.guestFirstName} ${cancellingReservation.guestLastName}`}?
              </p>
              {resCancelPreviewLoading ? (
                <div className="flex items-center gap-2 text-[#e8e0d5]/70 text-sm mb-4">
                  <Loader2 className="w-4 h-4 animate-spin" /> Calculating refund…
                </div>
              ) : resCancelPreview ? (
                <div className="bg-[#0f0a06]/80 border border-[#d4af37]/15 rounded-lg p-3 mb-4 text-sm space-y-1.5">
                  <div className="flex justify-between text-[#e8e0d5]/80">
                    <span>Site fees paid</span>
                    <span>{formatCentsAsCurrency(resCancelPreview.totalPaidCents)}</span>
                  </div>
                  {resCancelPreview.earnedCents > 0 && (
                    <div className="flex justify-between text-[#e8e0d5]/80">
                      <span>Earned ({resCancelPreview.nightsStayed} night{resCancelPreview.nightsStayed === 1 ? "" : "s"})</span>
                      <span>−{formatCentsAsCurrency(resCancelPreview.earnedCents)}</span>
                    </div>
                  )}
                  {resCancelPreview.policyCancellationFeeCents > 0 && (
                    <div className={`flex justify-between ${resCancelPreview.cancellationFeeWaived ? "text-[#e8e0d5]/50 line-through" : "text-[#e8e0d5]/80"}`}>
                      <span>Cancellation fee</span>
                      <span>−{formatCentsAsCurrency(resCancelPreview.policyCancellationFeeCents)}</span>
                    </div>
                  )}
                  {resCancelPreview.cancellationFeeWaived && (
                    <p className="text-amber-200/90 text-xs">Cancellation fee waived by caretaker.</p>
                  )}
                  <div className="flex justify-between text-[#f0d48f] font-semibold pt-1 border-t border-[#d4af37]/20">
                    <span>Refund</span>
                    <span>{formatCentsAsCurrency(resCancelPreview.refundCents)}</span>
                  </div>
                  {resCancelPreview.refundCents > 0 && (
                    <p className="text-[#e8e0d5]/50 text-xs pt-1">
                      {resCancelPreview.stripeRefundCents > 0 && `Card: ${formatCentsAsCurrency(resCancelPreview.stripeRefundCents)}`}
                      {resCancelPreview.stripeRefundCents > 0 && resCancelPreview.cashRefundCents > 0 && " · "}
                      {resCancelPreview.cashRefundCents > 0 && `Cash: ${formatCentsAsCurrency(resCancelPreview.cashRefundCents)}`}
                    </p>
                  )}
                  {resCancelPreview.pricingMode === "full_refund" && (
                    <p className="text-[#e8e0d5]/50 text-xs">Full refund — cancelled 7+ days before check-in.</p>
                  )}
                </div>
              ) : (
                <p className="text-[#e8e0d5]/50 text-xs mb-4">Refund preview unavailable; cancellation will still apply policy rules.</p>
              )}
              {(resCancelPreview?.policyCancellationFeeCents ?? 0) > 0 && (
                <label className="mb-4 flex items-start gap-2 text-sm text-[#e8e0d5]/90 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={resCancelWaiveFee}
                    disabled={resCancelSubmitting || resCancelPreviewLoading}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setResCancelWaiveFee(next);
                      if (cancellingReservation) void loadResCancelPreview(cancellingReservation.id, next);
                    }}
                  />
                  <span>
                    Waive cancellation fee ({formatCentsAsCurrency(resCancelPreview?.policyCancellationFeeCents ?? 0)}).
                    This will be flagged on the reservation.
                  </span>
                </label>
              )}
              {resCancelError && <p className="mb-4 text-red-400 text-sm">{resCancelError}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => !resCancelSubmitting && (setResCancelModalOpen(false), setCancellingReservation(null), setResCancelPreview(null), setResCancelError(null), setResCancelWaiveFee(false))} className="flex-1 py-2.5 text-[#e8e0d5]/80 hover:text-[#d4af37]">Keep</button>
                <button type="button" onClick={handleResCancelConfirm} disabled={resCancelSubmitting || resCancelPreviewLoading} className="flex-1 py-2.5 bg-red-800/80 text-red-100 font-semibold rounded-lg hover:bg-red-700/80 disabled:opacity-50 flex items-center justify-center gap-2">
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
    <div className="p-6 bg-[#0f0a06]/60 border border-[#d4af37]/20 rounded-lg">
      <p className="text-[#e8e0d5]">
        The reservation system is not enabled for this camp. Contact support if you believe this is an error.
      </p>
    </div>
  );
}