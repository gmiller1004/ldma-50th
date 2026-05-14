"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Shield, Users, Tent, CalendarRange } from "lucide-react";

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

function rosterName(r: RosterRow): string {
  const parts = [r.firstName, r.lastName].filter(Boolean);
  return parts.length ? parts.join(" ") : r.email || r.customerNumber || r.contactId;
}

export function CaretakerAdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [camps, setCamps] = useState<CampRow[]>([]);
  const [rosterUnmapped, setRosterUnmapped] = useState<RosterRow[]>([]);
  const [filterSlug, setFilterSlug] = useState<string>("");

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

  const filtered = useMemo(() => {
    if (!filterSlug) return camps;
    return camps.filter((c) => c.slug === filterSlug);
  }, [camps, filterSlug]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-[#e8e0d5]/70 py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#d4af37]" />
        Loading caretaker overview…
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
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#d4af37]/25 bg-[#0f0a06]/60 px-4 py-3 text-sm text-[#e8e0d5]/85">
        <Shield className="w-5 h-5 text-[#d4af37] shrink-0" />
        <span>
          Read-only overview for all directory camps. Roster comes from Salesforce (
          <code className="text-[#d4af37]/90">Is_LDMA_Caretaker__c</code> +{" "}
          <code className="text-[#d4af37]/90">Caretaker_At_Camp__c</code>
          ). Check-ins and reservations are from this site&apos;s database.
        </span>
      </div>

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
            onChange={(e) => setFilterSlug(e.target.value)}
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
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr className="bg-[#1a1208]/90 text-[#d4af37]/95 border-b border-[#d4af37]/25">
              <th className="p-3 font-semibold">Camp</th>
              <th className="p-3 font-semibold text-center" title="Member check-ins still on stay">
                <span className="inline-flex items-center gap-1 justify-center">
                  <Users className="w-3.5 h-3.5" /> Active members
                </span>
              </th>
              <th className="p-3 font-semibold text-center">Active guests</th>
              <th className="p-3 font-semibold text-center" title="Last 30 days">
                <span className="inline-flex items-center gap-1 justify-center">
                  <CalendarRange className="w-3.5 h-3.5" /> M chk-in 30d
                </span>
              </th>
              <th className="p-3 font-semibold text-center">G chk-in 30d</th>
              <th className="p-3 font-semibold text-center">Res. active</th>
              <th className="p-3 font-semibold text-center">On property</th>
              <th className="p-3 font-semibold">Assigned caretakers</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr
                key={row.slug}
                className="border-b border-[#d4af37]/10 odd:bg-[#0f0a06]/40 even:bg-[#0a0704]/40"
              >
                <td className="p-3 font-medium text-[#f0d48f]">{row.name}</td>
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
            ))}
          </tbody>
        </table>
      </div>

      {filterSlug && (
        <CaretakerByCampDetail camp={filtered[0]} />
      )}
    </div>
  );
}

function CaretakerByCampDetail({ camp }: { camp: CampRow | undefined }) {
  if (!camp) return null;
  const idToName = new Map(
    camp.assignedCaretakers.map((r) => [r.contactId, rosterName(r)] as const)
  );
  const breakdown = camp.checkInsLast30DaysByCaretaker;
  if (breakdown.length === 0) return null;

  return (
    <div className="rounded-lg border border-[#d4af37]/20 bg-[#0f0a06]/50 p-4">
      <h3 className="text-[#f0d48f] font-serif text-lg mb-2">
        Member check-ins (30d) by caretaker — {camp.name}
      </h3>
      <ul className="text-sm text-[#e8e0d5]/85 space-y-1">
        {breakdown.map((b) => (
          <li key={b.caretakerContactId}>
            <span className="text-[#d4af37]/90">{idToName.get(b.caretakerContactId) ?? b.caretakerContactId}</span>
            {": "}
            <span className="tabular-nums">{b.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
