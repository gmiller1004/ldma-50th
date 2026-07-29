/** Client-side filter/sort helpers for caretaker reservation lists. */

export type ReservationListSortKey =
  | "checkIn"
  | "checkOut"
  | "name"
  | "site"
  | "balance";

export type ReservationListFilterKey =
  | "all"
  | "balanceDue"
  | "overdue"
  | "checkedIn"
  | "notCheckedIn"
  | "cancelled"
  | "completed";

export type ReservationListQueryRow = {
  id: string;
  siteName?: string | null;
  checkInDate: string;
  checkOutDate: string;
  reservationType: string;
  memberDisplayName?: string | null;
  memberNumber?: string | null;
  guestFirstName?: string | null;
  guestLastName?: string | null;
  guestEmail?: string | null;
  status: string;
  checkedInAt?: string | null;
  invoiceNumber?: string | null;
  balanceDueCents?: number;
  hasOverdueSiteFee?: boolean;
};

function toDateOnly(dateStr: string): string {
  const part = String(dateStr ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(part) ? part : String(dateStr ?? "");
}

export function reservationPartyLabel(r: ReservationListQueryRow): string {
  if (r.reservationType === "member") {
    return r.memberDisplayName?.trim() || (r.memberNumber ? `#${r.memberNumber}` : "Member");
  }
  const name = [r.guestFirstName, r.guestLastName].filter(Boolean).join(" ").trim();
  return name || "Guest";
}

function searchableText(r: ReservationListQueryRow): string {
  return [
    reservationPartyLabel(r),
    r.memberNumber,
    r.memberDisplayName,
    r.guestFirstName,
    r.guestLastName,
    r.guestEmail,
    r.siteName,
    r.invoiceNumber,
    r.status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesSearch(r: ReservationListQueryRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = searchableText(r);
  return q.split(/\s+/).every((token) => hay.includes(token));
}

function matchesFilter(r: ReservationListQueryRow, filter: ReservationListFilterKey): boolean {
  switch (filter) {
    case "all":
      return true;
    case "balanceDue":
      return (r.balanceDueCents ?? 0) > 0;
    case "overdue":
      return Boolean(r.hasOverdueSiteFee);
    case "checkedIn":
      return Boolean(r.checkedInAt) && r.status !== "cancelled";
    case "notCheckedIn":
      return !r.checkedInAt && r.status !== "cancelled";
    case "cancelled":
      return r.status === "cancelled";
    case "completed":
      return r.status !== "cancelled";
    default:
      return true;
  }
}

function compareReservations(
  a: ReservationListQueryRow,
  b: ReservationListQueryRow,
  sortKey: ReservationListSortKey,
  sortDir: "asc" | "desc"
): number {
  const dir = sortDir === "asc" ? 1 : -1;
  let cmp = 0;
  switch (sortKey) {
    case "checkIn":
      cmp = toDateOnly(a.checkInDate).localeCompare(toDateOnly(b.checkInDate));
      break;
    case "checkOut":
      cmp = toDateOnly(a.checkOutDate).localeCompare(toDateOnly(b.checkOutDate));
      break;
    case "name":
      cmp = reservationPartyLabel(a).localeCompare(reservationPartyLabel(b), undefined, {
        sensitivity: "base",
      });
      break;
    case "site":
      cmp = (a.siteName || "").localeCompare(b.siteName || "", undefined, {
        numeric: true,
        sensitivity: "base",
      });
      break;
    case "balance":
      cmp = (a.balanceDueCents ?? 0) - (b.balanceDueCents ?? 0);
      break;
    default:
      cmp = 0;
  }
  if (cmp !== 0) return cmp * dir;
  return a.id.localeCompare(b.id) * dir;
}

export function filterAndSortReservations<T extends ReservationListQueryRow>(
  rows: T[],
  opts: {
    search: string;
    filter: ReservationListFilterKey;
    sortKey: ReservationListSortKey;
    sortDir: "asc" | "desc";
  }
): T[] {
  return rows
    .filter((r) => matchesSearch(r, opts.search) && matchesFilter(r, opts.filter))
    .sort((a, b) => compareReservations(a, b, opts.sortKey, opts.sortDir));
}
