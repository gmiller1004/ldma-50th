import { formatCentsAsCurrency } from "@/lib/reservation-pricing";

export type PrintableReceiptInput = {
  campName: string;
  partyName: string;
  memberNumber?: string | null;
  siteName?: string | null;
  checkInDate: string;
  checkOutDate: string;
  nights?: number | null;
  invoiceNumber?: string | null;
  status: string;
  billingPeriods: Array<{
    periodStart: string;
    periodEnd: string;
    nights: number;
    amountDueCents: number;
    amountPaidCents: number;
    status: string;
  }>;
  payments: Array<{ method: string; amountCents: number; paymentType: string; createdAt: string }>;
  totalDueCents: number;
  totalPaidCents: number;
  balanceDueCents: number;
};

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function periodStatusLabel(status: string): string {
  if (status === "paid") return "Paid";
  if (status === "partial") return "Partial";
  if (status === "waived") return "Waived";
  if (status === "cancelled") return "Cancelled";
  return "Unpaid";
}

export function buildReceiptHtml(r: PrintableReceiptInput, printedOn: string): string {
  const row = (label: string, value: string) =>
    `<tr><th>${esc(label)}</th><td>${esc(value)}</td></tr>`;

  const details = [
    row(r.memberNumber ? "Member" : "Guest", r.partyName),
    r.memberNumber ? row("Member #", r.memberNumber) : "",
    row("Site", r.siteName || "—"),
    row("Check-in", r.checkInDate),
    row("Check-out", r.checkOutDate),
    r.nights ? row("Nights", String(r.nights)) : "",
    r.invoiceNumber ? row("Invoice", r.invoiceNumber) : "",
    r.status === "cancelled" ? row("Status", "Cancelled") : "",
  ].join("");

  const periods = r.billingPeriods.length
    ? `<h2>Billing</h2>
      <table class="grid">
        <thead><tr><th>Period</th><th class="num">Due</th><th class="num">Paid</th><th>Status</th></tr></thead>
        <tbody>${r.billingPeriods
          .map(
            (p) =>
              `<tr><td>${esc(p.periodStart)} – ${esc(p.periodEnd)} (${p.nights}n)</td><td class="num">${formatCentsAsCurrency(p.amountDueCents)}</td><td class="num">${formatCentsAsCurrency(p.amountPaidCents)}</td><td>${periodStatusLabel(p.status)}</td></tr>`
          )
          .join("")}</tbody>
      </table>`
    : "";

  const payments = r.payments.length
    ? `<h2>Payments</h2>
      <table class="grid">
        <thead><tr><th>Date</th><th>Method</th><th class="num">Amount</th></tr></thead>
        <tbody>${r.payments
          .map((p) => {
            const isRefund = p.paymentType === "refund";
            const amount = `${isRefund ? "−" : ""}${formatCentsAsCurrency(p.amountCents)}`;
            const method = `${p.method === "card" ? "Card" : p.method === "check" ? "Check" : "Cash"}${isRefund ? " refund" : ""}`;
            return `<tr><td>${esc(p.createdAt.slice(0, 10))}</td><td>${method}</td><td class="num">${amount}</td></tr>`;
          })
          .join("")}</tbody>
      </table>`
    : "";

  const balanceLine =
    r.balanceDueCents > 0
      ? `<tr class="total"><th>Balance due</th><td class="num">${formatCentsAsCurrency(r.balanceDueCents)}</td></tr>`
      : `<tr class="total"><th>Balance due</th><td class="num">Paid in full</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Receipt — ${esc(r.partyName)} — ${esc(r.campName)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #111; margin: 32px; font-size: 14px; }
  header { border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 16px; }
  h1 { margin: 0; font-size: 20px; letter-spacing: 0.04em; }
  header p { margin: 4px 0 0; color: #444; }
  h2 { font-size: 15px; margin: 20px 0 6px; }
  table { border-collapse: collapse; width: 100%; }
  .details th { text-align: left; width: 120px; color: #444; font-weight: 600; padding: 3px 0; vertical-align: top; }
  .details td { padding: 3px 0; }
  .grid th, .grid td { border-bottom: 1px solid #ccc; padding: 5px 4px; text-align: left; }
  .grid thead th { border-bottom: 1.5px solid #111; font-size: 12px; text-transform: uppercase; color: #444; }
  .num { text-align: right !important; white-space: nowrap; }
  .totals { width: 280px; margin-left: auto; margin-top: 16px; }
  .totals th { text-align: left; font-weight: 500; padding: 3px 0; }
  .totals td { padding: 3px 0; }
  .totals .total th, .totals .total td { font-weight: 700; border-top: 1.5px solid #111; padding-top: 6px; }
  footer { margin-top: 32px; color: #555; font-size: 12px; }
  @media print { body { margin: 0.5in; } }
</style>
</head>
<body>
  <header>
    <h1>Lost Dutchman's Mining Association</h1>
    <p>${esc(r.campName)} — Campsite receipt</p>
  </header>
  <table class="details">${details}</table>
  ${periods}
  ${payments}
  <table class="totals">
    <tr><th>Total site fees</th><td class="num">${formatCentsAsCurrency(r.totalDueCents)}</td></tr>
    <tr><th>Total paid</th><td class="num">${formatCentsAsCurrency(r.totalPaidCents)}</td></tr>
    ${balanceLine}
  </table>
  <footer>Printed ${esc(printedOn)} · Questions? Call 888-465-3717</footer>
</body>
</html>`;
}

/** Opens a printable receipt in a new tab and triggers the print dialog. Returns false if the popup was blocked. */
export function printReservationReceipt(input: PrintableReceiptInput): boolean {
  const win = window.open("", "_blank");
  if (!win) return false;
  const printedOn = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  win.document.open();
  win.document.write(buildReceiptHtml(input, printedOn));
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 250);
  return true;
}
