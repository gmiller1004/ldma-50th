"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
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
      setSnapshots(data.snapshots ?? []);
    } catch (e) {
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
      setMonthlyBookings(data.totals ?? []);
    } catch (loadError) {
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
      setSeasonMonths(data.totals ?? []);
    } catch (loadError) {
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

  async function handleExportCsv() {
    setExporting(true);
    setExportError(null);
    try {
      const params = new URLSearchParams({ campSlug, seasonFrom, seasonTo });
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
        match?.[1] ?? `ldma-season-totals-${campSlug}-${seasonFrom}-to-${seasonTo}.csv`;
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
      setExporting(false);
    }
  }

  const seasonSelectValue = `${seasonFrom}|${seasonTo}`;

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
          <button
            type="button"
            onClick={() => void handleExportCsv()}
            disabled={exporting || snapshots.length === 0}
            className="inline-flex items-center gap-2 rounded-md border border-[#d4af37]/35 bg-[#1a140c] px-3 py-2 text-sm text-[#f0d48f] hover:bg-[#241c12] disabled:opacity-50"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export CSV
          </button>
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
                <input
                  type="date"
                  value={seasonFrom}
                  onChange={(e) => {
                    setSeasonFrom(e.target.value);
                    setSeasonLabel(`${e.target.value} – ${seasonTo}`);
                  }}
                  className="w-full rounded-md border border-[#d4af37]/25 bg-[#0f0a06] px-2 py-2 text-sm text-[#e8e0d5]"
                />
                <input
                  type="date"
                  value={seasonTo}
                  onChange={(e) => {
                    setSeasonTo(e.target.value);
                    setSeasonLabel(`${seasonFrom} – ${e.target.value}`);
                  }}
                  className="w-full rounded-md border border-[#d4af37]/25 bg-[#0f0a06] px-2 py-2 text-sm text-[#e8e0d5]"
                />
              </div>
            )}
          </label>

          <label className="block text-xs text-[#e8e0d5]/60 space-y-1">
            <span>As of (report pull date)</span>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="w-full rounded-md border border-[#d4af37]/25 bg-[#0f0a06] px-3 py-2 text-sm text-[#e8e0d5]"
            />
          </label>

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
                    {formatSnapshotColumnDate(s.snapshotDate)}
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
            <label className="block text-xs text-[#e8e0d5]/60 space-y-1">
              <span>From month</span>
              <input
                type="month"
                value={bookingFrom}
                onChange={(event) => setBookingFrom(event.target.value)}
                className="rounded-md border border-[#d4af37]/25 bg-[#0f0a06] px-3 py-2 text-sm text-[#e8e0d5]"
              />
            </label>
            <label className="block text-xs text-[#e8e0d5]/60 space-y-1">
              <span>To month</span>
              <input
                type="month"
                value={bookingTo}
                onChange={(event) => setBookingTo(event.target.value)}
                className="rounded-md border border-[#d4af37]/25 bg-[#0f0a06] px-3 py-2 text-sm text-[#e8e0d5]"
              />
            </label>
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
