"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, HelpCircle, Loader2, Tent } from "lucide-react";

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
  activeMemberCheckIns: number;
  activeGuestCheckIns: number;
  memberCheckInsLast30Days: number;
  guestCheckInsLast30Days: number;
  activeReservations: number;
  reservationsOnProperty: number;
  assignedCaretakers: RosterRow[];
  checkInsLast30DaysByCaretaker: { caretakerContactId: string; count: number }[];
};

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
    body: "Opens this camp’s detail: reservation list, Stripe card payments (with optional date range), and member check-ins by caretaker for the last 30 days.",
  },
  camp: {
    title: "Camp",
    body: "LDMA directory campground. Counts in the row come from this site’s database; assigned caretakers come from Salesforce (caretaker roster for that camp).",
  },
  membersStay: {
    title: "Members on stay",
    body: "Number of member check-ins in the caretaker portal where the checkout date is still today or in the future—treated as an active stay at the camp.",
  },
  guestsStay: {
    title: "Guests on stay",
    body: "Same as members on stay, but for guest check-ins recorded in the caretaker portal.",
  },
  memCheck30: {
    title: "Member check-ins (30 days)",
    body: "How many member check-ins were created at this camp in the last 30 days (rolling window from right now, UTC).",
  },
  gstCheck30: {
    title: "Guest check-ins (30 days)",
    body: "How many guest check-ins were created at this camp in the last 30 days (rolling window from right now, UTC).",
  },
  openRes: {
    title: "Open reservations",
    body: "Reservations that are not cancelled and whose checkout date is today or later—bookings that still have nights remaining or checkout today.",
  },
  onSite: {
    title: "On site today",
    body: "Reservations in reserved or checked-in status whose stay window includes today (check-in on or before today, check-out on or after today).",
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
};

function rosterName(r: RosterRow): string {
  const parts = [r.firstName, r.lastName].filter(Boolean);
  return parts.length ? parts.join(" ") : r.email || r.customerNumber || r.contactId;
}

function reservationGuestLabel(r: ReservationRow): string {
  const parts = [r.guestFirstName, r.guestLastName].filter(Boolean);
  return parts.length ? parts.join(" ") : r.guestEmail || "Guest";
}

function reservationPartyLabel(r: ReservationRow): string {
  if (r.reservationType === "member") {
    return r.memberDisplayName || r.memberNumber || "Member";
  }
  return reservationGuestLabel(r);
}

function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function formatPaymentType(t: string): string {
  if (t === "past_due") return "Past due";
  if (t === "reservation") return "Reservation";
  return t;
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
      className="p-3 font-semibold text-center align-bottom max-w-[11rem]"
      title={meta?.body}
    >
      <div className="flex flex-col items-center gap-0.5">
        <div className="flex items-start justify-center gap-0.5">
          <span className="block text-[#d4af37]/95 leading-snug text-center">{title}</span>
          <HeaderHelpButton helpId={helpId} currentId={columnHelpId} onToggle={onColumnHelp} />
        </div>
        {subtitle ? (
          <span className="block mt-0.5 text-[11px] font-normal text-[#e8e0d5]/55 leading-tight max-w-[9.5rem] mx-auto">
            {subtitle}
          </span>
        ) : null}
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
    <th scope="col" className="p-3 font-semibold text-left align-bottom" title={meta.body}>
      <div className="inline-flex items-center gap-0.5">
        <span className="text-[#d4af37]/95">Camp</span>
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
    <th scope="col" className="p-2 w-12 text-center align-middle" title={meta.body}>
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[10px] font-medium text-[#d4af37]/80 leading-none">Open</span>
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
  const [filterSlug, setFilterSlug] = useState<string>("");
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
  const [reservationCache, setReservationCache] = useState<Record<string, ReservationRow[]>>({});
  const reservationCacheRef = useRef(reservationCache);
  reservationCacheRef.current = reservationCache;
  const [columnHelpId, setColumnHelpId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/members/caretaker/admin/summary", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(typeof j.error === "string" ? j.error : res.statusText);
        }
        return res.json() as Promise<{ camps: CampRow[]; rosterUnmapped: RosterRow[] }>;
      })
      .then((data) => {
        if (cancelled) return;
        setCamps(data.camps ?? []);
        setRosterUnmapped(data.rosterUnmapped ?? []);
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
  }, []);

  useEffect(() => {
    if (!expandedSlug) return;
    if (Object.hasOwn(reservationCacheRef.current, expandedSlug)) return;
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
  }, [expandedSlug]);

  const filtered = useMemo(() => {
    if (!filterSlug) return camps;
    return camps.filter((c) => c.slug === filterSlug);
  }, [camps, filterSlug]);

  const toggleExpand = (slug: string) => {
    setExpandedSlug((cur) => (cur === slug ? null : slug));
  };

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
    <div className="space-y-8">
      <ColumnHelpSheet helpId={columnHelpId} onClose={() => setColumnHelpId(null)} />

      {rosterUnmapped.length > 0 && (
        <div className="rounded-lg border border-amber-500/35 bg-amber-950/20 px-4 py-3 text-sm text-amber-100/90">
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

      <div className="flex flex-wrap items-end gap-3">
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
      </div>

      <div className="overflow-x-auto rounded-lg border border-[#d4af37]/20">
        <table className="w-full text-sm text-left border-collapse min-w-[920px]">
          <thead>
            <tr className="bg-[#1a1208]/90 text-[#d4af37]/95 border-b border-[#d4af37]/25">
              <ThExpandWithHelp columnHelpId={columnHelpId} onColumnHelp={setColumnHelpId} />
              <ThCampWithHelp columnHelpId={columnHelpId} onColumnHelp={setColumnHelpId} />
              <ThWithHelp
                helpId="membersStay"
                columnHelpId={columnHelpId}
                onColumnHelp={setColumnHelpId}
                title="Members on stay"
                subtitle="Active member check-ins"
              />
              <ThWithHelp
                helpId="guestsStay"
                columnHelpId={columnHelpId}
                onColumnHelp={setColumnHelpId}
                title="Guests on stay"
                subtitle="Active guest check-ins"
              />
              <ThWithHelp
                helpId="memCheck30"
                columnHelpId={columnHelpId}
                onColumnHelp={setColumnHelpId}
                title="Member check-ins"
                subtitle="Last 30 days"
              />
              <ThWithHelp
                helpId="gstCheck30"
                columnHelpId={columnHelpId}
                onColumnHelp={setColumnHelpId}
                title="Guest check-ins"
                subtitle="Last 30 days"
              />
              <ThWithHelp
                helpId="openRes"
                columnHelpId={columnHelpId}
                onColumnHelp={setColumnHelpId}
                title="Open reservations"
                subtitle="Not cancelled, checkout today or later"
              />
              <ThWithHelp
                helpId="onSite"
                columnHelpId={columnHelpId}
                onColumnHelp={setColumnHelpId}
                title="On site today"
                subtitle="Reserved or checked in, stay includes today"
              />
              <th
                scope="col"
                className="p-3 font-semibold text-left align-bottom min-w-[11rem] max-w-[14rem]"
                title={COLUMN_HELP.assigned.body}
              >
                <div className="inline-flex items-center gap-0.5">
                  <span className="block text-[#d4af37]/95">Assigned caretakers</span>
                  <HeaderHelpButton helpId="assigned" currentId={columnHelpId} onToggle={setColumnHelpId} />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const open = expandedSlug === row.slug;
              return (
                <Fragment key={row.slug}>
                  <tr className="border-b border-[#d4af37]/10 odd:bg-[#0f0a06]/40 even:bg-[#0a0704]/40">
                    <td className="p-1 align-middle text-center">
                      <button
                        type="button"
                        onClick={() => toggleExpand(row.slug)}
                        className="p-2 rounded text-[#d4af37] hover:bg-[#d4af37]/10 transition-colors mx-auto"
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
                    <td className="p-3 font-medium text-[#f0d48f]">
                      <button
                        type="button"
                        onClick={() => toggleExpand(row.slug)}
                        className="text-left hover:underline decoration-[#d4af37]/50"
                      >
                        {row.name}
                      </button>
                    </td>
                    <td className="p-3 text-center tabular-nums">{row.activeMemberCheckIns}</td>
                    <td className="p-3 text-center tabular-nums">{row.activeGuestCheckIns}</td>
                    <td className="p-3 text-center tabular-nums">{row.memberCheckInsLast30Days}</td>
                    <td className="p-3 text-center tabular-nums">{row.guestCheckInsLast30Days}</td>
                    <td className="p-3 text-center tabular-nums">{row.activeReservations}</td>
                    <td className="p-3 text-center tabular-nums">{row.reservationsOnProperty}</td>
                    <td className="p-3 text-[#e8e0d5]/85">
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
                    <tr key={`${row.slug}-detail`} className="bg-[#080604]/90 border-b border-[#d4af37]/15">
                      <td colSpan={9} className="p-0">
                        <CampExpandedPanel
                          camp={row}
                          reservations={reservationCache[row.slug]}
                          columnHelpId={columnHelpId}
                          onColumnHelp={setColumnHelpId}
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
  return (
    <th scope="col" className={`p-2 font-semibold ${className}`} title={meta?.body}>
      <div
        className={`flex items-center gap-0.5 ${className.includes("text-right") ? "justify-end w-full" : ""}`}
      >
        {children}
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

function CampExpandedPanel({
  camp,
  reservations,
  columnHelpId,
  onColumnHelp,
}: {
  camp: CampRow;
  reservations: ReservationRow[] | undefined;
  columnHelpId: string | null;
  onColumnHelp: (id: string | null) => void;
}) {
  const idToName = new Map(
    camp.assignedCaretakers.map((r) => [r.contactId, rosterName(r)] as const)
  );

  const [revFromInput, setRevFromInput] = useState("");
  const [revToInput, setRevToInput] = useState("");
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");
  const [stripePayments, setStripePayments] = useState<StripePaymentRow[] | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStripeLoading(true);
    setStripeError(null);
    const params = new URLSearchParams({ campSlug: camp.slug });
    if (appliedFrom) params.set("from", appliedFrom);
    if (appliedTo) params.set("to", appliedTo);
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
      })
      .finally(() => {
        if (!cancelled) setStripeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [camp.slug, appliedFrom, appliedTo]);

  const stripeByDay = useMemo(
    () => (stripePayments ? groupStripeByDay(stripePayments) : []),
    [stripePayments]
  );

  return (
    <div className="px-4 py-5 space-y-6 border-t border-[#d4af37]/15">
      <div>
        <h3 className="text-[#f0d48f] font-serif text-lg mb-3">Reservation history — {camp.name}</h3>
        {reservations === undefined ? (
          <div className="flex items-center gap-2 text-[#e8e0d5]/60 text-sm py-4">
            <Loader2 className="w-4 h-4 animate-spin text-[#d4af37]" />
            Loading reservations…
          </div>
        ) : reservations.length === 0 ? (
          <p className="text-sm text-[#e8e0d5]/55 py-2">No reservations on record for this camp.</p>
        ) : (
          <div className="overflow-x-auto rounded border border-[#d4af37]/15">
            <table className="w-full text-xs sm:text-sm text-left">
              <thead>
                <tr className="bg-[#1a1208]/80 text-[#d4af37]/90">
                  <th className="p-2 font-semibold" title="Campsite name">
                    Site
                  </th>
                  <th className="p-2 font-semibold" title="Member or guest on the reservation">
                    Guest / member
                  </th>
                  <th className="p-2 font-semibold" title="First night of the stay">
                    Check in
                  </th>
                  <th className="p-2 font-semibold" title="Morning of departure (checkout day)">
                    Check out
                  </th>
                  <th className="p-2 font-semibold text-center" title="Number of nights billed">
                    Nights
                  </th>
                  <th className="p-2 font-semibold" title="reserved, checked in, completed, or cancelled">
                    Status
                  </th>
                  <th className="p-2 font-semibold" title="Member vs guest reservation">
                    Type
                  </th>
                  <th className="p-2 font-semibold" title="When the reservation row was first created">
                    Booked
                  </th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((r) => (
                  <tr key={r.id} className="border-t border-[#d4af37]/10 text-[#e8e0d5]/90">
                    <td className="p-2">{r.siteName ?? "—"}</td>
                    <td className="p-2">{reservationPartyLabel(r)}</td>
                    <td className="p-2 tabular-nums">{r.checkInDate.slice(0, 10)}</td>
                    <td className="p-2 tabular-nums">{r.checkOutDate.slice(0, 10)}</td>
                    <td className="p-2 text-center tabular-nums">{r.nights}</td>
                    <td className="p-2 capitalize">{r.status.replace(/_/g, " ")}</td>
                    <td className="p-2 capitalize">{r.reservationType}</td>
                    <td className="p-2 tabular-nums text-[#e8e0d5]/70">
                      {r.createdAt ? r.createdAt.slice(0, 10) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11px] text-[#e8e0d5]/45 px-2 py-1.5 border-t border-[#d4af37]/10">
              Showing up to 300 reservations, newest checkout first.
            </p>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-[#f0d48f] font-serif text-lg mb-2">Stripe card revenue — {camp.name}</h3>
        <p className="text-sm text-[#e8e0d5]/60 mb-3">
          Payments recorded when Stripe Checkout completed (card only). Cash is not included. Sorted by
          processed time, grouped by calendar day (UTC date).
        </p>
        <div className="flex flex-wrap items-end gap-3 mb-4">
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
              setAppliedFrom(revFromInput.trim());
              setAppliedTo(revToInput.trim());
            }}
            className="rounded border border-[#d4af37]/50 bg-[#d4af37]/15 text-[#f0d48f] px-4 py-2 text-sm hover:bg-[#d4af37]/25"
          >
            Apply range
          </button>
          <button
            type="button"
            onClick={() => {
              setRevFromInput("");
              setRevToInput("");
              setAppliedFrom("");
              setAppliedTo("");
            }}
            className="text-sm text-[#e8e0d5]/55 hover:text-[#d4af37] px-2 py-2"
          >
            Clear range
          </button>
        </div>

        {stripeLoading ? (
          <div className="flex items-center gap-2 text-[#e8e0d5]/60 text-sm py-4">
            <Loader2 className="w-4 h-4 animate-spin text-[#d4af37]" />
            Loading Stripe payments…
          </div>
        ) : stripeError ? (
          <p className="text-sm text-red-300/90">{stripeError}</p>
        ) : stripePayments && stripePayments.length === 0 ? (
          <p className="text-sm text-[#e8e0d5]/55 py-2">No Stripe card payments on record for this camp in the selected range.</p>
        ) : stripePayments && stripePayments.length > 0 ? (
          <div className="space-y-4">
            {stripeByDay.map((g) => (
              <div key={g.day} className="rounded border border-[#d4af37]/15 overflow-hidden">
                <div className="bg-[#1a1208]/90 px-3 py-2 text-sm font-medium text-[#d4af37] tabular-nums">
                  {g.day}{" "}
                  <span className="text-[#e8e0d5]/50 font-normal text-xs ml-2">
                    ({g.rows.length} payment{g.rows.length === 1 ? "" : "s"} ·{" "}
                    {formatUsd(g.rows.reduce((s, r) => s + r.amountCents, 0))}{" "}
                    total)
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm text-left">
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
                          <td className="p-2 tabular-nums whitespace-nowrap">
                            {p.createdAt.slice(0, 19).replace("T", " ")}
                          </td>
                          <td className="p-2 text-right tabular-nums font-medium text-[#f0d48f]/95">
                            {formatUsd(p.amountCents)}
                          </td>
                          <td className="p-2 capitalize">{formatPaymentType(p.paymentType)}</td>
                          <td className="p-2">{p.recipientDisplayName}</td>
                          <td className="p-2 break-all max-w-[10rem] sm:max-w-none">{p.memberEmail}</td>
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
              Up to 500 Stripe payments per request. Session IDs are stored internally for support; not shown
              here.
            </p>
          </div>
        ) : null}
      </div>

      {camp.checkInsLast30DaysByCaretaker.length > 0 ? (
        <div>
          <h3 className="text-[#f0d48f] font-serif text-lg mb-2">Member check-ins (30 days) by caretaker</h3>
          <ul className="text-sm text-[#e8e0d5]/85 space-y-1">
            {camp.checkInsLast30DaysByCaretaker.map((b) => (
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
      ) : null}
    </div>
  );
}
