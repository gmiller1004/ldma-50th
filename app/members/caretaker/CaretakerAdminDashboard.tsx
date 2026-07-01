"use client";

import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { ManualReservationPanel } from "./ManualReservationPanel";
import { AdminCampReservationsTab } from "./AdminCampReservationsTab";
import { ViewAsCaretakerButton } from "./CaretakerAdminViewControls";
import { ReservationBillingSection } from "./ReservationBillingSection";
import { formatCentsAsCurrency } from "@/lib/reservation-pricing";
import type { PaymentDueItem } from "@/lib/caretaker-site-ar";
import { ChevronDown, ChevronRight, Download, HelpCircle, Loader2, Tent } from "lucide-react";

type RosterRow = {
  contactId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  customerNumber: string | null;
  caretakerAtCampLabel: string;
  campSlug: string | null;
};

type CampRow = {
  slug: string;
  name: string;
  reservationsOnProperty: number;
  memberReservationsOnProperty: number;
  guestReservationsOnProperty: number;
  checkedInReservations: number;
  activeReservations: number;
  reservationsCreatedLast30Days: number;
  balanceDueCents: number;
  overdueCents: number;
  reservationsWithBalance: number;
  overdueReservations: number;
  assignedCaretakers: RosterRow[];
  reservationsCreatedLast30DaysByCaretaker: { caretakerContactId: string; count: number }[];
  stripeReservationCents: number;
  stripePastDueCents: number;
  stripeOtherCents: number;
  stripeTotalCents: number;
  stripePaymentCount: number;
};

type GlobalMetrics = {
  totalOnSiteReservations: number;
  totalMemberOnSite: number;
  totalGuestOnSite: number;
  totalCheckedIn: number;
  totalOpenReservations: number;
  totalReservationsCreated30d: number;
  totalBalanceDueCents: number;
  totalOverdueCents: number;
  totalReservationsWithBalance: number;
  stripeReservationCents: number;
  stripePastDueCents: number;
  stripeOtherCents: number;
  stripeTotalCents: number;
  stripePaymentCount: number;
  totalRosterAssignments: number;
};

type SortKey =
  | "name"
  | "onSite"
  | "membersOnSite"
  | "guestsOnSite"
  | "checkedIn"
  | "openRes"
  | "balanceDue"
  | "overdue"
  | "assigned"
  | "stripeTotal";

type ReservationRow = {
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
  checkedInAt: string | null;
  createdAt: string;
  invoiceNumber?: string | null;
  balanceDueCents?: number;
  siteFeesPaidCents?: number;
  siteFeesDueCents?: number;
  hasOverdueSiteFee?: boolean;
  nextSiteFeeDueDate?: string | null;
};

type StripePaymentRow = {
  id: string;
  createdAt: string;
  amountCents: number;
  paymentType: string;
  recipientDisplayName: string;
  memberEmail: string;
  reservationId: string | null;
  stripeCheckoutSessionId: string | null;
};

const COLUMN_HELP: Record<string, { title: string; body: string }> = {
  expand: {
    title: "Expand row",
    body: "Opens tabs: Overview, Reservations, Balances due (take payment), Stripe revenue, and Caretaker roster.",
  },
  camp: {
    title: "Camp",
    body: "LDMA directory campground. Lodging counts come from camp_reservations; caretakers from Salesforce.",
  },
  onSite: {
    title: "On site today",
    body: "Reserved or checked-in stays whose dates include today (members + guests).",
  },
  membersOnSite: {
    title: "Members on site",
    body: "Member reservations on site today (reserved or checked in).",
  },
  guestsOnSite: {
    title: "Guests on site",
    body: "Guest reservations on site today (reserved or checked in).",
  },
  checkedIn: {
    title: "Checked in",
    body: "Active stays with status checked_in (checkout today or later).",
  },
  openRes: {
    title: "Open reservations",
    body: "Not cancelled; checkout is today or later.",
  },
  balanceDue: {
    title: "Site fees due",
    body: "Unpaid site-fee billing periods across all active reservations at this camp.",
  },
  overdue: {
    title: "Overdue",
    body: "Site-fee balance on billing periods past their due date.",
  },
  assigned: {
    title: "Assigned caretakers",
    body: "Contacts in Salesforce marked as LDMA caretaker with this camp on their record. They are the roster for who is assigned to the camp, not necessarily who performed every check-in.",
  },
  stripeProcessed: {
    title: "Processed",
    body: "When Stripe reported Checkout as completed and this payment row was written. This is card revenue processed through Stripe, not cash recorded at the camp.",
  },
  stripeAmount: {
    title: "Amount",
    body: "Total charged in this Checkout session (USD). For past-due payments it may combine maintenance and membership lines from one session.",
  },
  stripeType: {
    title: "Payment type",
    body: "Reservation: payment tied to a camp stay. Past due: maintenance and/or membership balance collected through the caretaker checkout flow.",
  },
  stripeRecipient: {
    title: "Recipient",
    body: "Display name stored on the payment for receipts—usually the member or guest paying.",
  },
  stripeEmail: {
    title: "Email",
    body: "Email on the payment record (used for Stripe Checkout and receipts).",
  },
  stripeReservation: {
    title: "Reservation",
    body: "Internal reservation ID when this payment was for a reservation or extension; blank for some past-due-only sessions.",
  },
  stripeCol: {
    title: "Stripe total (range)",
    body: "Sum of Stripe Checkout card payments for this camp in the date range selected in the toolbar (reservation + past-due + any other types). Database aggregate, not capped at 500 rows.",
  },
};

function rosterName(r: RosterRow): string {
  const parts = [r.firstName, r.lastName].filter(Boolean);
  return parts.length ? parts.join(" ") : r.email || r.customerNumber || r.contactId;
}

function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function formatPaymentType(t: string): string {
  if (t === "past_due") return "Past due";
  if (t === "reservation") return "Reservation";
  return t;
}

function formatLocalIso(d: Date): string {
  return d.toLocaleDateString("en-CA");
}

function sortCampRows(rows: CampRow[], key: SortKey, dir: "asc" | "desc"): CampRow[] {
  const out = [...rows];
  const s = dir === "asc" ? 1 : -1;
  out.sort((a, b) => {
    switch (key) {
      case "name":
        return s * a.name.localeCompare(b.name);
      case "onSite":
        return s * (a.reservationsOnProperty - b.reservationsOnProperty);
      case "membersOnSite":
        return s * (a.memberReservationsOnProperty - b.memberReservationsOnProperty);
      case "guestsOnSite":
        return s * (a.guestReservationsOnProperty - b.guestReservationsOnProperty);
      case "checkedIn":
        return s * (a.checkedInReservations - b.checkedInReservations);
      case "openRes":
        return s * (a.activeReservations - b.activeReservations);
      case "balanceDue":
        return s * (a.balanceDueCents - b.balanceDueCents);
      case "overdue":
        return s * (a.overdueCents - b.overdueCents);
      case "assigned":
        return s * (a.assignedCaretakers.length - b.assignedCaretakers.length);
      case "stripeTotal":
        return s * (a.stripeTotalCents - b.stripeTotalCents);
      default:
        return 0;
    }
  });
  return out;
}

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-[#d4af37]/20 bg-[#0f0a06]/70 p-4 min-w-[10rem] flex-1">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[#d4af37]/75 mb-1">{label}</p>
      <p className="font-serif text-xl sm:text-2xl font-semibold tabular-nums text-[#f0d48f]">{value}</p>
      {sub ? <p className="text-[11px] text-[#e8e0d5]/45 mt-1">{sub}</p> : null}
    </div>
  );
}

function HeaderHelpButton({
  helpId,
  currentId,
  onToggle,
}: {
  helpId: string;
  currentId: string | null;
  onToggle: (id: string | null) => void;
}) {
  const meta = COLUMN_HELP[helpId];
  if (!meta) return null;
  const open = currentId === helpId;
  return (
    <button
      type="button"
      className="shrink-0 rounded p-1 text-[#d4af37]/65 hover:text-[#d4af37] hover:bg-[#d4af37]/12 min-w-[28px] min-h-[28px] inline-flex items-center justify-center touch-manipulation"
      aria-label={`Explain: ${meta.title}`}
      aria-expanded={open}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle(open ? null : helpId);
      }}
    >
      <HelpCircle className="w-3.5 h-3.5" />
    </button>
  );
}

function ThWithHelp({
  helpId,
  columnHelpId,
  onColumnHelp,
  title,
  subtitle,
}: {
  helpId: string;
  columnHelpId: string | null;
  onColumnHelp: (id: string | null) => void;
  title: string;
  subtitle?: string;
}) {
  const meta = COLUMN_HELP[helpId];
  return (
    <th
      scope="col"
      className="relative p-3 sm:p-3.5 font-semibold text-center align-bottom min-w-[6.5rem] lg:min-w-[7.75rem]"
      title={meta?.body}
    >
      <div className="flex min-h-[4.25rem] flex-col items-center justify-end px-1 pb-7">
        <span className="text-balance text-center text-xs font-semibold leading-snug text-[#d4af37] sm:text-[13px]">
          {title}
        </span>
        {subtitle ? (
          <span className="text-balance mt-1 max-w-[14rem] text-center text-[10px] font-normal leading-snug text-[#e8e0d5]/55 sm:text-[11px]">
            {subtitle}
          </span>
        ) : null}
      </div>
      <div className="absolute bottom-1.5 right-1.5">
        <HeaderHelpButton helpId={helpId} currentId={columnHelpId} onToggle={onColumnHelp} />
      </div>
    </th>
  );
}

function ThCampWithHelp({
  columnHelpId,
  onColumnHelp,
}: {
  columnHelpId: string | null;
  onColumnHelp: (id: string | null) => void;
}) {
  const meta = COLUMN_HELP.camp;
  return (
    <th
      scope="col"
      className="sticky left-14 z-30 min-w-[7.5rem] ct-sticky p-3 text-left align-bottom font-semibold shadow-[4px_0_12px_-2px_rgba(0,0,0,0.15)] lg:min-w-[9rem]"
      title={meta.body}
    >
      <div className="flex min-h-[4.25rem] flex-col justify-end pb-7 pl-0.5">
        <span className="text-[#d4af37]">Camp</span>
      </div>
      <div className="absolute bottom-1.5 right-1.5">
        <HeaderHelpButton helpId="camp" currentId={columnHelpId} onToggle={onColumnHelp} />
      </div>
    </th>
  );
}

function ThExpandWithHelp({
  columnHelpId,
  onColumnHelp,
}: {
  columnHelpId: string | null;
  onColumnHelp: (id: string | null) => void;
}) {
  const meta = COLUMN_HELP.expand;
  return (
    <th
      scope="col"
      className="sticky left-0 z-30 w-14 min-w-[3.5rem] ct-sticky p-2 text-center align-bottom shadow-[4px_0_12px_-2px_rgba(0,0,0,0.15)]"
      title={meta.body}
    >
      <span className="sr-only">Expand row for camp details</span>
      <div className="flex min-h-[4.25rem] flex-col items-center justify-end pb-9">
        <span className="text-[10px] font-medium uppercase tracking-wide text-[#d4af37]/75">
          Details
        </span>
      </div>
      <div className="absolute bottom-1 left-1/2 flex -translate-x-1/2 justify-center">
        <HeaderHelpButton helpId="expand" currentId={columnHelpId} onToggle={onColumnHelp} />
      </div>
    </th>
  );
}

function ColumnHelpSheet({
  helpId,
  onClose,
}: {
  helpId: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!helpId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [helpId, onClose]);

  if (!helpId) return null;
  const meta = COLUMN_HELP[helpId];
  if (!meta) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close column help"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-lg rounded-t-xl sm:rounded-xl border border-[#d4af37]/30 bg-[#120c08] text-[#e8e0d5] shadow-xl max-h-[min(70vh,420px)] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="column-help-title"
      >
        <div className="p-4 border-b border-[#d4af37]/20 flex items-start justify-between gap-3">
          <h2 id="column-help-title" className="font-serif text-lg text-[#f0d48f] pr-2">
            {meta.title}
          </h2>
          <button
            type="button"
            className="shrink-0 rounded px-3 py-1.5 text-sm text-[#d4af37] hover:bg-[#d4af37]/10"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <p className="p-4 text-sm leading-relaxed text-[#e8e0d5]/90">{meta.body}</p>
        <p className="px-4 pb-4 text-xs text-[#e8e0d5]/45">
          Tip: on desktop you can also hover the column header for the same description (browser tooltip).
        </p>
      </div>
    </div>
  );
}

export function CaretakerAdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [camps, setCamps] = useState<CampRow[]>([]);
  const [rosterUnmapped, setRosterUnmapped] = useState<RosterRow[]>([]);
  const [global, setGlobal] = useState<GlobalMetrics | null>(null);
  const [revenuePeriod, setRevenuePeriod] = useState<{ from: string | null; to: string | null }>({
    from: null,
    to: null,
  });
  const [revFromInput, setRevFromInput] = useState("");
  const [revToInput, setRevToInput] = useState("");
  const [appliedRevenueFrom, setAppliedRevenueFrom] = useState("");
  const [appliedRevenueTo, setAppliedRevenueTo] = useState("");
  const [dashboardRefresh, setDashboardRefresh] = useState(0);
  const [filterSlug, setFilterSlug] = useState<string>("");
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
  const [reservationCache, setReservationCache] = useState<Record<string, ReservationRow[]>>({});
  const [columnHelpId, setColumnHelpId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [priceOverrides, setPriceOverrides] = useState<Array<{
    id: string;
    campSlug: string;
    invoiceNumber: string | null;
    siteName: string | null;
    guestLabel: string;
    calculatedTotalCents: number | null;
    amountOverrideCents: number | null;
    overrideReason: string | null;
    createdAt: string;
  }>>([]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (appliedRevenueFrom) params.set("revenueFrom", appliedRevenueFrom);
    if (appliedRevenueTo) params.set("revenueTo", appliedRevenueTo);
    const qs = params.toString();
    fetch(`/api/members/caretaker/admin/summary${qs ? `?${qs}` : ""}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(typeof j.error === "string" ? j.error : res.statusText);
        }
        return res.json() as Promise<{
          camps: CampRow[];
          rosterUnmapped: RosterRow[];
          global: GlobalMetrics;
          revenuePeriod: { from: string | null; to: string | null };
        }>;
      })
      .then((data) => {
        if (cancelled) return;
        setCamps(data.camps ?? []);
        setRosterUnmapped(data.rosterUnmapped ?? []);
        setGlobal(data.global ?? null);
        const period = data.revenuePeriod ?? { from: null, to: null };
        setRevenuePeriod(period);
        setRevFromInput(period.from ?? "");
        setRevToInput(period.to ?? "");
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [appliedRevenueFrom, appliedRevenueTo, dashboardRefresh]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/members/caretaker/admin/price-overrides", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((overrides) => {
        if (cancelled) return;
        if (overrides?.overrides) setPriceOverrides(overrides.overrides);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!expandedSlug) return;
    if (Object.hasOwn(reservationCache, expandedSlug)) return;
    let cancelled = false;
    fetch(
      `/api/members/caretaker/admin/reservations?campSlug=${encodeURIComponent(expandedSlug)}`,
      { cache: "no-store" }
    )
      .then(async (res) => {
        if (!res.ok) return [];
        const j = (await res.json()) as { reservations?: ReservationRow[] };
        return j.reservations ?? [];
      })
      .then((list) => {
        if (cancelled) return;
        setReservationCache((prev) => {
          if (Object.hasOwn(prev, expandedSlug)) return prev;
          return { ...prev, [expandedSlug]: list };
        });
      })
      .catch(() => {
        if (cancelled) return;
        setReservationCache((prev) => {
          if (Object.hasOwn(prev, expandedSlug)) return prev;
          return { ...prev, [expandedSlug]: [] };
        });
      });
    return () => {
      cancelled = true;
    };
  }, [expandedSlug, reservationCache]);

  const filtered = useMemo(() => {
    if (!filterSlug) return camps;
    return camps.filter((c) => c.slug === filterSlug);
  }, [camps, filterSlug]);

  const sortedFiltered = useMemo(
    () => sortCampRows(filtered, sortKey, sortDir),
    [filtered, sortKey, sortDir]
  );

  const toggleExpand = (slug: string) => {
    setExpandedSlug((cur) => (cur === slug ? null : slug));
  };

  const refreshReservationsForCamp = (campSlug: string) => {
    fetch(
      `/api/members/caretaker/admin/reservations?campSlug=${encodeURIComponent(campSlug)}`,
      { cache: "no-store" }
    )
      .then(async (res) => {
        if (!res.ok) return [];
        const j = (await res.json()) as { reservations?: ReservationRow[] };
        return j.reservations ?? [];
      })
      .then((list) => {
        setReservationCache((prev) => ({ ...prev, [campSlug]: list }));
      })
      .catch(() => {});
    setDashboardRefresh((n) => n + 1);
  };

  const revenueRangeDescription = useMemo(() => {
    const { from, to } = revenuePeriod;
    if (from && to) return `${from} → ${to}`;
    if (from) return `From ${from}`;
    if (to) return `Through ${to}`;
    return "All dates (Stripe)";
  }, [revenuePeriod]);

  const paymentExportFrom = appliedRevenueFrom || revFromInput.trim();
  const paymentExportTo = appliedRevenueTo || revToInput.trim();
  const paymentExportCampLabel = filterSlug
    ? camps.find((c) => c.slug === filterSlug)?.name ?? filterSlug
    : "All camps";

  async function handleDownloadPaymentsReport() {
    if (!paymentExportFrom || !paymentExportTo) {
      setExportError("Enter a from and to date in the toolbar above (then Apply), or use a quick range preset.");
      return;
    }
    setExportLoading(true);
    setExportError(null);
    try {
      const params = new URLSearchParams({
        from: paymentExportFrom,
        to: paymentExportTo,
      });
      if (filterSlug) params.set("campSlug", filterSlug);
      const res = await fetch(`/api/members/caretaker/admin/payments-export?${params}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(typeof j.error === "string" ? j.error : "Download failed");
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition");
      const match = cd?.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `ldma-payments-${paymentExportFrom}-to-${paymentExportTo}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setExportLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-[#e8e0d5]/70 py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#d4af37]" />
        Loading overview…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/40 bg-red-950/30 px-4 py-3 text-red-200">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-8 caretaker-themed">
      <ColumnHelpSheet helpId={columnHelpId} onClose={() => setColumnHelpId(null)} />

      <ManualReservationPanel />

      {rosterUnmapped.length > 0 && (
        <div
          className="rounded-lg border border-amber-500/35 bg-amber-950/20 px-4 py-3 text-sm text-amber-100/90"
          role="status"
        >
          <p className="font-medium text-amber-200/95 mb-1">Caretakers not mapped to a directory camp</p>
          <ul className="list-disc pl-5 space-y-0.5">
            {rosterUnmapped.map((r) => (
              <li key={r.contactId}>
                {rosterName(r)} — <span className="text-[#e8e0d5]/70">{r.caretakerAtCampLabel}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="rounded-lg border border-[#d4af37]/25 bg-[#0f0a06]/40 p-4 space-y-4">
        <h2 className="text-sm font-medium text-[#f0d48f]">Stripe revenue period</h2>
        <p className="text-xs text-[#e8e0d5]/55 -mt-2">
          Applies to KPI amounts and the <strong className="text-[#e8e0d5]/75">Stripe (range)</strong> column.
          Expanded camp → Revenue tab uses the same dates. Other columns use live / rolling windows as labeled.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-[#e8e0d5]/65">
            From
            <input
              type="date"
              value={revFromInput}
              onChange={(e) => setRevFromInput(e.target.value)}
              className="rounded border border-[#d4af37]/30 bg-[#0f0a06] text-[#e8e0d5] px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[#e8e0d5]/65">
            To
            <input
              type="date"
              value={revToInput}
              onChange={(e) => setRevToInput(e.target.value)}
              className="rounded border border-[#d4af37]/30 bg-[#0f0a06] text-[#e8e0d5] px-2 py-1.5 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setAppliedRevenueFrom(revFromInput.trim());
              setAppliedRevenueTo(revToInput.trim());
            }}
            className="rounded border border-[#d4af37]/50 bg-[#d4af37]/15 text-[#f0d48f] px-4 py-2 text-sm hover:bg-[#d4af37]/25"
          >
            Apply to dashboard
          </button>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setRevFromInput("");
              setRevToInput("");
              setAppliedRevenueFrom("");
              setAppliedRevenueTo("");
            }}
            className="text-sm text-[#e8e0d5]/55 hover:text-[#d4af37] px-2 py-2"
          >
            All dates
          </button>
          <div className="flex flex-wrap gap-2 ml-auto">
            <button
              type="button"
              className="rounded border border-[#d4af37]/25 px-3 py-1.5 text-xs text-[#e8e0d5]/80 hover:bg-[#d4af37]/10"
              onClick={() => {
                const to = new Date();
                const from = new Date();
                from.setDate(from.getDate() - 29);
                const f = formatLocalIso(from);
                const t = formatLocalIso(to);
                setLoading(true);
                setRevFromInput(f);
                setRevToInput(t);
                setAppliedRevenueFrom(f);
                setAppliedRevenueTo(t);
              }}
            >
              Last 30 days
            </button>
            <button
              type="button"
              className="rounded border border-[#d4af37]/25 px-3 py-1.5 text-xs text-[#e8e0d5]/80 hover:bg-[#d4af37]/10"
              onClick={() => {
                const y = new Date().getFullYear();
                const f = `${y}-01-01`;
                const t = `${y}-12-31`;
                setLoading(true);
                setRevFromInput(f);
                setRevToInput(t);
                setAppliedRevenueFrom(f);
                setAppliedRevenueTo(t);
              }}
            >
              This calendar year
            </button>
          </div>
        </div>
        <p className="text-[11px] text-[#e8e0d5]/45">Stripe filter: {revenueRangeDescription}</p>
      </section>

      {global ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-[#f0d48f]">All camps — at a glance</h2>
          <div className="flex flex-wrap gap-3">
            <KpiCard
              label="On site (lodging)"
              value={String(global.totalOnSiteReservations)}
              sub={`${global.totalMemberOnSite} members · ${global.totalGuestOnSite} guests`}
            />
            <KpiCard label="Checked in" value={String(global.totalCheckedIn)} />
            <KpiCard label="Open reservations" value={String(global.totalOpenReservations)} />
            <KpiCard
              label="Site fees due"
              value={formatUsd(global.totalBalanceDueCents)}
              sub={`${global.totalReservationsWithBalance} reservations · ${formatUsd(global.totalOverdueCents)} overdue`}
            />
            <KpiCard
              label="Reservations (30d)"
              value={String(global.totalReservationsCreated30d)}
              sub="New bookings created"
            />
            <KpiCard
              label="Stripe — combined"
              value={formatUsd(global.stripeTotalCents)}
              sub={`${global.stripePaymentCount} card payment${global.stripePaymentCount === 1 ? "" : "s"} · ${revenueRangeDescription}`}
            />
            <KpiCard label="Stripe — reservations" value={formatUsd(global.stripeReservationCents)} />
            <KpiCard label="Stripe — past due" value={formatUsd(global.stripePastDueCents)} />
            <KpiCard
              label="Roster assignments"
              value={String(global.totalRosterAssignments)}
              sub="Salesforce caretaker rows"
            />
          </div>
        </section>
      ) : null}

      {priceOverrides.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-[#f0d48f]">Flagged price overrides</h2>
          <div className="overflow-x-auto rounded border border-amber-500/30">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-[#e8e0d5]/60 border-b border-amber-500/20">
                  <th className="py-2 px-2">Camp</th>
                  <th className="py-2 px-2">Guest</th>
                  <th className="py-2 px-2">Calculated</th>
                  <th className="py-2 px-2">Charged</th>
                  <th className="py-2 px-2">Reason</th>
                </tr>
              </thead>
              <tbody>
                {priceOverrides.slice(0, 20).map((row) => (
                  <tr key={row.id} className="border-b border-amber-500/10 text-[#e8e0d5]">
                    <td className="py-2 px-2">{row.campSlug}</td>
                    <td className="py-2 px-2">{row.guestLabel}</td>
                    <td className="py-2 px-2">{formatUsd((row.calculatedTotalCents ?? 0))}</td>
                    <td className="py-2 px-2">{formatUsd((row.amountOverrideCents ?? 0))}</td>
                    <td className="py-2 px-2 max-w-[200px] truncate" title={row.overrideReason ?? ""}>{row.overrideReason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm text-[#e8e0d5]/70">
          <span className="flex items-center gap-1.5">
            <Tent className="w-4 h-4 text-[#d4af37]" />
            Filter by camp
          </span>
          <select
            className="rounded border border-[#d4af37]/30 bg-[#0f0a06] text-[#e8e0d5] px-3 py-2 min-w-[200px]"
            value={filterSlug}
            onChange={(e) => {
              const v = e.target.value;
              setFilterSlug(v);
              setExpandedSlug(null);
            }}
          >
            <option value="">All camps</option>
            {camps.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-[#e8e0d5]/70">
          Sort by
          <select
            className="rounded border border-[#d4af37]/30 bg-[#0f0a06] text-[#e8e0d5] px-3 py-2 min-w-[200px]"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            <option value="name">Camp name</option>
            <option value="balanceDue">Site fees due</option>
            <option value="overdue">Overdue</option>
            <option value="stripeTotal">Stripe total (range)</option>
            <option value="onSite">On site today</option>
            <option value="openRes">Open reservations</option>
            <option value="checkedIn">Checked in</option>
            <option value="membersOnSite">Members on site</option>
            <option value="guestsOnSite">Guests on site</option>
            <option value="assigned">Caretaker roster count</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-[#e8e0d5]/70">
          Order
          <select
            className="rounded border border-[#d4af37]/30 bg-[#0f0a06] text-[#e8e0d5] px-3 py-2 min-w-[140px]"
            value={sortDir}
            onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </label>
      </div>

      <section className="rounded-lg border border-[#d4af37]/25 bg-[#0f0a06]/40 p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-[#f0d48f]">Payment report (CSV)</h2>
            <p className="text-xs text-[#e8e0d5]/55 mt-1 max-w-2xl">
              Download card, cash, refund, and comp activity for the date range in the toolbar above.
              Respects the camp filter when set ({paymentExportCampLabel}).
              Columns: payment date, payor, type, amount, camp, and description.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleDownloadPaymentsReport()}
            disabled={exportLoading || !paymentExportFrom || !paymentExportTo}
            className="inline-flex items-center gap-2 rounded border border-[#d4af37]/50 bg-[#d4af37]/15 text-[#f0d48f] px-4 py-2 text-sm hover:bg-[#d4af37]/25 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download CSV
          </button>
        </div>
        {exportError ? (
          <p className="text-sm text-red-300" role="alert">
            {exportError}
          </p>
        ) : null}
        {!paymentExportFrom || !paymentExportTo ? (
          <p className="text-xs text-[#e8e0d5]/45">
            Set both from and to dates in the Stripe revenue period toolbar to enable export.
          </p>
        ) : (
          <p className="text-xs text-[#e8e0d5]/45">
            Export range: {paymentExportFrom} → {paymentExportTo} · {paymentExportCampLabel}
          </p>
        )}
      </section>

      <div className="overflow-x-auto rounded-lg border border-[#d4af37]/20">
        <table className="ct-admin-table w-full min-w-[1000px] border-collapse text-left text-sm sm:text-[0.9375rem]">
          <thead>
            <tr className="border-b border-[#d4af37]/25">
              <ThExpandWithHelp columnHelpId={columnHelpId} onColumnHelp={setColumnHelpId} />
              <ThCampWithHelp columnHelpId={columnHelpId} onColumnHelp={setColumnHelpId} />
              <ThWithHelp
                helpId="onSite"
                columnHelpId={columnHelpId}
                onColumnHelp={setColumnHelpId}
                title="On site"
                subtitle="Today · all types"
              />
              <ThWithHelp
                helpId="membersOnSite"
                columnHelpId={columnHelpId}
                onColumnHelp={setColumnHelpId}
                title="Members"
                subtitle="On site today"
              />
              <ThWithHelp
                helpId="guestsOnSite"
                columnHelpId={columnHelpId}
                onColumnHelp={setColumnHelpId}
                title="Guests"
                subtitle="On site today"
              />
              <ThWithHelp
                helpId="checkedIn"
                columnHelpId={columnHelpId}
                onColumnHelp={setColumnHelpId}
                title="Checked in"
                subtitle="Active stays"
              />
              <ThWithHelp
                helpId="openRes"
                columnHelpId={columnHelpId}
                onColumnHelp={setColumnHelpId}
                title="Open"
                subtitle="Future + today"
              />
              <ThWithHelp
                helpId="balanceDue"
                columnHelpId={columnHelpId}
                onColumnHelp={setColumnHelpId}
                title="Site fees due"
                subtitle="Unpaid periods"
              />
              <ThWithHelp
                helpId="overdue"
                columnHelpId={columnHelpId}
                onColumnHelp={setColumnHelpId}
                title="Overdue"
                subtitle="Past due date"
              />
              <ThWithHelp
                helpId="stripeCol"
                columnHelpId={columnHelpId}
                onColumnHelp={setColumnHelpId}
                title="Stripe (range)"
                subtitle={revenueRangeDescription}
              />
              <th
                scope="col"
                className="relative min-w-[12rem] p-3 text-left align-bottom font-semibold lg:min-w-[15rem]"
                title={COLUMN_HELP.assigned.body}
              >
                <div className="flex min-h-[4.25rem] flex-col justify-end pb-7 pr-8">
                  <span className="text-balance text-[#d4af37]">Assigned caretakers</span>
                  <span className="text-balance mt-1 text-[10px] font-normal leading-snug text-[#e8e0d5]/50 sm:text-[11px]">
                    Salesforce roster
                  </span>
                </div>
                <div className="absolute bottom-1.5 right-1.5">
                  <HeaderHelpButton helpId="assigned" currentId={columnHelpId} onToggle={setColumnHelpId} />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedFiltered.map((row) => {
              const open = expandedSlug === row.slug;
              return (
                <Fragment key={row.slug}>
                  <tr className="ct-row-main border-b border-[#d4af37]/10 transition-colors">
                    <td className="ct-sticky sticky left-0 z-20 p-1 text-center align-middle shadow-[4px_0_12px_-2px_rgba(0,0,0,0.12)]">
                      <button
                        type="button"
                        onClick={() => toggleExpand(row.slug)}
                        className="mx-auto rounded p-2 text-[#d4af37] hover:bg-[#d4af37]/10 transition-colors"
                        aria-expanded={open}
                        aria-label={open ? `Collapse ${row.name}` : `Expand ${row.name}`}
                      >
                        {open ? (
                          <ChevronDown className="w-5 h-5" />
                        ) : (
                          <ChevronRight className="w-5 h-5" />
                        )}
                      </button>
                    </td>
                    <td className="ct-sticky sticky left-14 z-20 p-3 shadow-[4px_0_12px_-2px_rgba(0,0,0,0.12)]">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleExpand(row.slug)}
                          className="text-left font-medium ct-cell-gold hover:underline decoration-[#d4af37]/50"
                        >
                          {row.name}
                        </button>
                        <ViewAsCaretakerButton
                          campSlug={row.slug}
                          campName={row.name}
                          variant="compact"
                        />
                      </div>
                    </td>
                    <td className="p-3 text-center tabular-nums">{row.reservationsOnProperty}</td>
                    <td className="p-3 text-center tabular-nums">{row.memberReservationsOnProperty}</td>
                    <td className="p-3 text-center tabular-nums">{row.guestReservationsOnProperty}</td>
                    <td className="p-3 text-center tabular-nums">{row.checkedInReservations}</td>
                    <td className="p-3 text-center tabular-nums">{row.activeReservations}</td>
                    <td className="p-3 text-right tabular-nums ct-cell-gold font-medium">
                      {row.balanceDueCents > 0 ? formatUsd(row.balanceDueCents) : "—"}
                    </td>
                    <td className={`p-3 text-right tabular-nums font-medium ${row.overdueCents > 0 ? "ct-cell-overdue" : "ct-cell-muted"}`}>
                      {row.overdueCents > 0 ? formatUsd(row.overdueCents) : "—"}
                    </td>
                    <td className="p-3 text-right tabular-nums ct-cell-gold font-medium">
                      {formatUsd(row.stripeTotalCents)}
                    </td>
                    <td className="p-3 ct-cell-muted">
                      {row.assignedCaretakers.length === 0 ? (
                        <span className="text-[#e8e0d5]/45">—</span>
                      ) : (
                        <ul className="space-y-1">
                          {row.assignedCaretakers.map((r) => (
                            <li key={r.contactId}>
                              {rosterName(r)}
                              {r.email ? (
                                <span className="text-[#e8e0d5]/55"> · {r.email}</span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                  {open ? (
                    <tr key={`${row.slug}-detail`} className="ct-row-detail border-b border-[#d4af37]/15">
                      <td colSpan={11} className="p-0">
                        <CampExpandedPanel
                          camp={row}
                          reservations={reservationCache[row.slug]}
                          columnHelpId={columnHelpId}
                          onColumnHelp={setColumnHelpId}
                          revenueFrom={appliedRevenueFrom}
                          revenueTo={appliedRevenueTo}
                          revenueRangeLabel={revenueRangeDescription}
                          onBalancesPaid={() => setDashboardRefresh((n) => n + 1)}
                          onReservationsUpdated={() => refreshReservationsForCamp(row.slug)}
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StripeTh({
  helpId,
  columnHelpId,
  onColumnHelp,
  children,
  className = "",
}: {
  helpId: string;
  columnHelpId: string | null;
  onColumnHelp: (id: string | null) => void;
  children: ReactNode;
  className?: string;
}) {
  const meta = COLUMN_HELP[helpId];
  const rightAlign = className.includes("text-right");
  return (
    <th scope="col" className={`relative p-2 pb-7 font-semibold ${className}`} title={meta?.body}>
      <div
        className={`flex min-h-[2.5rem] items-end ${rightAlign ? "justify-end pr-8" : "justify-start pl-0.5 pr-8"}`}
      >
        <span className={rightAlign ? "text-right" : ""}>{children}</span>
      </div>
      <div className={`absolute bottom-1 ${rightAlign ? "right-1" : "right-1"}`}>
        <HeaderHelpButton helpId={helpId} currentId={columnHelpId} onToggle={onColumnHelp} />
      </div>
    </th>
  );
}

function groupStripeByDay(payments: StripePaymentRow[]): { day: string; rows: StripePaymentRow[] }[] {
  const groups: { day: string; rows: StripePaymentRow[] }[] = [];
  for (const p of payments) {
    const day = p.createdAt.slice(0, 10);
    const last = groups[groups.length - 1];
    if (!last || last.day !== day) groups.push({ day, rows: [p] });
    else last.rows.push(p);
  }
  return groups;
}

function summarizeStripeRevenue(payments: StripePaymentRow[]) {
  let reservationCents = 0;
  let pastDueCents = 0;
  let otherCents = 0;
  let reservationCount = 0;
  let pastDueCount = 0;
  let otherCount = 0;
  for (const p of payments) {
    if (p.paymentType === "reservation") {
      reservationCents += p.amountCents;
      reservationCount += 1;
    } else if (p.paymentType === "past_due") {
      pastDueCents += p.amountCents;
      pastDueCount += 1;
    } else {
      otherCents += p.amountCents;
      otherCount += 1;
    }
  }
  const totalCents = reservationCents + pastDueCents + otherCents;
  const totalCount = payments.length;
  return {
    reservationCents,
    pastDueCents,
    otherCents,
    totalCents,
    reservationCount,
    pastDueCount,
    otherCount,
    totalCount,
  };
}

function StripeRevenueTotals({
  payments,
  appliedFrom,
  appliedTo,
}: {
  payments: StripePaymentRow[];
  appliedFrom: string;
  appliedTo: string;
}) {
  const s = useMemo(() => summarizeStripeRevenue(payments), [payments]);
  const rangeLabel =
    appliedFrom && appliedTo
      ? `${appliedFrom} through ${appliedTo}`
      : appliedFrom
        ? `from ${appliedFrom}`
        : appliedTo
          ? `through ${appliedTo}`
          : "all loaded payments";

  return (
    <div className="mb-4 rounded-lg border border-[#d4af37]/20 bg-[#0f0a06]/55 p-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[#d4af37]/85">
        Totals for selected range ({rangeLabel})
      </p>
      <ul className="space-y-2 text-sm text-[#e8e0d5]/90">
        <li className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[#d4af37]/10 pb-2">
          <span>
            Reservation revenue{" "}
            <span className="text-[#e8e0d5]/50">
              ({s.reservationCount} payment{s.reservationCount === 1 ? "" : "s"})
            </span>
          </span>
          <span className="tabular-nums font-medium text-[#f0d48f]">{formatUsd(s.reservationCents)}</span>
        </li>
        <li className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[#d4af37]/10 pb-2">
          <span>
            Past-due revenue{" "}
            <span className="text-[#e8e0d5]/50">
              (maintenance / membership · {s.pastDueCount} payment{s.pastDueCount === 1 ? "" : "s"})
            </span>
          </span>
          <span className="tabular-nums font-medium text-[#f0d48f]">{formatUsd(s.pastDueCents)}</span>
        </li>
        {s.otherCount > 0 ? (
          <li className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[#d4af37]/10 pb-2">
            <span>
              Other / unknown type{" "}
              <span className="text-[#e8e0d5]/50">
                ({s.otherCount} payment{s.otherCount === 1 ? "" : "s"})
              </span>
            </span>
            <span className="tabular-nums font-medium text-[#f0d48f]">{formatUsd(s.otherCents)}</span>
          </li>
        ) : null}
        <li className="flex flex-wrap items-baseline justify-between gap-3 pt-1">
          <span className="font-semibold text-[#f0d48f]">
            Combined Stripe revenue{" "}
            <span className="font-normal text-[#e8e0d5]/55">
              ({s.totalCount} payment{s.totalCount === 1 ? "" : "s"})
            </span>
          </span>
          <span className="tabular-nums text-lg font-semibold text-[#f0d48f]">{formatUsd(s.totalCents)}</span>
        </li>
      </ul>
      <p className="mt-3 text-[11px] leading-snug text-[#e8e0d5]/45">
        Amounts sum the Stripe Checkout sessions in this result. The list is capped at 500 rows; if you hit
        that cap, totals include only those rows.
      </p>
    </div>
  );
}

function CampBalancesTab({
  campSlug,
  onPaid,
}: {
  campSlug: string;
  onPaid: () => void;
}) {
  const [items, setItems] = useState<PaymentDueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<{
    checkInDate: string;
    balance: { balanceDueCents: number; totalDueCents: number; totalPaidCents: number };
    billingPeriods: Array<{
      id: string;
      periodIndex: number;
      periodStart: string;
      periodEnd: string;
      nights: number;
      amountDueCents: number;
      amountPaidCents: number;
      dueDate: string;
      status: string;
      pricingBasis: string;
    }>;
    recipientEmail: string;
    recipientDisplayName: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/members/caretaker/payments-due?campSlug=${encodeURIComponent(campSlug)}`, {
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(typeof j.error === "string" ? j.error : res.statusText);
        }
        return res.json() as Promise<{ items?: PaymentDueItem[] }>;
      })
      .then((data) => {
        if (cancelled) return;
        setItems(data.items ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load balances");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [campSlug]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    fetch(
      `/api/members/caretaker/reservations/${selectedId}?campSlug=${encodeURIComponent(campSlug)}`,
      { cache: "no-store" }
    )
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load reservation");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const payments = Array.isArray(data.payments) ? data.payments : [];
        const paymentEmail =
          typeof payments[0]?.memberEmail === "string" ? payments[0].memberEmail.trim() : "";
        const email = data.guestEmail?.trim() || paymentEmail || "";
        const displayName =
          data.reservationType === "member"
            ? data.memberDisplayName || data.memberNumber || "Member"
            : [data.guestFirstName, data.guestLastName].filter(Boolean).join(" ").trim() || "Guest";
        setDetail({
          checkInDate: data.checkInDate,
          balance: data.balance,
          billingPeriods: data.billingPeriods ?? [],
          recipientEmail: email,
          recipientDisplayName: displayName,
        });
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, campSlug]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm ct-cell-muted">
        <Loader2 className="h-4 w-4 animate-spin text-[#d4af37]" />
        Loading balances…
      </div>
    );
  }
  if (error) {
    return <p className="text-sm text-red-300/90">{error}</p>;
  }
  if (items.length === 0) {
    return (
      <p className="py-2 text-sm ct-cell-muted">
        No site-fee balances due in the next 7 days (and no overdue) for this camp.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs ct-cell-muted">
        Due within 7 days or overdue. Select a row to record cash or card payment.
      </p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.reservationId} className="rounded border border-[#d4af37]/20 ct-panel-surface">
            <button
              type="button"
              onClick={() =>
                setSelectedId((cur) => (cur === item.reservationId ? null : item.reservationId))
              }
              className="w-full text-left px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 hover:bg-[#d4af37]/5"
            >
              <span>
                <span className="font-medium ct-cell-gold">{item.guestLabel}</span>
                {item.siteName ? (
                  <span className="ct-cell-muted text-sm"> · {item.siteName}</span>
                ) : null}
              </span>
              <span className={item.isOverdue ? "ct-cell-overdue font-medium" : "ct-cell-gold font-medium"}>
                {item.isOverdue ? "Overdue " : "Due "}
                {formatCentsAsCurrency(item.balanceDueCents)}
              </span>
            </button>
            {selectedId === item.reservationId && (
              <div className="px-3 pb-3 border-t border-[#d4af37]/15">
                {detailLoading || !detail ? (
                  <div className="flex items-center gap-2 py-3 text-sm ct-cell-muted">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </div>
                ) : !detail.recipientEmail ? (
                  <p className="text-sm text-amber-300/90 py-2">
                    No email on file — add guest/member email in Salesforce before card checkout.
                  </p>
                ) : (
                  <ReservationBillingSection
                    reservationId={item.reservationId}
                    checkInDate={detail.checkInDate}
                    balance={detail.balance}
                    billingPeriods={detail.billingPeriods}
                    recipientEmail={detail.recipientEmail}
                    recipientDisplayName={detail.recipientDisplayName}
                    campSlug={campSlug}
                    onPaymentComplete={() => {
                      setSelectedId(null);
                      onPaid();
                    }}
                  />
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CampExpandedPanel({
  camp,
  reservations,
  columnHelpId,
  onColumnHelp,
  revenueFrom,
  revenueTo,
  revenueRangeLabel,
  onBalancesPaid,
  onReservationsUpdated,
}: {
  camp: CampRow;
  reservations: ReservationRow[] | undefined;
  columnHelpId: string | null;
  onColumnHelp: (id: string | null) => void;
  revenueFrom: string;
  revenueTo: string;
  revenueRangeLabel: string;
  onBalancesPaid: () => void;
  onReservationsUpdated: () => void;
}) {
  const idToName = new Map(
    camp.assignedCaretakers.map((r) => [r.contactId, rosterName(r)] as const)
  );

  const [tab, setTab] = useState<"overview" | "reservations" | "balances" | "revenue" | "caretakers">("overview");
  const [stripePayments, setStripePayments] = useState<StripePaymentRow[] | null>(null);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const stripeLoading = stripePayments === null && stripeError === null;

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset stripe panel while refetching
    setStripePayments(null);
    setStripeError(null);
    const params = new URLSearchParams({ campSlug: camp.slug });
    if (revenueFrom) params.set("from", revenueFrom);
    if (revenueTo) params.set("to", revenueTo);
    fetch(`/api/members/caretaker/admin/stripe-payments?${params.toString()}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(typeof j.error === "string" ? j.error : res.statusText);
        }
        return res.json() as Promise<{ payments?: StripePaymentRow[] }>;
      })
      .then((data) => {
        if (cancelled) return;
        setStripePayments(data.payments ?? []);
      })
      .catch((e) => {
        if (cancelled) return;
        setStripeError(e instanceof Error ? e.message : "Failed to load");
        setStripePayments([]);
      });
    return () => {
      cancelled = true;
    };
  }, [camp.slug, revenueFrom, revenueTo]);

  const stripeByDay = useMemo(
    () => (stripePayments ? groupStripeByDay(stripePayments) : []),
    [stripePayments]
  );

  const tabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "reservations" as const, label: "Reservations" },
    { id: "balances" as const, label: "Balances due" },
    { id: "revenue" as const, label: "Revenue" },
    { id: "caretakers" as const, label: "Caretakers" },
  ];

  return (
    <div className="border-t border-[#d4af37]/15 px-4 py-5">
      <div className="mb-4 flex flex-wrap gap-2 border-b border-[#d4af37]/20 pb-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
              tab === t.id
                ? "bg-[#d4af37]/25 text-[#f0d48f] ring-1 ring-[#d4af37]/50"
                : "text-[#e8e0d5]/70 hover:bg-[#d4af37]/10 hover:text-[#e8e0d5]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="space-y-4 text-sm text-[#e8e0d5]/85">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[#f0d48f] font-serif text-lg">{camp.name}</p>
            <ViewAsCaretakerButton campSlug={camp.slug} campName={camp.name} />
          </div>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded border border-[#d4af37]/15 ct-panel-surface p-3">
              <dt className="text-[11px] uppercase tracking-wide text-[#d4af37]/75">On site today</dt>
              <dd className="tabular-nums text-lg ct-cell-gold">{camp.reservationsOnProperty}</dd>
              <dd className="text-[11px] ct-cell-muted">
                {camp.memberReservationsOnProperty} members · {camp.guestReservationsOnProperty} guests
              </dd>
            </div>
            <div className="rounded border border-[#d4af37]/15 ct-panel-surface p-3">
              <dt className="text-[11px] uppercase tracking-wide text-[#d4af37]/75">Checked in</dt>
              <dd className="tabular-nums text-lg ct-cell-gold">{camp.checkedInReservations}</dd>
            </div>
            <div className="rounded border border-[#d4af37]/15 ct-panel-surface p-3">
              <dt className="text-[11px] uppercase tracking-wide text-[#d4af37]/75">Open reservations</dt>
              <dd className="tabular-nums text-lg ct-cell-gold">{camp.activeReservations}</dd>
            </div>
            <div className="rounded border border-[#d4af37]/15 ct-panel-surface p-3">
              <dt className="text-[11px] uppercase tracking-wide text-[#d4af37]/75">Site fees due</dt>
              <dd className="tabular-nums text-lg ct-cell-gold">{formatUsd(camp.balanceDueCents)}</dd>
              <dd className="text-[11px] ct-cell-muted">{camp.reservationsWithBalance} reservations</dd>
            </div>
            <div className="rounded border border-[#d4af37]/15 ct-panel-surface p-3">
              <dt className="text-[11px] uppercase tracking-wide text-[#d4af37]/75">Overdue</dt>
              <dd className="tabular-nums text-lg ct-cell-overdue">{formatUsd(camp.overdueCents)}</dd>
            </div>
            <div className="rounded border border-[#d4af37]/15 ct-panel-surface p-3 sm:col-span-2 lg:col-span-1">
              <dt className="text-[11px] uppercase tracking-wide text-[#d4af37]/75">Bookings (30d)</dt>
              <dd className="tabular-nums text-lg ct-cell-gold">{camp.reservationsCreatedLast30Days}</dd>
            </div>
            <div className="rounded border border-[#d4af37]/15 ct-panel-surface p-3 sm:col-span-2 lg:col-span-3">
              <dt className="text-[11px] uppercase tracking-wide text-[#d4af37]/75">
                Stripe (same range as dashboard)
              </dt>
              <dd className="mt-1 text-[#e8e0d5]/70">{revenueRangeLabel}</dd>
              <dd className="mt-2 flex flex-wrap gap-x-6 gap-y-1 tabular-nums text-[#f0d48f]">
                <span>Total {formatUsd(camp.stripeTotalCents)}</span>
                <span className="text-[#e8e0d5]/60">
                  Res. {formatUsd(camp.stripeReservationCents)} · Past due{" "}
                  {formatUsd(camp.stripePastDueCents)}
                </span>
              </dd>
            </div>
          </dl>
        </div>
      ) : null}

      {tab === "balances" ? (
        <CampBalancesTab campSlug={camp.slug} onPaid={onBalancesPaid} />
      ) : null}

      {tab === "reservations" ? (
        <div>
          <h3 className="mb-3 font-serif text-lg text-[#f0d48f]">Reservation history</h3>
          <AdminCampReservationsTab
            campSlug={camp.slug}
            reservations={reservations}
            onUpdated={onReservationsUpdated}
          />
        </div>
      ) : null}

      {tab === "revenue" ? (
        <div>
          <h3 className="mb-2 font-serif text-lg text-[#f0d48f]">Stripe card revenue</h3>
          <p className="mb-3 text-sm text-[#e8e0d5]/60">
            Same date range as the dashboard toolbar: <strong className="text-[#e8e0d5]/85">{revenueRangeLabel}</strong>.
            Card Checkout only; cash excluded. Grouped by processed day (UTC).
          </p>

          {!stripeLoading && !stripeError && stripePayments !== null ? (
            <StripeRevenueTotals
              payments={stripePayments}
              appliedFrom={revenueFrom}
              appliedTo={revenueTo}
            />
          ) : null}

          {stripeLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-[#e8e0d5]/60">
              <Loader2 className="h-4 w-4 animate-spin text-[#d4af37]" />
              Loading Stripe payments…
            </div>
          ) : stripeError ? (
            <p className="text-sm text-red-300/90">{stripeError}</p>
          ) : stripePayments && stripePayments.length === 0 ? (
            <p className="py-2 text-sm text-[#e8e0d5]/55">No Stripe card payments in this range for this camp.</p>
          ) : stripePayments && stripePayments.length > 0 ? (
            <div className="space-y-4">
              {stripeByDay.map((g) => (
                <div key={g.day} className="overflow-hidden rounded border border-[#d4af37]/15">
                  <div className="bg-[#1a1208]/90 px-3 py-2 text-sm font-medium text-[#d4af37] tabular-nums">
                    {g.day}{" "}
                    <span className="ml-2 text-xs font-normal text-[#e8e0d5]/50">
                      ({g.rows.length} payment{g.rows.length === 1 ? "" : "s"} ·{" "}
                      {formatUsd(g.rows.reduce((s, r) => s + r.amountCents, 0))} total)
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead>
                        <tr className="bg-[#0f0a06]/80 text-[#d4af37]/85">
                          <StripeTh
                            helpId="stripeProcessed"
                            columnHelpId={columnHelpId}
                            onColumnHelp={onColumnHelp}
                            className="text-left"
                          >
                            Processed
                          </StripeTh>
                          <StripeTh
                            helpId="stripeAmount"
                            columnHelpId={columnHelpId}
                            onColumnHelp={onColumnHelp}
                            className="text-right"
                          >
                            Amount
                          </StripeTh>
                          <StripeTh
                            helpId="stripeType"
                            columnHelpId={columnHelpId}
                            onColumnHelp={onColumnHelp}
                            className="text-left"
                          >
                            Type
                          </StripeTh>
                          <StripeTh
                            helpId="stripeRecipient"
                            columnHelpId={columnHelpId}
                            onColumnHelp={onColumnHelp}
                            className="text-left"
                          >
                            Recipient
                          </StripeTh>
                          <StripeTh
                            helpId="stripeEmail"
                            columnHelpId={columnHelpId}
                            onColumnHelp={onColumnHelp}
                            className="text-left"
                          >
                            Email
                          </StripeTh>
                          <StripeTh
                            helpId="stripeReservation"
                            columnHelpId={columnHelpId}
                            onColumnHelp={onColumnHelp}
                            className="text-left font-mono text-[11px]"
                          >
                            Reservation ID
                          </StripeTh>
                        </tr>
                      </thead>
                      <tbody>
                        {g.rows.map((p) => (
                          <tr key={p.id} className="border-t border-[#d4af37]/10 text-[#e8e0d5]/90">
                            <td className="whitespace-nowrap p-2 tabular-nums">
                              {p.createdAt.slice(0, 19).replace("T", " ")}
                            </td>
                            <td className="p-2 text-right font-medium tabular-nums text-[#f0d48f]/95">
                              {formatUsd(p.amountCents)}
                            </td>
                            <td className="p-2 capitalize">{formatPaymentType(p.paymentType)}</td>
                            <td className="p-2">{p.recipientDisplayName}</td>
                            <td className="max-w-[10rem] break-all p-2 sm:max-w-none">{p.memberEmail}</td>
                            <td className="p-2 font-mono text-[11px] text-[#e8e0d5]/70">
                              {p.reservationId ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-[#e8e0d5]/45">
                Up to 500 payments per request. Row totals can differ slightly from the grid column if this list
                hits the cap (full aggregate is in Overview / main table).
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "caretakers" ? (
        <div className="space-y-6">
          <div>
            <h3 className="mb-2 font-serif text-lg text-[#f0d48f]">Assigned caretakers (Salesforce)</h3>
            {camp.assignedCaretakers.length === 0 ? (
              <p className="text-sm text-[#e8e0d5]/55">No roster rows mapped to this camp.</p>
            ) : (
              <ul className="space-y-2 text-sm text-[#e8e0d5]/85">
                {camp.assignedCaretakers.map((r) => (
                  <li key={r.contactId}>
                    <span className="text-[#f0d48f]">{rosterName(r)}</span>
                    {r.email ? <span className="text-[#e8e0d5]/55"> · {r.email}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {camp.reservationsCreatedLast30DaysByCaretaker.length > 0 ? (
            <div>
              <h3 className="mb-2 font-serif text-lg text-[#f0d48f]">Reservations created (30 days) by caretaker</h3>
              <ul className="space-y-1 text-sm ct-cell-muted">
                {camp.reservationsCreatedLast30DaysByCaretaker.map((b) => (
                  <li key={b.caretakerContactId}>
                    <span className="text-[#d4af37]/90">
                      {idToName.get(b.caretakerContactId) ?? b.caretakerContactId}
                    </span>
                    {": "}
                    <span className="tabular-nums">{b.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm ct-cell-muted">No reservations created in the last 30 days for this camp.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
