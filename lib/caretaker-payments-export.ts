import { getCampBySlug } from "@/lib/directory-camps";

export const PAYMENT_EXPORT_HEADERS = [
  "PAYMENT DATE",
  "PAYOR'S NAME",
  "PAYMENT TYPE",
  "PAYMENT AMOUNT",
  "CAMP NAME",
  "DESCRIPTION",
] as const;

export type PaymentExportRow = {
  paymentDate: string;
  payorName: string;
  paymentType: string;
  amountCents: number;
  campSlug: string;
  description: string;
};

type PaymentDbRow = {
  created_at: string;
  recipient_display_name: string;
  method: string;
  payment_type: string;
  amount_cents: number;
  camp_slug: string;
  maintenance_amount_cents: number | null;
  membership_amount_cents: number | null;
  invoice_number: string | null;
  site_name: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
  nights: number | null;
};

type CompDbRow = {
  created_at: string;
  camp_slug: string;
  reservation_type: string;
  member_display_name: string | null;
  guest_first_name: string | null;
  guest_last_name: string | null;
  override_reason: string | null;
  invoice_number: string | null;
  site_name: string | null;
  check_in_date: string;
  check_out_date: string;
  nights: number;
};

export function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function formatPaymentDate(createdAt: string): string {
  return String(createdAt).slice(0, 10);
}

export function formatPaymentTypeLabel(method: string, paymentType: string): string {
  if (paymentType === "refund") {
    if (method === "card") return "Credit Card Refund";
    if (method === "cash") return "Cash Refund";
    return "Refund";
  }
  if (method === "card") return "Credit Card";
  if (method === "cash") return "Cash";
  return method;
}

function formatStayDates(checkIn: string | null, checkOut: string | null): string | null {
  if (!checkIn || !checkOut) return null;
  const inDate = String(checkIn).slice(0, 10);
  const outDate = String(checkOut).slice(0, 10);
  return `${inDate} – ${outDate}`;
}

function formatReservationDescription(row: PaymentDbRow): string {
  const parts: string[] = [];
  if (row.site_name) parts.push(`Site ${row.site_name}`);
  if (row.nights != null && row.nights > 0) {
    parts.push(`${row.nights} night${row.nights === 1 ? "" : "s"}`);
  }
  const dates = formatStayDates(row.check_in_date, row.check_out_date);
  if (dates) parts.push(dates);
  if (row.invoice_number) parts.push(`Invoice ${row.invoice_number}`);
  if (parts.length === 0) return "Camp reservation";
  return parts.join(" · ");
}

function formatPastDueDescription(row: PaymentDbRow): string {
  const parts: string[] = [];
  if (row.maintenance_amount_cents && row.maintenance_amount_cents > 0) {
    parts.push("Maintenance");
  }
  if (row.membership_amount_cents && row.membership_amount_cents > 0) {
    parts.push("Membership");
  }
  if (parts.length === 0) return "Past due";
  return parts.join(" + ");
}

export function formatPaymentDescription(row: PaymentDbRow): string {
  if (row.payment_type === "refund") {
    const stay = formatReservationDescription(row);
    return stay ? `Cancellation refund · ${stay}` : "Cancellation refund";
  }
  if (row.payment_type === "past_due") return formatPastDueDescription(row);
  return formatReservationDescription(row);
}

export function paymentDbRowToExport(row: PaymentDbRow): PaymentExportRow {
  const signedAmount =
    row.payment_type === "refund" ? -Math.abs(row.amount_cents) : row.amount_cents;
  return {
    paymentDate: formatPaymentDate(row.created_at),
    payorName: row.recipient_display_name?.trim() || "—",
    paymentType: formatPaymentTypeLabel(row.method, row.payment_type),
    amountCents: signedAmount,
    campSlug: row.camp_slug,
    description: formatPaymentDescription(row),
  };
}

function compPayorName(row: CompDbRow): string {
  if (row.reservation_type === "member") {
    return row.member_display_name?.trim() || "Member";
  }
  const guest = [row.guest_first_name, row.guest_last_name].filter(Boolean).join(" ").trim();
  return guest || "Guest";
}

export function compDbRowToExport(row: CompDbRow): PaymentExportRow {
  const parts: string[] = ["Comp stay"];
  if (row.site_name) parts.push(`Site ${row.site_name}`);
  if (row.nights > 0) parts.push(`${row.nights} night${row.nights === 1 ? "" : "s"}`);
  const dates = formatStayDates(row.check_in_date, row.check_out_date);
  if (dates) parts.push(dates);
  if (row.invoice_number) parts.push(`Invoice ${row.invoice_number}`);
  const reason = row.override_reason?.trim();
  if (reason) parts.push(reason);

  return {
    paymentDate: formatPaymentDate(row.created_at),
    payorName: compPayorName(row),
    paymentType: "Comp",
    amountCents: 0,
    campSlug: row.camp_slug,
    description: parts.join(" · "),
  };
}

export function formatAmountDollars(amountCents: number): string {
  return (amountCents / 100).toFixed(2);
}

export function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function paymentExportRowToCsvCells(row: PaymentExportRow): string[] {
  const campName = getCampBySlug(row.campSlug)?.name ?? row.campSlug;
  return [
    row.paymentDate,
    row.payorName,
    row.paymentType,
    formatAmountDollars(row.amountCents),
    campName,
    row.description,
  ];
}

export function buildPaymentsCsv(rows: PaymentExportRow[]): string {
  const lines = [PAYMENT_EXPORT_HEADERS.join(",")];
  for (const row of rows) {
    lines.push(paymentExportRowToCsvCells(row).map(escapeCsvField).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function sortPaymentExportRows(a: PaymentExportRow, b: PaymentExportRow): number {
  const dateCmp = a.paymentDate.localeCompare(b.paymentDate);
  if (dateCmp !== 0) return dateCmp;
  const campCmp = a.campSlug.localeCompare(b.campSlug);
  if (campCmp !== 0) return campCmp;
  return a.payorName.localeCompare(b.payorName);
}
