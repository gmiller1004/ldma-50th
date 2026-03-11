"use client";

import { useState, useMemo } from "react";
import { format, addDays, parseISO, startOfDay } from "date-fns";

export type CalendarReservation = {
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
  guestPhone: string | null;
  status: string;
  checkedInAt: string | null;
};

export type CalendarSite = {
  id: string;
  name: string;
  siteType: string;
};

type Segment = { type: "empty"; span: number } | { type: "reservation"; reservation: CalendarReservation; span: number };

function toDateOnly(dateStr: string): string {
  return typeof dateStr === "string" ? dateStr.slice(0, 10) : "";
}

/** Build segments for one site row: alternating empty and reservation spans across the visible day range. */
function buildSegments(
  siteId: string,
  reservations: CalendarReservation[],
  rangeStart: Date,
  numDays: number
): Segment[] {
  const siteReservations = reservations
    .filter((r) => r.siteId === siteId)
    .filter((r) => {
      const out = parseISO(toDateOnly(r.checkOutDate));
      const start = rangeStart;
      const end = addDays(rangeStart, numDays);
      return out > start && parseISO(toDateOnly(r.checkInDate)) < end;
    })
    .sort((a, b) => toDateOnly(a.checkInDate).localeCompare(toDateOnly(b.checkInDate)));

  const segments: Segment[] = [];
  let day = 0;

  while (day < numDays) {
    const currentDate = addDays(rangeStart, day);
    const dateStr = format(currentDate, "yyyy-MM-dd");
    const overlapping = siteReservations.find(
      (r) =>
        toDateOnly(r.checkInDate) <= dateStr &&
        toDateOnly(r.checkOutDate) > dateStr
    );

    if (overlapping) {
      const checkOut = parseISO(toDateOnly(overlapping.checkOutDate));
      const lastDay = Math.min(
        numDays - 1,
        Math.floor((checkOut.getTime() - rangeStart.getTime()) / (24 * 60 * 60 * 1000)) - 1
      );
      const span = lastDay - day + 1;
      segments.push({ type: "reservation", reservation: overlapping, span });
      day = lastDay + 1;
    } else {
      let emptyEnd = day + 1;
      while (emptyEnd < numDays) {
        const nextDate = addDays(rangeStart, emptyEnd);
        const nextStr = format(nextDate, "yyyy-MM-dd");
        if (siteReservations.some((r) => toDateOnly(r.checkInDate) <= nextStr && toDateOnly(r.checkOutDate) > nextStr)) break;
        emptyEnd++;
      }
      segments.push({ type: "empty", span: emptyEnd - day });
      day = emptyEnd;
    }
  }

  return segments;
}

export function ReservationCalendarView({
  reservations,
  sites,
  onSelectReservation,
  startDate,
  numDays = 45,
}: {
  reservations: CalendarReservation[];
  sites: CalendarSite[];
  onSelectReservation: (r: CalendarReservation) => void;
  startDate: string;
  numDays?: number;
}) {
  const [hoveredReservation, setHoveredReservation] = useState<CalendarReservation | null>(null);
  const [tooltipAnchor, setTooltipAnchor] = useState<{ x: number; y: number } | null>(null);

  const rangeStart = useMemo(() => startOfDay(parseISO(startDate)), [startDate]);
  const dayColumns = useMemo(() => {
    const cols: { dateStr: string; day: number; month: string; isFirstOfMonth: boolean }[] = [];
    let lastMonth = "";
    for (let i = 0; i < numDays; i++) {
      const d = addDays(rangeStart, i);
      const dateStr = format(d, "yyyy-MM-dd");
      const month = format(d, "MMMM");
      const isFirstOfMonth = month !== lastMonth;
      lastMonth = month;
      cols.push({ dateStr, day: d.getDate(), month, isFirstOfMonth });
    }
    return cols;
  }, [rangeStart, numDays]);

  const handleBarMouseEnter = (e: React.MouseEvent, r: CalendarReservation) => {
    setHoveredReservation(r);
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setTooltipAnchor({ x: rect.left + rect.width / 2, y: rect.top });
  };

  const handleBarMouseLeave = () => {
    setHoveredReservation(null);
    setTooltipAnchor(null);
  };

  const displayName = (r: CalendarReservation) =>
    r.reservationType === "member"
      ? r.memberDisplayName || `#${r.memberNumber}`
      : [r.guestFirstName, r.guestLastName].filter(Boolean).join(" ") || "Guest";

  return (
    <div className="overflow-x-auto rounded-lg border border-[#d4af37]/20 bg-[#0f0a06]/40">
      <table className="w-full border-collapse text-sm min-w-[800px]">
        <thead>
          <tr className="border-b border-[#d4af37]/20">
            <th className="sticky left-0 z-10 w-48 min-w-[12rem] bg-[#1a120b] p-2 text-left font-semibold text-[#f0d48f] border-r border-[#d4af37]/20">
              Site
            </th>
            {dayColumns.map((col, i) => (
              <th
                key={col.dateStr}
                className="w-9 min-w-[2.25rem] bg-[#1a120b]/90 p-1 text-center border-r border-[#d4af37]/10 last:border-r-0"
              >
                {col.isFirstOfMonth ? (
                  <span className="block text-[10px] font-medium text-[#d4af37]/80 uppercase tracking-wide">{col.month.slice(0, 3)}</span>
                ) : null}
                <span className="text-[#e8e0d5] font-medium">{col.day}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sites.map((site) => {
            const segments = buildSegments(site.id, reservations, rangeStart, numDays);
            return (
              <tr key={site.id} className="border-b border-[#d4af37]/10 hover:bg-[#1a120b]/50">
                <td className="sticky left-0 z-10 bg-[#1a120b] p-2 border-r border-[#d4af37]/20">
                  <span className="font-medium text-[#e8e0d5]">{site.name}</span>
                  <span className="block text-xs text-[#e8e0d5]/60">{site.siteType}</span>
                </td>
                {segments.map((seg, idx) => {
                  if (seg.type === "empty") {
                    return (
                      <td key={`${site.id}-empty-${idx}`} colSpan={seg.span} className="p-0.5 align-top border-r border-[#d4af37]/10 last:border-r-0">
                        <div className="h-7 min-w-[2rem]" />
                      </td>
                    );
                  }
                  const r = seg.reservation;
                  const name = displayName(r);
                  return (
                    <td key={`${site.id}-${r.id}`} colSpan={seg.span} className="p-0.5 align-top border-r border-[#d4af37]/10 last:border-r-0">
                      <div
                        className="h-7 min-h-[1.75rem] px-2 flex items-center rounded bg-[#0f3d1e]/80 border border-[#6dd472]/40 cursor-pointer hover:bg-[#0f3d1e] hover:border-[#6dd472]/60 transition-colors"
                        onMouseEnter={(e) => handleBarMouseEnter(e, r)}
                        onMouseLeave={handleBarMouseLeave}
                        onClick={() => onSelectReservation(r)}
                        title={`${name} — ${r.checkInDate} to ${r.checkOutDate} (${r.nights} nights). Click for details.`}
                      >
                        <span className="truncate text-xs font-medium text-[#b8e8bc]">{name}</span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      {hoveredReservation && tooltipAnchor && (
        <div
          className="fixed z-50 pointer-events-none rounded-lg border border-[#d4af37]/40 bg-[#1a120b] shadow-xl p-3 max-w-xs"
          style={{
            left: tooltipAnchor.x,
            top: tooltipAnchor.y - 4,
            transform: "translate(-50%, -100%)",
          }}
        >
          <p className="font-semibold text-[#f0d48f]">{displayName(hoveredReservation)}</p>
          <p className="text-xs text-[#e8e0d5]/80 mt-0.5">#{hoveredReservation.id.slice(0, 8)}</p>
          {hoveredReservation.guestPhone || (hoveredReservation.reservationType === "member" && null) ? (
            <p className="text-xs text-[#e8e0d5]/70 mt-1">
              {hoveredReservation.guestPhone ? `Phone: ${hoveredReservation.guestPhone}` : ""}
            </p>
          ) : null}
          <p className="text-xs text-[#e8e0d5]/70 mt-1">{hoveredReservation.siteName ?? "Site"}</p>
          <p className="text-xs text-[#e8e0d5]/70">
            {hoveredReservation.checkInDate} – {hoveredReservation.checkOutDate} ({hoveredReservation.nights} nights)
          </p>
          {hoveredReservation.checkedInAt ? (
            <p className="text-xs text-[#6dd472] mt-1">Checked in</p>
          ) : null}
          <p className="text-[10px] text-[#e8e0d5]/50 mt-2">Click for details</p>
        </div>
      )}
    </div>
  );
}
