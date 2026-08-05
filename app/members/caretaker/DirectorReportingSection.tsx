"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Download, Loader2, RefreshCw, Trash2, X } from "lucide-react";
import { directoryCamps } from "@/lib/directory-camps";
import { campUsesReservations } from "@/lib/reservation-camps";
import { campHasSeasonalClosure } from "@/lib/camp-seasons";
import { formatCentsAsCurrency } from "@/lib/reservation-pricing";
import {
  defaultSeasonForCamp,
  formatBookingMonthLabel,
  formatSnapshotColumnDate,
  listSeasonOptions,
  seasonTitle,
  type MonthlyBookingTotal,
  type SeasonMonthTotal,
  type SeasonRange,
} from "@/lib/director-season-totals";

type SnapshotRow = {
  id: string;
  campSlug: string;
  campName: string;
  seasonFrom: string;
  seasonTo: string;
  snapshotDate: string;
  siteNightsBooked: number;
  siteNightsAvailable: number;
  totalSiteNights: number;
  bookedPercent: number;
  availablePercent: number;
  revenueCollectedCents: number;
  revenueOwedCents: number;
  totalReservations: number;
  generatedAt: string;
};

function todayLocalIso(): string {
  return new Date().toLocaleDateString("en-CA");
}

function previousMonth(isoMonth: string): string {
  const year = Number(isoMonth.slice(0, 4));
  const month = Number(isoMonth.slice(5, 7));
  return month === 1
    ? `${year - 1}-12`
    : `${year}-${String(month - 1).padStart(2, "0")}`;
}

function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * Date/month input with an explicit calendar trigger. The native indicator is
 * hidden in CSS because it is invisible on the dark portal and absent in Safari.
 */
function PortalDateField({
  type,
  value,
  onChange,
  label,
  className = "",
}: {
  type: "date" | "month";
  value: string;
  onChange: (value: string) => void;
  label: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    const withPicker = input as HTMLInputElement & { showPicker?: () => void };
    if (typeof withPicker.showPicker === "function") {
      try {
        withPicker.showPicker();
      } catch {
        // Older Safari throws when the picker is not user-activated; focus is enough.
      }
    }
  }

  return (
    <div className={`relative ${className}`}>
      <input
        ref={inputRef}
        type={type}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        className="ct-date-input w-full rounded-md border border-[#d4af37]/25 bg-[#0f0a06] py-2 pl-3 pr-9 text-sm text-[#e8e0d5]"
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={`Open ${label} calendar`}
        onClick={openPicker}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-[#d4af37] hover:text-[#f0d48f]"
      >
        <CalendarDays className="h-4 w-4" />
      </button>
    </div>
  );
}

function formatPct(n: number): string {
  return `${n}%`;
}

const TREND_ROWS: {
  key: string;
  label: string;
  render: (s: SnapshotRow) => string;
}[] = [
  {
    key: "booked",
    label: "Site Nights Booked",
    render: (s) => `${formatCount(s.siteNightsBooked)} (${formatPct(s.bookedPercent)})`,
  },
  {
    key: "available",
    label: "Site Nights Available",
    render: (s) => `${formatCount(s.siteNightsAvailable)} (${formatPct(s.availablePercent)})`,
  },
  {
    key: "collected",
    label: "Revenue - Collected",
    render: (s) => formatCentsAsCurrency(s.revenueCollectedCents),
  },
  {
    key: "owed",
    label: "Revenue - Owed",
    render: (s) => formatCentsAsCurrency(s.revenueOwedCents),
  },
  {
    key: "reservations",
    label: "Total Reservations",
    render: (s) => formatCount(s.totalReservations),
  },
];

export function DirectorReportingSection() {
  const reservationCamps = useMemo(
    () => directoryCamps.filter((c) => campUsesReservations(c.slug)),
    []
  );
  const seasonalCamps = useMemo(
    () => reservationCamps.filter((c) => campHasSeasonalClosure(c.slug)),
    [reservationCamps]
  );

  const [campSlug, setCampSlug] = useState("stanton-arizona");
  const [seasonFrom, setSeasonFrom] = useState("2026-10-01");
  const [seasonTo, setSeasonTo] = useState("2027-05-31");
  const [seasonLabel, setSeasonLabel] = useState("October 1 – May 31");
  const [asOfDate, setAsOfDate] = useState(todayLocalIso);
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [lastPulled, setLastPulled] = useState<SnapshotRow | null>(null);
  const currentMonth = todayLocalIso().slice(0, 7);
  const [bookingFrom, setBookingFrom] = useState(() => previousMonth(currentMonth));
  const [bookingTo, setBookingTo] = useState(currentMonth);
  const [monthlyBookings, setMonthlyBookings] = useState<MonthlyBookingTotal[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyError, setMonthlyError] = useState<string | null>(null);
  const [seasonMonths, setSeasonMonths] = useState<SeasonMonthTotal[]>([]);
  const [seasonMonthsLoading, setSeasonMonthsLoading] = useState(false);
  const [seasonMonthsError, setSeasonMonthsError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const seasonKey = `${campSlug}|${seasonFrom}|${seasonTo}`;
  const bookingKey = `${seasonKey}|${bookingFrom}|${bookingTo}`;
  const activeSeasonKey = useRef(seasonKey);
  const activeBookingKey = useRef(bookingKey);

  // Clear the grids the moment the selection changes so a slow fetch never
  // leaves the previous camp/season columns stacked next to the new ones.
  useEffect(() => {
    activeSeasonKey.current = seasonKey;
    setSnapshots([]);
    setSeasonMonths([]);
    setLastPulled(null);
    setError(null);
    setSeasonMonthsError(null);
    setExportError(null);
  }, [seasonKey]);

  useEffect(() => {
    activeBookingKey.current = bookingKey;
    setMonthlyBookings([]);
    setMonthlyError(null);
  }, [bookingKey]);

  const seasonOptions = useMemo(() => {
    if (!campHasSeasonalClosure(campSlug)) return [] as SeasonRange[];
    const year = Number(todayLocalIso().slice(0, 4));
    return listSeasonOptions(campSlug, year, 2);
  }, [campSlug]);

  const applySeason = useCallback((range: SeasonRange) => {
    setSeasonFrom(range.from);
    setSeasonTo(range.to);
    setSeasonLabel(range.label);
  }, []);

  useEffect(() => {
    const defaults = defaultSeasonForCamp(campSlug, todayLocalIso());
    if (defaults) {
      applySeason(defaults);
      return;
    }
    const year = Number(todayLocalIso().slice(0, 4));
    setSeasonFrom(`${year}-01-01`);
    setSeasonTo(`${year}-12-31`);
    setSeasonLabel(`${year} calendar year`);
  }, [campSlug, applySeason]);

  const loadSnapshots = useCallback(async () => {
    if (!campSlug || !seasonFrom || !seasonTo) return;
    const requestKey = `${campSlug}|${seasonFrom}|${seasonTo}`;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ campSlug, seasonFrom, seasonTo });
      const res = await fetch(`/api/members/caretaker/admin/season-totals?${params}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(typeof j.error === "string" ? j.error : res.statusText);
      }
      const data = (await res.json()) as { snapshots?: SnapshotRow[] };
      if (activeSeasonKey.current !== requestKey) return;
      setSnapshots(data.snapshots ?? []);
    } catch (e) {
      if (activeSeasonKey.current !== requestKey) return;
      setSnapshots([]);
      setError(e instanceof Error ? e.message : "Failed to load snapshots");
    } finally {
      setLoading(false);
    }
  }, [campSlug, seasonFrom, seasonTo]);

  useEffect(() => {
    void loadSnapshots();
  }, [loadSnapshots]);

  const loadMonthlyBookings = useCallback(async () => {
    if (!campSlug || !seasonFrom || !seasonTo || !bookingFrom || !bookingTo) return;
    const requestKey = `${campSlug}|${seasonFrom}|${seasonTo}|${bookingFrom}|${bookingTo}`;
    setMonthlyLoading(true);
    setMonthlyError(null);
    try {
      const params = new URLSearchParams({
        campSlug,
        seasonFrom,
        seasonTo,
        bookingFrom,
        bookingTo,
      });
      const res = await fetch(`/api/members/caretaker/admin/monthly-bookings?${params}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : res.statusText);
      }
      const data = (await res.json()) as { totals?: MonthlyBookingTotal[] };
      if (activeBookingKey.current !== requestKey) return;
      setMonthlyBookings(data.totals ?? []);
    } catch (loadError) {
      if (activeBookingKey.current !== requestKey) return;
      setMonthlyBookings([]);
      setMonthlyError(
        loadError instanceof Error ? loadError.message : "Failed to load monthly bookings"
      );
    } finally {
      setMonthlyLoading(false);
    }
  }, [campSlug, seasonFrom, seasonTo, bookingFrom, bookingTo]);

  useEffect(() => {
    void loadMonthlyBookings();
  }, [loadMonthlyBookings]);

  const loadSeasonMonths = useCallback(async () => {
    if (!campSlug || !seasonFrom || !seasonTo) return;
    const requestKey = `${campSlug}|${seasonFrom}|${seasonTo}`;
    setSeasonMonthsLoading(true);
    setSeasonMonthsError(null);
    try {
      const params = new URLSearchParams({ campSlug, seasonFrom, seasonTo });
      const res = await fetch(`/api/members/caretaker/admin/season-months?${params}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : res.statusText);
      }
      const data = (await res.json()) as { totals?: SeasonMonthTotal[] };
      if (activeSeasonKey.current !== requestKey) return;
      setSeasonMonths(data.totals ?? []);
    } catch (loadError) {
      if (activeSeasonKey.current !== requestKey) return;
      setSeasonMonths([]);
      setSeasonMonthsError(
        loadError instanceof Error ? loadError.message : "Failed to load season months"
      );
    } finally {
      setSeasonMonthsLoading(false);
    }
  }, [campSlug, seasonFrom, seasonTo]);

  useEffect(() => {
    void loadSeasonMonths();
  }, [loadSeasonMonths]);

  const campName =
    reservationCamps.find((c) => c.slug === campSlug)?.name ??
    seasonalCamps.find((c) => c.slug === campSlug)?.name ??
    campSlug;

  const title = seasonTitle(campName, {
    from: seasonFrom,
    to: seasonTo,
    label: seasonLabel,
  });

  const latest = lastPulled?.snapshotDate === asOfDate
    ? lastPulled
    : [...snapshots].reverse().find((s) => s.snapshotDate === asOfDate) ??
      snapshots[snapshots.length - 1] ??
      null;

  async function handlePullReport() {
    setPulling(true);
    setError(null);
    try {
      const res = await fetch("/api/members/caretaker/admin/season-totals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          campSlug,
          seasonFrom,
          seasonTo,
          snapshotDate: asOfDate,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(typeof j.error === "string" ? j.error : res.statusText);
      }
      const data = (await res.json()) as { snapshot: SnapshotRow };
      setLastPulled(data.snapshot);
      await loadSnapshots();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to pull report");
    } finally {
      setPulling(false);
    }
  }

  const refreshAll = useCallback(async () => {
    await Promise.all([loadSnapshots(), loadMonthlyBookings(), loadSeasonMonths()]);
  }, [loadSnapshots, loadMonthlyBookings, loadSeasonMonths]);

  async function handleClearSnapshots(snapshotDate: string | null) {
    if (
      snapshotDate === null &&
      typeof window !== "undefined" &&
      !window.confirm("Clear every saved snapshot for this season?")
    ) {
      return;
    }
    setDeleting(snapshotDate ?? "all");
    setError(null);
    try {
      const params = new URLSearchParams({ campSlug, seasonFrom, seasonTo });
      if (snapshotDate) params.set("snapshotDate", snapshotDate);
      const res = await fetch(`/api/members/caretaker/admin/season-totals?${params}`, {
        method: "DELETE",
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : res.statusText);
      }
      setLastPulled(null);
      await loadSnapshots();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to clear snapshots");
    } finally {
      setDeleting(null);
    }
  }

  async function handleExportCsv() {
    setExporting(true);
    setExportError(null);
    try {
      const params = new URLSearchParams({
        campSlug,
        seasonFrom,
        seasonTo,
        seasonLabel,
        bookingFrom,
        bookingTo,
      });
      const res = await fetch(`/api/members/caretaker/admin/season-totals-export?${params}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(typeof j.error === "string" ? j.error : "Download failed");
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition");
      const match = cd?.match(/filename="([^"]+)"/);
      const filename =
        match?.[1] ?? `ldma-director-report-${campSlug}-${seasonFrom}-to-${seasonTo}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Safari cancels the download if the object URL is revoked synchronously.
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setExporting(false);
    }
  }

  const seasonSelectValue = `${seasonFrom}|${seasonTo}`;
  const anyLoading = loading || monthlyLoading || seasonMonthsLoading;

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-[#d4af37]/25 bg-[#0f0a06]/40 p-4 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-[#f0d48f]">1. Season Totals</h2>
            <p className="text-xs text-[#e8e0d5]/55 mt-1 max-w-2xl">
              Weekly running season snapshot for marketing and financial trending. Pulling a report
              saves that as-of date so you can compare week over week. Historical pulls use
              create/cancel and payment dates; stay edits after the as-of date are best-effort.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshAll()}
              disabled={anyLoading}
              className="inline-flex items-center gap-2 rounded-md border border-[#d4af37]/35 bg-[#1a140c] px-3 py-2 text-sm text-[#f0d48f] hover:bg-[#241c12] disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${anyLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => void handleExportCsv()}
              disabled={exporting}
              className="inline-flex items-center gap-2 rounded-md border border-[#d4af37]/35 bg-[#1a140c] px-3 py-2 text-sm text-[#f0d48f] hover:bg-[#241c12] disabled:opacity-50"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Export CSV
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-xs text-[#e8e0d5]/60 space-y-1">
            <span>Camp</span>
            <select
              value={campSlug}
              onChange={(e) => setCampSlug(e.target.value)}
              className="w-full rounded-md border border-[#d4af37]/25 bg-[#0f0a06] px-3 py-2 text-sm text-[#e8e0d5]"
            >
              {(seasonalCamps.length > 0 ? seasonalCamps : reservationCamps).map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs text-[#e8e0d5]/60 space-y-1 sm:col-span-2 lg:col-span-1">
            <span>Season</span>
            {seasonOptions.length > 0 ? (
              <select
                value={seasonSelectValue}
                onChange={(e) => {
                  const opt = seasonOptions.find((o) => `${o.from}|${o.to}` === e.target.value);
                  if (opt) applySeason(opt);
                }}
                className="w-full rounded-md border border-[#d4af37]/25 bg-[#0f0a06] px-3 py-2 text-sm text-[#e8e0d5]"
              >
                {seasonOptions.map((o) => (
                  <option key={`${o.from}|${o.to}`} value={`${o.from}|${o.to}`}>
                    {o.label} ({o.from} → {o.to})
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex gap-2">
                <PortalDateField
                  type="date"
                  label="Season start"
                  value={seasonFrom}
                  onChange={(next) => {
                    setSeasonFrom(next);
                    setSeasonLabel(`${next} – ${seasonTo}`);
                  }}
                  className="w-full"
                />
                <PortalDateField
                  type="date"
                  label="Season end"
                  value={seasonTo}
                  onChange={(next) => {
                    setSeasonTo(next);
                    setSeasonLabel(`${seasonFrom} – ${next}`);
                  }}
                  className="w-full"
                />
              </div>
            )}
          </label>

          <div className="block text-xs text-[#e8e0d5]/60 space-y-1">
            <span>As of (report pull date)</span>
            <PortalDateField
              type="date"
              label="As of (report pull date)"
              value={asOfDate}
              onChange={setAsOfDate}
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void handlePullReport()}
              disabled={pulling || !asOfDate}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-[#d4af37]/50 bg-[#d4af37]/15 px-3 py-2 text-sm font-medium text-[#f0d48f] hover:bg-[#d4af37]/25 disabled:opacity-50"
            >
              {pulling ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Pull report
            </button>
          </div>
        </div>

        {exportError ? (
          <p className="text-sm text-red-300" role="alert">
            {exportError}
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-red-300" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      {loading && snapshots.length === 0 ? (
        <div className="flex items-center gap-3 text-[#e8e0d5]/70 py-8">
          <Loader2 className="w-5 h-5 animate-spin text-[#d4af37]" />
          Loading season totals…
        </div>
      ) : null}

      {latest ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard
            label="Site nights booked"
            value={`${formatCount(latest.siteNightsBooked)} (${formatPct(latest.bookedPercent)})`}
          />
          <MetricCard
            label="Site nights available"
            value={`${formatCount(latest.siteNightsAvailable)} (${formatPct(latest.availablePercent)})`}
          />
          <MetricCard
            label="Revenue collected"
            value={formatCentsAsCurrency(latest.revenueCollectedCents)}
          />
          <MetricCard
            label="Revenue owed"
            value={formatCentsAsCurrency(latest.revenueOwedCents)}
          />
          <MetricCard
            label="Total reservations"
            value={formatCount(latest.totalReservations)}
          />
        </section>
      ) : (
        <p className="text-sm text-[#e8e0d5]/55">
          No snapshots yet for this season. Choose an as-of date and click <strong>Pull report</strong>.
        </p>
      )}

      <section className="rounded-lg border border-[#d4af37]/25 overflow-hidden">
        {snapshots.length > 0 ? (
          <div className="flex justify-end border-b border-[#d4af37]/15 bg-[#0f0a06]/40 px-3 py-2">
            <button
              type="button"
              onClick={() => void handleClearSnapshots(null)}
              disabled={deleting !== null}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#d4af37]/25 px-2 py-1 text-xs text-[#e8e0d5]/70 hover:border-red-400/50 hover:text-red-300 disabled:opacity-50"
            >
              {deleting === "all" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Clear all snapshots
            </button>
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-[#1a140c]">
                <th className="px-3 py-3 text-left font-semibold text-[#0f0a06] bg-[#f0d48f] min-w-[12rem]">
                  {title}
                </th>
                {snapshots.map((s) => (
                  <th
                    key={s.id}
                    className="px-3 py-3 text-right font-semibold text-[#f0d48f] whitespace-nowrap"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {formatSnapshotColumnDate(s.snapshotDate)}
                      <button
                        type="button"
                        onClick={() => void handleClearSnapshots(s.snapshotDate)}
                        disabled={deleting !== null}
                        aria-label={`Remove ${formatSnapshotColumnDate(s.snapshotDate)} snapshot`}
                        className="rounded text-[#e8e0d5]/40 hover:text-red-300 disabled:opacity-50"
                      >
                        {deleting === s.snapshotDate ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <X className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </span>
                  </th>
                ))}
                {snapshots.length === 0 ? (
                  <th className="px-3 py-3 text-right font-medium text-[#e8e0d5]/40">—</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {TREND_ROWS.map((row) => (
                <tr key={row.key} className="border-t border-[#d4af37]/15">
                  <th className="px-3 py-2.5 text-left font-medium text-[#e8e0d5]/85 bg-[#0f0a06]/40">
                    {row.label}
                  </th>
                  {snapshots.map((s) => (
                    <td
                      key={`${row.key}-${s.id}`}
                      className="px-3 py-2.5 text-right tabular-nums text-[#e8e0d5]/90 whitespace-nowrap"
                    >
                      {row.render(s)}
                    </td>
                  ))}
                  {snapshots.length === 0 ? (
                    <td className="px-3 py-2.5 text-right text-[#e8e0d5]/35">—</td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-[#d4af37]/25 bg-[#0f0a06]/40 p-4 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-[#f0d48f]">
              2. Current Month Bookings
            </h2>
            <p className="text-xs text-[#e8e0d5]/55 mt-1 max-w-2xl">
              New, active reservations grouped by the month they were created. Site nights are the
              nights those bookings contribute within the selected {campName} season.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="block text-xs text-[#e8e0d5]/60 space-y-1">
              <span>From month</span>
              <PortalDateField
                type="month"
                label="From month"
                value={bookingFrom}
                onChange={setBookingFrom}
                className="w-40"
              />
            </div>
            <div className="block text-xs text-[#e8e0d5]/60 space-y-1">
              <span>To month</span>
              <PortalDateField
                type="month"
                label="To month"
                value={bookingTo}
                onChange={setBookingTo}
                className="w-40"
              />
            </div>
          </div>
        </div>

        {monthlyError ? (
          <p className="text-sm text-red-300" role="alert">
            {monthlyError}
          </p>
        ) : null}

        {monthlyLoading && monthlyBookings.length === 0 ? (
          <div className="flex items-center gap-2 py-5 text-sm text-[#e8e0d5]/65">
            <Loader2 className="h-4 w-4 animate-spin text-[#d4af37]" />
            Loading monthly bookings…
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-[#d4af37]/20">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-[#1a140c]">
                  <th className="min-w-[12rem] bg-[#f0d48f] px-3 py-3 text-left font-semibold text-[#0f0a06]">
                    Current Month Bookings
                  </th>
                  {monthlyBookings.map((total) => (
                    <th
                      key={total.month}
                      className="whitespace-nowrap px-4 py-3 text-right font-semibold text-[#f0d48f]"
                    >
                      {formatBookingMonthLabel(total.month)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-[#d4af37]/15">
                  <th className="bg-[#0f0a06]/40 px-3 py-2.5 text-left font-medium text-[#e8e0d5]/85">
                    Reservations - New
                  </th>
                  {monthlyBookings.map((total) => (
                    <td
                      key={`reservations-${total.month}`}
                      className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-[#e8e0d5]/90"
                    >
                      {formatCount(total.reservationCount)}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-[#d4af37]/15">
                  <th className="bg-[#0f0a06]/40 px-3 py-2.5 text-left font-medium text-[#e8e0d5]/85">
                    Site Nights Booked
                  </th>
                  {monthlyBookings.map((total) => (
                    <td
                      key={`nights-${total.month}`}
                      className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-[#e8e0d5]/90"
                    >
                      {formatCount(total.siteNightsBooked)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-[#d4af37]/25 bg-[#0f0a06]/40 p-4 space-y-4">
        <div>
          <h2 className="text-sm font-medium text-[#f0d48f]">3. Season by Month</h2>
          <p className="mt-1 max-w-2xl text-xs text-[#e8e0d5]/55">
            Live occupancy for each month of the selected {campName} season. Reservations count
            active stays that overlap the month; booked and available site nights use the current
            bookable-site inventory.
          </p>
        </div>

        {seasonMonthsError ? (
          <p className="text-sm text-red-300" role="alert">
            {seasonMonthsError}
          </p>
        ) : null}

        {seasonMonthsLoading && seasonMonths.length === 0 ? (
          <div className="flex items-center gap-2 py-5 text-sm text-[#e8e0d5]/65">
            <Loader2 className="h-4 w-4 animate-spin text-[#d4af37]" />
            Loading season months…
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-[#d4af37]/20">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-[#1a140c]">
                  <th className="min-w-[12rem] bg-[#f0d48f] px-3 py-3 text-left font-semibold text-[#0f0a06]">
                    Season
                  </th>
                  {seasonMonths.map((total) => (
                    <th
                      key={total.month}
                      className="whitespace-nowrap px-4 py-3 text-right font-semibold text-[#f0d48f]"
                    >
                      {total.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <SeasonMonthRow
                  label="Reservations"
                  totals={seasonMonths}
                  value={(total) => total.reservationCount}
                />
                <SeasonMonthRow
                  label="Site Nights Booked"
                  totals={seasonMonths}
                  value={(total) => total.siteNightsBooked}
                />
                <SeasonMonthRow
                  label="Site Nights Available"
                  totals={seasonMonths}
                  value={(total) => total.siteNightsAvailable}
                />
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function SeasonMonthRow({
  label,
  totals,
  value,
}: {
  label: string;
  totals: SeasonMonthTotal[];
  value: (total: SeasonMonthTotal) => number;
}) {
  return (
    <tr className="border-t border-[#d4af37]/15">
      <th className="bg-[#0f0a06]/40 px-3 py-2.5 text-left font-medium text-[#e8e0d5]/85">
        {label}
      </th>
      {totals.map((total) => (
        <td
          key={`${label}-${total.month}`}
          className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-[#e8e0d5]/90"
        >
          {formatCount(value(total))}
        </td>
      ))}
    </tr>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#d4af37]/20 bg-[#0f0a06]/50 px-3 py-3">
      <p className="text-[11px] uppercase tracking-wide text-[#e8e0d5]/45">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-[#f0d48f]">{value}</p>
    </div>
  );
}
