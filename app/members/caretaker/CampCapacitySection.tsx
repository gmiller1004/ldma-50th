"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { directoryCamps } from "@/lib/directory-camps";
import { campUsesReservations } from "@/lib/reservation-camps";
import { currentMonthValue, isValidDateRange, monthDateRange } from "@/lib/camp-capacity";

type SiteNightStats = {
  rangeNights: number;
  totalSiteNights: number;
  bookedSiteNights: number;
  availableSiteNights: number;
  bookedPercent: number;
  availablePercent: number;
};

type CapacityPayload = {
  campSlug: string;
  campName: string;
  from: string;
  to: string;
  totalSites: number;
  bookedSites: number;
  availableSites: number;
  bookedPercent: number;
  availablePercent: number;
  siteNights: SiteNightStats;
};

type RangeMode = "month" | "custom";

function formatLocalIso(d: Date): string {
  return d.toLocaleDateString("en-CA");
}

function CapacityPieChart({
  filledPercent,
  emptyPercent,
  centerLabel,
  size = 180,
}: {
  filledPercent: number;
  emptyPercent: number;
  centerLabel: string;
  size?: number;
}) {
  const filled = Math.max(0, Math.min(100, filledPercent));
  const gradient =
    filled <= 0
      ? "conic-gradient(#2a241c 0% 100%)"
      : filled >= 100
        ? "conic-gradient(#d4af37 0% 100%)"
        : `conic-gradient(#d4af37 0% ${filled}%, #2a241c ${filled}% 100%)`;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="rounded-full border border-[#d4af37]/25"
        style={{ width: size, height: size, background: gradient }}
        role="img"
        aria-label={`${filledPercent}% ${centerLabel.toLowerCase()}, ${emptyPercent}% available`}
      />
      <div
        className="absolute inset-[18%] rounded-full bg-[#0f0a06] border border-[#d4af37]/15 flex flex-col items-center justify-center text-center px-2"
        aria-hidden
      >
        <span className="text-2xl font-semibold tabular-nums text-[#f0d48f]">{filledPercent}%</span>
        <span className="text-[10px] uppercase tracking-wide text-[#e8e0d5]/50">{centerLabel}</span>
      </div>
    </div>
  );
}

function CapacityChartCard({
  title,
  description,
  filledPercent,
  emptyPercent,
  centerLabel,
  filledDetail,
  emptyDetail,
  footnote,
}: {
  title: string;
  description: string;
  filledPercent: number;
  emptyPercent: number;
  centerLabel: string;
  filledDetail: ReactNode;
  emptyDetail: ReactNode;
  footnote?: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 rounded-lg border border-[#d4af37]/15 bg-[#0f0a06]/50 p-4 flex-1 min-w-[16rem]">
      <CapacityPieChart
        filledPercent={filledPercent}
        emptyPercent={emptyPercent}
        centerLabel={centerLabel}
      />
      <div className="flex-1 space-y-2 w-full sm:w-auto">
        <div>
          <h3 className="text-sm font-medium text-[#f0d48f]">{title}</h3>
          <p className="text-xs text-[#e8e0d5]/50 mt-1">{description}</p>
        </div>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full bg-[#d4af37] shrink-0" />
            <span className="text-[#e8e0d5]/85">{filledDetail}</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full bg-[#2a241c] border border-[#d4af37]/25 shrink-0" />
            <span className="text-[#e8e0d5]/85">{emptyDetail}</span>
          </li>
        </ul>
        {footnote ? <p className="text-xs text-[#e8e0d5]/45">{footnote}</p> : null}
      </div>
    </div>
  );
}

export function CampCapacitySection() {
  const reservationCamps = useMemo(
    () => directoryCamps.filter((c) => campUsesReservations(c.slug)),
    []
  );

  const [campSlug, setCampSlug] = useState(() => reservationCamps[0]?.slug ?? "");
  const [rangeMode, setRangeMode] = useState<RangeMode>("month");
  const [monthValue, setMonthValue] = useState(() => currentMonthValue());
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");

  const activeRange = useMemo(() => {
    if (rangeMode === "month") {
      return monthDateRange(monthValue);
    }
    if (isValidDateRange(appliedFrom, appliedTo)) {
      return { from: appliedFrom, to: appliedTo };
    }
    return null;
  }, [rangeMode, monthValue, appliedFrom, appliedTo]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capacity, setCapacity] = useState<CapacityPayload | null>(null);

  useEffect(() => {
    if (!campSlug || !activeRange) {
      setCapacity(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      campSlug,
      from: activeRange.from,
      to: activeRange.to,
    });

    fetch(`/api/members/caretaker/admin/capacity?${params}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(typeof j.error === "string" ? j.error : res.statusText);
        }
        return res.json() as Promise<CapacityPayload>;
      })
      .then((data) => {
        if (!cancelled) {
          setCapacity(data);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setCapacity(null);
          setError(e instanceof Error ? e.message : "Failed to load capacity");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [campSlug, activeRange?.from, activeRange?.to]);

  const rangeLabel = activeRange
    ? activeRange.from === activeRange.to
      ? activeRange.from
      : `${activeRange.from} – ${activeRange.to}`
    : "Select a valid date range";

  return (
    <section className="rounded-lg border border-[#d4af37]/25 bg-[#0f0a06]/40 p-4 space-y-4">
      <div>
        <h2 className="text-sm font-medium text-[#f0d48f]">Camp capacity</h2>
        <p className="text-xs text-[#e8e0d5]/55 mt-1">
          Two views for the selected camp and period: sites with any overlapping reservation, and
          proportional site-night occupancy across the range.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-[#e8e0d5]/65 min-w-[12rem]">
          Camp
          <select
            value={campSlug}
            onChange={(e) => setCampSlug(e.target.value)}
            className="rounded border border-[#d4af37]/30 bg-[#0f0a06] text-[#e8e0d5] px-2 py-1.5 text-sm"
          >
            {reservationCamps.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-1 text-xs text-[#e8e0d5]/65">
          <span>Period</span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setRangeMode("month")}
              className={`rounded border px-3 py-1.5 text-xs ${
                rangeMode === "month"
                  ? "border-[#d4af37]/50 bg-[#d4af37]/15 text-[#f0d48f]"
                  : "border-[#d4af37]/25 text-[#e8e0d5]/80 hover:bg-[#d4af37]/10"
              }`}
            >
              By month
            </button>
            <button
              type="button"
              onClick={() => {
                setRangeMode("custom");
                if (!fromInput && !toInput) {
                  const to = new Date();
                  const from = new Date();
                  from.setDate(from.getDate() - 29);
                  const f = formatLocalIso(from);
                  const t = formatLocalIso(to);
                  setFromInput(f);
                  setToInput(t);
                  setAppliedFrom(f);
                  setAppliedTo(t);
                }
              }}
              className={`rounded border px-3 py-1.5 text-xs ${
                rangeMode === "custom"
                  ? "border-[#d4af37]/50 bg-[#d4af37]/15 text-[#f0d48f]"
                  : "border-[#d4af37]/25 text-[#e8e0d5]/80 hover:bg-[#d4af37]/10"
              }`}
            >
              Custom range
            </button>
          </div>
        </div>

        {rangeMode === "month" ? (
          <label className="flex flex-col gap-1 text-xs text-[#e8e0d5]/65">
            Month
            <input
              type="month"
              value={monthValue}
              onChange={(e) => setMonthValue(e.target.value)}
              className="rounded border border-[#d4af37]/30 bg-[#0f0a06] text-[#e8e0d5] px-2 py-1.5 text-sm"
            />
          </label>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-xs text-[#e8e0d5]/65">
              From
              <input
                type="date"
                value={fromInput}
                onChange={(e) => setFromInput(e.target.value)}
                className="rounded border border-[#d4af37]/30 bg-[#0f0a06] text-[#e8e0d5] px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[#e8e0d5]/65">
              To
              <input
                type="date"
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
                className="rounded border border-[#d4af37]/30 bg-[#0f0a06] text-[#e8e0d5] px-2 py-1.5 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setAppliedFrom(fromInput.trim());
                setAppliedTo(toInput.trim());
              }}
              className="rounded border border-[#d4af37]/50 bg-[#d4af37]/15 text-[#f0d48f] px-4 py-2 text-sm hover:bg-[#d4af37]/25"
            >
              Apply range
            </button>
          </>
        )}
      </div>

      <p className="text-[11px] text-[#e8e0d5]/45">{rangeLabel}</p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[#e8e0d5]/65 py-6">
          <Loader2 className="w-5 h-5 animate-spin text-[#d4af37]" />
          Loading capacity…
        </div>
      ) : error ? (
        <div className="rounded border border-red-500/35 bg-red-950/25 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      ) : capacity ? (
        <div className="space-y-4 pt-2">
          <p className="text-sm text-[#f0d48f] font-medium">{capacity.campName}</p>
          <div className="flex flex-col lg:flex-row gap-4">
            <CapacityChartCard
              title="Sites with any booking"
              description="A site counts as booked for the whole range if any non-cancelled stay overlaps."
              filledPercent={capacity.bookedPercent}
              emptyPercent={capacity.availablePercent}
              centerLabel="booked"
              filledDetail={
                <>
                  <strong className="text-[#f0d48f] tabular-nums">{capacity.bookedSites}</strong> sites
                  with a booking
                  <span className="text-[#e8e0d5]/55"> · {capacity.bookedPercent}%</span>
                </>
              }
              emptyDetail={
                <>
                  <strong className="text-[#f0d48f] tabular-nums">{capacity.availableSites}</strong> sites
                  with no booking
                  <span className="text-[#e8e0d5]/55"> · {capacity.availablePercent}%</span>
                </>
              }
              footnote={`${capacity.totalSites} bookable site${capacity.totalSites === 1 ? "" : "s"}`}
            />
            <CapacityChartCard
              title="Site-night occupancy"
              description="Booked site-nights ÷ total site-nights in the range. A one-week stay in a month counts as ~7 nights, not the full month."
              filledPercent={capacity.siteNights.bookedPercent}
              emptyPercent={capacity.siteNights.availablePercent}
              centerLabel="occupied"
              filledDetail={
                <>
                  <strong className="text-[#f0d48f] tabular-nums">
                    {capacity.siteNights.bookedSiteNights.toLocaleString()}
                  </strong>{" "}
                  site-nights booked
                  <span className="text-[#e8e0d5]/55"> · {capacity.siteNights.bookedPercent}%</span>
                </>
              }
              emptyDetail={
                <>
                  <strong className="text-[#f0d48f] tabular-nums">
                    {capacity.siteNights.availableSiteNights.toLocaleString()}
                  </strong>{" "}
                  site-nights open
                  <span className="text-[#e8e0d5]/55"> · {capacity.siteNights.availablePercent}%</span>
                </>
              }
              footnote={`${capacity.siteNights.rangeNights} nights × ${capacity.totalSites} sites = ${capacity.siteNights.totalSiteNights.toLocaleString()} total site-nights`}
            />
          </div>
        </div>
      ) : (
        <p className="text-sm text-[#e8e0d5]/55 py-4">Choose a camp and date range to view capacity.</p>
      )}
    </section>
  );
}
