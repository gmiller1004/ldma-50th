"use client";

import { Search } from "lucide-react";
import type {
  ReservationListFilterKey,
  ReservationListSortKey,
} from "@/lib/caretaker-reservation-list-query";

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  filter: ReservationListFilterKey;
  onFilterChange: (value: ReservationListFilterKey) => void;
  sortKey: ReservationListSortKey;
  onSortKeyChange: (value: ReservationListSortKey) => void;
  sortDir: "asc" | "desc";
  onSortDirChange: (value: "asc" | "desc") => void;
  /** Which filter options to show. */
  filterMode?: "active" | "archived" | "admin";
  resultCount: number;
  totalCount: number;
  searchPlaceholder?: string;
};

const ACTIVE_FILTERS: { value: ReservationListFilterKey; label: string }[] = [
  { value: "all", label: "All" },
  { value: "balanceDue", label: "Balance due" },
  { value: "overdue", label: "Overdue" },
  { value: "checkedIn", label: "Checked in" },
  { value: "notCheckedIn", label: "Not checked in" },
];

const ARCHIVED_FILTERS: { value: ReservationListFilterKey; label: string }[] = [
  { value: "all", label: "All" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const ADMIN_FILTERS: { value: ReservationListFilterKey; label: string }[] = [
  { value: "all", label: "All" },
  { value: "balanceDue", label: "Balance due" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" },
];

export function ReservationListToolbar({
  search,
  onSearchChange,
  filter,
  onFilterChange,
  sortKey,
  onSortKeyChange,
  sortDir,
  onSortDirChange,
  filterMode = "active",
  resultCount,
  totalCount,
  searchPlaceholder = "Search by name, member #, site…",
}: Props) {
  const filters =
    filterMode === "archived"
      ? ARCHIVED_FILTERS
      : filterMode === "admin"
        ? ADMIN_FILTERS
        : ACTIVE_FILTERS;

  return (
    <div className="mb-3 space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <label className="relative flex min-w-[220px] flex-1 flex-col gap-1 text-sm text-[#e8e0d5]/70">
          <span className="flex items-center gap-1.5">
            <Search className="h-3.5 w-3.5 text-[#d4af37]" />
            Find reservation
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="rounded border border-[#d4af37]/30 bg-[#0f0a06] px-3 py-2 text-[#e8e0d5] placeholder:text-[#e8e0d5]/40"
            autoComplete="off"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-[#e8e0d5]/70">
          Filter
          <select
            value={filter}
            onChange={(e) => onFilterChange(e.target.value as ReservationListFilterKey)}
            className="min-w-[160px] rounded border border-[#d4af37]/30 bg-[#0f0a06] px-3 py-2 text-[#e8e0d5]"
          >
            {filters.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-[#e8e0d5]/70">
          Sort by
          <select
            value={sortKey}
            onChange={(e) => onSortKeyChange(e.target.value as ReservationListSortKey)}
            className="min-w-[150px] rounded border border-[#d4af37]/30 bg-[#0f0a06] px-3 py-2 text-[#e8e0d5]"
          >
            <option value="checkIn">Check-in date</option>
            <option value="checkOut">Check-out date</option>
            <option value="name">Guest / member name</option>
            <option value="site">Site</option>
            <option value="balance">Balance due</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-[#e8e0d5]/70">
          Order
          <select
            value={sortDir}
            onChange={(e) => onSortDirChange(e.target.value as "asc" | "desc")}
            className="min-w-[130px] rounded border border-[#d4af37]/30 bg-[#0f0a06] px-3 py-2 text-[#e8e0d5]"
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </label>
      </div>
      <p className="text-xs text-[#e8e0d5]/50">
        Showing {resultCount}
        {resultCount !== totalCount ? ` of ${totalCount}` : ""} reservation
        {resultCount === 1 ? "" : "s"}
      </p>
    </div>
  );
}
