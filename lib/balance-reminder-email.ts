/**
 * Copy for campsite balance reminder emails (5 days before and on the due date).
 */

export const BALANCE_REMINDER_STAGES = ["five_days", "due_date"] as const;
export type BalanceReminderStage = (typeof BALANCE_REMINDER_STAGES)[number];
export type BalanceReminderKind = "before_arrival" | "billing_period";

export const BALANCE_REMINDER_DAYS_BEFORE: Record<BalanceReminderStage, number> = {
  five_days: 5,
  due_date: 0,
};

const OFFICE_HOURS = "typically 8 a.m. to 5 p.m.";
const SUPPORT_EMAIL = "info@lostdutchmans.com";
const SUPPORT_PHONE = "(888) 465-3717";

export type BalanceReminderEmailInput = {
  campName: string;
  guestOrMemberName: string;
  checkInDate: string;
  checkOutDate: string;
  balanceDueCents: number;
  stage: BalanceReminderStage;
  payBalanceUrl: string;
  reminderKind?: BalanceReminderKind;
  paymentDueDate?: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isoToDate(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`);
}

/** "Saturday, November 14, 2026" */
export function formatReminderLongDate(iso: string): string {
  return isoToDate(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "Nov 14" */
export function formatReminderShortDate(iso: string): string {
  return isoToDate(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function formatDollars(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function buildBalanceReminderEmail(input: BalanceReminderEmailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const kind = input.reminderKind ?? "before_arrival";
  const camp = input.campName;
  const name = input.guestOrMemberName?.trim() || "there";
  const amount = formatDollars(input.balanceDueCents);
  const dueIso = kind === "billing_period" ? input.paymentDueDate ?? input.checkInDate : input.checkInDate;
  const dueLong = formatReminderLongDate(dueIso);
  const dueShort = formatReminderShortDate(dueIso);
  const isDueDate = input.stage === "due_date";

  let subject: string;
  let heading: string;
  let subheading: string;
  let intro: string;
  let amountLabel: string;
  let payNote: string;

  if (kind === "billing_period") {
    subject = isDueDate
      ? `Your ${camp} site payment is due today`
      : `Friendly reminder: your ${camp} site payment is due ${dueShort}`;
    heading = isDueDate ? "Your site payment is due today" : "Your next site payment is coming up";
    subheading = `${camp} · due ${dueLong}`;
    intro = isDueDate
      ? `Just a reminder that your monthly site payment for your stay at ${camp} is due today, ${dueLong}.`
      : `This is a friendly reminder that your next monthly site payment for your stay at ${camp} is due ${dueLong}.`;
    amountLabel = `Amount due ${dueShort}: ${amount}`;
    payNote = `Paying online takes just a minute. You can also pay at the camp office during office hours (${OFFICE_HOURS}).`;
  } else {
    subject = isDueDate
      ? `Your ${camp} stay begins today`
      : `Friendly reminder: your ${camp} stay begins ${dueShort}`;
    heading = isDueDate ? "Welcome — your stay begins today" : "Your stay is coming up";
    subheading = `${camp} · arriving ${dueLong}`;
    intro = isDueDate
      ? `Your stay at ${camp} begins today, ${dueLong}. Your site is ready for you, and there is still a balance on your reservation.`
      : `This is a friendly reminder that your stay at ${camp} begins ${dueLong}. Your site is reserved and waiting for you.`;
    amountLabel = `Remaining balance: ${amount}`;
    payNote = isDueDate
      ? `You can pay online now, or stop by the camp office when you arrive if it's during office hours (${OFFICE_HOURS}).`
      : `Paying ahead online is the quickest way to get settled. You can also pay at the camp office when you arrive, if you arrive during office hours (${OFFICE_HOURS}).`;
  }

  const buttonLabel = kind === "billing_period" ? "Pay online" : "Pay your balance online";
  const alreadyPaid = "Already taken care of this? Thank you, and please disregard this reminder.";
  const signOff = "Thanks for your prompt payment,";

  const text = `${heading}

Hi ${name},

${intro}

${amountLabel}

${buttonLabel}: ${input.payBalanceUrl}

${payNote}

${alreadyPaid}

Questions? Email ${SUPPORT_EMAIL} or call ${SUPPORT_PHONE}.

${signOff}
Lost Dutchman's Mining Association`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#1a120b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#1a120b;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;background:#2a1f14;border-radius:8px;border:1px solid #d4af3740;">
        <tr><td style="padding:28px 24px;text-align:center;border-bottom:1px solid #d4af3720;">
          <h1 style="margin:0;font-size:20px;color:#f0d48f;">${escapeHtml(heading)}</h1>
          <p style="margin:8px 0 0;font-size:14px;color:#e8e0d5b3;">${escapeHtml(subheading)}</p>
        </td></tr>
        <tr><td style="padding:28px 24px;color:#e8e0d5;font-size:16px;line-height:1.55;">
          <p style="margin:0 0 16px;">Hi ${escapeHtml(name)},</p>
          <p style="margin:0 0 16px;">${escapeHtml(intro)}</p>
          <p style="margin:0 0 20px;font-size:18px;color:#f0d48f;"><strong>${escapeHtml(amountLabel)}</strong></p>
          <p style="margin:0 0 20px;"><a href="${escapeHtml(input.payBalanceUrl)}" style="display:inline-block;padding:12px 20px;background:#d4af37;color:#1a120b;text-decoration:none;border-radius:6px;font-weight:600;">${escapeHtml(buttonLabel)}</a></p>
          <p style="margin:0 0 16px;">${escapeHtml(payNote)}</p>
          <p style="margin:0 0 16px;font-size:14px;color:#e8e0d5b3;">${escapeHtml(alreadyPaid)}</p>
          <p style="margin:0 0 16px;font-size:14px;color:#e8e0d5b3;">Questions? Email <a href="mailto:${SUPPORT_EMAIL}" style="color:#d4af37;">${SUPPORT_EMAIL}</a> or call ${SUPPORT_PHONE}.</p>
          <p style="margin:0;">${escapeHtml(signOff)}<br>Lost Dutchman&rsquo;s Mining Association</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

  return { subject, text, html };
}
