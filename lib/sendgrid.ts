import sgMail from "@sendgrid/mail";

const SENDER_EMAIL = process.env.SENDGRID_FROM_EMAIL || "noreply@example.com";
const SENDER_NAME = process.env.SENDGRID_FROM_NAME || "LDMA";

export async function sendLoginCode(email: string, code: string): Promise<boolean> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.log(`[DEV] Login code for ${email}: ${code}`);
      return true; // Allow dev without SendGrid
    }
    console.warn("SENDGRID_API_KEY not set; skipping email");
    return false;
  }

  sgMail.setApiKey(apiKey);

  const textContent = `Your LDMA member login code is: ${code}

This code expires in 10 minutes. Enter it on the sign-in page to access your member account.

If you didn't request this code, you can safely ignore this email.`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #1a120b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #1a120b; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #2a1f14; border-radius: 8px; border: 1px solid #d4af3740; overflow: hidden;">
          <tr>
            <td style="padding: 32px 24px; text-align: center; border-bottom: 1px solid #d4af3720;">
              <h1 style="margin: 0; font-size: 20px; font-weight: 600; color: #f0d48f; letter-spacing: 0.05em;">LDMA</h1>
              <p style="margin: 8px 0 0; font-size: 14px; color: #e8e0d5b3;">50 Years of Gold, Discovery, and Adventure</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 24px;">
              <p style="margin: 0 0 16px; font-size: 16px; color: #e8e0d5; line-height: 1.5;">Your member login code is:</p>
              <p style="margin: 0 0 24px; font-size: 36px; font-weight: 700; letter-spacing: 0.25em; color: #d4af37; font-variant-numeric: tabular-nums;">${code}</p>
              <p style="margin: 0 0 24px; font-size: 14px; color: #e8e0d5b3; line-height: 1.5;">Enter this code on the sign-in page to access your member account. The code expires in <strong>10 minutes</strong>.</p>
              <p style="margin: 0; font-size: 13px; color: #e8e0d580; line-height: 1.5;">If you didn't request this code, you can safely ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 24px; background-color: #1a120b; border-top: 1px solid #d4af3720;">
              <p style="margin: 0; font-size: 12px; color: #e8e0d560;">Lost Dutchman's Mining Association &bull; 1976–2026</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

  try {
    await sgMail.send({
      to: email,
      from: { email: SENDER_EMAIL, name: SENDER_NAME },
      subject: "Your LDMA member login code",
      text: textContent,
      html: htmlContent,
    });
    return true;
  } catch (e) {
    console.error("SendGrid error:", e);
    return false;
  }
}

import type { DigestActivity } from "./digest";

export async function sendCommentDigestEmail(
  email: string,
  firstName: string | undefined,
  activities: DigestActivity[],
  baseUrl: string
): Promise<boolean> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.log(`[DEV] Comment digest for ${email}:`, activities.length, "discussions");
      return true;
    }
    console.warn("SENDGRID_API_KEY not set; skipping digest email");
    return false;
  }

  sgMail.setApiKey(apiKey);

  const name = firstName || "there";
  const totalComments = activities.reduce((sum, a) => sum + a.comments.length, 0);

  const itemsHtml = activities
    .map(
      (a) => `
    <tr>
      <td style="padding: 16px 24px; border-bottom: 1px solid #d4af3720;">
        <p style="margin: 0 0 8px; font-size: 16px; font-weight: 600; color: #f0d48f;">
          <a href="${baseUrl}/directory/${a.campSlug}/d/${a.discussionId}" style="color: #f0d48f; text-decoration: none;">${escapeHtml(a.discussionTitle)}</a>
        </p>
        <p style="margin: 0 0 8px; font-size: 12px; color: #e8e0d5b3;">${a.campSlug.replace(/-/g, " ")} camp</p>
        ${a.comments
          .map(
            (c) => `
        <div style="margin: 12px 0; padding: 12px; background: #1a120b; border-radius: 6px; border-left: 3px solid #d4af37;">
          <p style="margin: 0 0 4px; font-size: 12px; color: #d4af37;">${escapeHtml(c.authorDisplayName)}</p>
          <p style="margin: 0; font-size: 14px; color: #e8e0d5; line-height: 1.5;">${escapeHtml(c.body.slice(0, 200))}${c.body.length > 200 ? "…" : ""}</p>
        </div>
        `
          )
          .join("")}
        <p style="margin: 8px 0 0;">
          <a href="${baseUrl}/directory/${a.campSlug}/d/${a.discussionId}" style="color: #d4af37; font-size: 14px; text-decoration: underline;">View and reply →</a>
        </p>
      </td>
    </tr>
  `
    )
    .join("");

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #1a120b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #1a120b; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #2a1f14; border-radius: 8px; border: 1px solid #d4af3740; overflow: hidden;">
          <tr>
            <td style="padding: 32px 24px; text-align: center; border-bottom: 1px solid #d4af3720;">
              <h1 style="margin: 0; font-size: 20px; font-weight: 600; color: #f0d48f;">LDMA</h1>
              <p style="margin: 8px 0 0; font-size: 14px; color: #e8e0d5b3;">Daily comment recap</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px;">
              <p style="margin: 0 0 16px; font-size: 16px; color: #e8e0d5; line-height: 1.5;">Hi ${escapeHtml(name)},</p>
              <p style="margin: 0 0 24px; font-size: 16px; color: #e8e0d5; line-height: 1.5;">You have <strong>${totalComments}</strong> new ${totalComments === 1 ? "comment" : "comments"} on ${activities.length} of your ${activities.length === 1 ? "post" : "posts"} today.</p>
            </td>
          </tr>
          ${itemsHtml}
          <tr>
            <td style="padding: 16px 24px; background-color: #1a120b; border-top: 1px solid #d4af3720;">
              <p style="margin: 0; font-size: 12px; color: #e8e0d560;">You're receiving this because you opted in to comment notifications. Adjust in your <a href="${baseUrl}/members/profile" style="color: #d4af37;">profile settings</a>.</p>
              <p style="margin: 8px 0 0; font-size: 12px; color: #e8e0d560;">Lost Dutchman's Mining Association &bull; 1976–2026</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

  const textParts = activities.flatMap((a) =>
    a.comments.map(
      (c) =>
        `"${a.discussionTitle}" (${a.campSlug}): ${c.authorDisplayName} - ${c.body.slice(0, 100)}…\n${baseUrl}/directory/${a.campSlug}/d/${a.discussionId}`
    )
  );
  const textContent = `Hi ${name},\n\nYou have ${totalComments} new comment(s) on your posts.\n\n${textParts.join("\n\n")}\n\nView your profile: ${baseUrl}/members/profile`;

  try {
    await sgMail.send({
      to: email,
      from: { email: SENDER_EMAIL, name: SENDER_NAME },
      subject: `Your LDMA posts have ${totalComments} new ${totalComments === 1 ? "comment" : "comments"}`,
      text: textContent,
      html: htmlContent,
    });
    return true;
  } catch (e) {
    console.error("SendGrid digest error:", e);
    return false;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Send welcome email when a member is checked in at a caretaker camp.
 */
export async function sendCaretakerCheckInWelcomeEmail(
  to: string,
  campName: string,
  memberDisplayName: string,
  checkInDate: string,
  checkOutDate: string
): Promise<boolean> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.log(`[DEV] Caretaker welcome email for ${to}: ${campName}, ${checkInDate}–${checkOutDate}`);
      return true;
    }
    console.warn("SENDGRID_API_KEY not set; skipping caretaker welcome email");
    return false;
  }

  sgMail.setApiKey(apiKey);

  const name = memberDisplayName || "there";
  const textContent = `Welcome to ${campName}!

Hi ${name},

We have you joining us from ${checkInDate} to ${checkOutDate}. If you need anything during your stay, please stop by the caretaker or camp office—we're here to help.

We're excited to have you. Enjoy your time at camp!

Lost Dutchman's Mining Association`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #1a120b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #1a120b; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #2a1f14; border-radius: 8px; border: 1px solid #d4af3740; overflow: hidden;">
          <tr>
            <td style="padding: 32px 24px; text-align: center; border-bottom: 1px solid #d4af3720;">
              <h1 style="margin: 0; font-size: 20px; font-weight: 600; color: #f0d48f; letter-spacing: 0.05em;">LDMA</h1>
              <p style="margin: 8px 0 0; font-size: 14px; color: #e8e0d5b3;">Welcome to ${escapeHtml(campName)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 24px;">
              <p style="margin: 0 0 16px; font-size: 16px; color: #e8e0d5; line-height: 1.5;">Hi ${escapeHtml(name)},</p>
              <p style="margin: 0 0 24px; font-size: 16px; color: #e8e0d5; line-height: 1.5;">We have you joining us from <strong>${escapeHtml(checkInDate)}</strong> to <strong>${escapeHtml(checkOutDate)}</strong>. If you need anything during your stay, please stop by the caretaker or camp office—we're here to help.</p>
              <p style="margin: 0; font-size: 16px; color: #e8e0d5; line-height: 1.5;">We're excited to have you. Enjoy your time at camp!</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 24px; background-color: #1a120b; border-top: 1px solid #d4af3720;">
              <p style="margin: 0; font-size: 12px; color: #e8e0d560;">Lost Dutchman's Mining Association &bull; 1976–2026</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

  try {
    await sgMail.send({
      to,
      from: { email: SENDER_EMAIL, name: SENDER_NAME },
      subject: `Welcome to ${campName} — see you soon!`,
      text: textContent,
      html: htmlContent,
    });
    return true;
  } catch (e) {
    console.error("SendGrid caretaker welcome email error:", e);
    return false;
  }
}

/**
 * Send welcome email when a guest (non-member) is checked in at a caretaker camp.
 * Includes CTA to /memberships for membership exploration.
 */
export async function sendCaretakerGuestCheckInWelcomeEmail(
  to: string,
  campName: string,
  guestFirstName: string,
  checkInDate: string,
  checkOutDate: string,
  baseUrl: string
): Promise<boolean> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.log(`[DEV] Caretaker guest welcome email for ${to}: ${campName}, ${checkInDate}–${checkOutDate}`);
      return true;
    }
    console.warn("SENDGRID_API_KEY not set; skipping caretaker guest welcome email");
    return false;
  }

  sgMail.setApiKey(apiKey);

  const name = guestFirstName?.trim() || "there";
  const membershipsUrl = `${baseUrl.replace(/\/$/, "")}/memberships`;

  const textContent = `Welcome to ${campName}!

Hi ${name},

You're checked in as our guest from ${checkInDate} to ${checkOutDate}. If you need anything during your stay, please stop by the caretaker or camp office—we're here to help.

Save on site fees and access LDMA exclusive claims. Explore LDMA membership: ${membershipsUrl}

We're glad you're here. Enjoy your time at camp!

Lost Dutchman's Mining Association`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #1a120b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #1a120b; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #2a1f14; border-radius: 8px; border: 1px solid #d4af3740; overflow: hidden;">
          <tr>
            <td style="padding: 32px 24px; text-align: center; border-bottom: 1px solid #d4af3720;">
              <h1 style="margin: 0; font-size: 20px; font-weight: 600; color: #f0d48f; letter-spacing: 0.05em;">LDMA</h1>
              <p style="margin: 8px 0 0; font-size: 14px; color: #e8e0d5b3;">Welcome to ${escapeHtml(campName)} — you're our guest</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 24px;">
              <p style="margin: 0 0 16px; font-size: 16px; color: #e8e0d5; line-height: 1.5;">Hi ${escapeHtml(name)},</p>
              <p style="margin: 0 0 16px; font-size: 16px; color: #e8e0d5; line-height: 1.5;">You're checked in as our guest from <strong>${escapeHtml(checkInDate)}</strong> to <strong>${escapeHtml(checkOutDate)}</strong>. If you need anything during your stay, please stop by the caretaker or camp office—we're here to help.</p>
              <p style="margin: 0 0 24px; font-size: 16px; color: #e8e0d5; line-height: 1.5;">Save on site fees and access LDMA exclusive claims. Explore LDMA membership:</p>
              <p style="margin: 0 0 24px; text-align: center;">
                <a href="${escapeHtml(membershipsUrl)}" style="display: inline-block; padding: 14px 24px; background-color: #d4af37; color: #1a120b; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 8px;">Explore LDMA Membership</a>
              </p>
              <p style="margin: 0; font-size: 16px; color: #e8e0d5; line-height: 1.5;">We're glad you're here. Enjoy your time at camp!</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 24px; background-color: #1a120b; border-top: 1px solid #d4af3720;">
              <p style="margin: 0; font-size: 12px; color: #e8e0d560;">Lost Dutchman's Mining Association &bull; 1976–2026</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

  try {
    await sgMail.send({
      to,
      from: { email: SENDER_EMAIL, name: SENDER_NAME },
      subject: `Welcome to ${campName} — you're checked in as our guest`,
      text: textContent,
      html: htmlContent,
    });
    return true;
  } catch (e) {
    console.error("SendGrid caretaker guest welcome email error:", e);
    return false;
  }
}

/**
 * Send confirmation email when a site reservation is created (member or guest).
 */
export async function sendReservationConfirmationEmail(
  to: string,
  campName: string,
  siteName: string,
  checkInDate: string,
  checkOutDate: string,
  guestOrMemberName: string
): Promise<boolean> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.log(`[DEV] Reservation confirmation for ${to}: ${siteName}, ${checkInDate}–${checkOutDate}`);
      return true;
    }
    console.warn("SENDGRID_API_KEY not set; skipping reservation confirmation email");
    return false;
  }

  sgMail.setApiKey(apiKey);

  const name = guestOrMemberName?.trim() || "there";
  const textContent = `Your reservation at ${campName} is confirmed.

Hi ${name},

You're reserved at ${siteName} from ${checkInDate} to ${checkOutDate}. We look forward to seeing you.

If you need to change or cancel your reservation, please contact the camp caretaker.

Lost Dutchman's Mining Association`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #1a120b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #1a120b; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #2a1f14; border-radius: 8px; border: 1px solid #d4af3740; overflow: hidden;">
          <tr>
            <td style="padding: 32px 24px; text-align: center; border-bottom: 1px solid #d4af3720;">
              <h1 style="margin: 0; font-size: 20px; font-weight: 600; color: #f0d48f; letter-spacing: 0.05em;">LDMA</h1>
              <p style="margin: 8px 0 0; font-size: 14px; color: #e8e0d5b3;">Reservation confirmed — ${escapeHtml(campName)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 24px;">
              <p style="margin: 0 0 16px; font-size: 16px; color: #e8e0d5; line-height: 1.5;">Hi ${escapeHtml(name)},</p>
              <p style="margin: 0 0 24px; font-size: 16px; color: #e8e0d5; line-height: 1.5;">You're reserved at <strong>${escapeHtml(siteName)}</strong> from <strong>${escapeHtml(checkInDate)}</strong> to <strong>${escapeHtml(checkOutDate)}</strong>. We look forward to seeing you.</p>
              <p style="margin: 0; font-size: 14px; color: #e8e0d5b3; line-height: 1.5;">If you need to change or cancel your reservation, please contact the camp caretaker.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 24px; background-color: #1a120b; border-top: 1px solid #d4af3720;">
              <p style="margin: 0; font-size: 12px; color: #e8e0d560;">Lost Dutchman's Mining Association &bull; 1976–2026</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

  try {
    await sgMail.send({
      to,
      from: { email: SENDER_EMAIL, name: SENDER_NAME },
      subject: `Reservation confirmed — ${siteName} at ${campName}`,
      text: textContent,
      html: htmlContent,
    });
    return true;
  } catch (e) {
    console.error("SendGrid reservation confirmation error:", e);
    return false;
  }
}

const RECEIPT_CC_EMAIL = "gricci@goldprospectors.org";

export type PaymentReceiptLineItem = {
  label: string;
  amountCents: number;
};

/**
 * Send a single payment receipt to the member and CC gricci@goldprospectors.org.
 */
export async function sendPaymentReceiptEmail(
  to: string,
  campName: string,
  lineItems: PaymentReceiptLineItem[],
  totalCents: number,
  method: "cash" | "card",
  paymentDate: string
): Promise<boolean> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.log(`[DEV] Payment receipt for ${to}: ${(totalCents / 100).toFixed(2)} ${method}`);
      return true;
    }
    console.warn("SENDGRID_API_KEY not set; skipping payment receipt email");
    return false;
  }

  sgMail.setApiKey(apiKey);

  const totalDollars = (totalCents / 100).toFixed(2);
  const methodLabel = method === "card" ? "Card" : "Cash";
  const linesText = lineItems.map((l) => `${l.label}: $${(l.amountCents / 100).toFixed(2)}`).join("\n");
  const textContent = `Payment receipt — ${campName}

Thank you for your payment.

${linesText}
Total: $${totalDollars}
Payment method: ${methodLabel}
Date: ${paymentDate}

Lost Dutchman's Mining Association`;

  const linesHtml = lineItems
    .map(
      (l) =>
        `<tr><td style="padding: 8px 0; color: #e8e0d5;">${escapeHtml(l.label)}</td><td style="text-align: right; padding: 8px 0; color: #e8e0d5;">$${(l.amountCents / 100).toFixed(2)}</td></tr>`
    )
    .join("");

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #1a120b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #1a120b; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #2a1f14; border-radius: 8px; border: 1px solid #d4af3740; overflow: hidden;">
          <tr>
            <td style="padding: 32px 24px; text-align: center; border-bottom: 1px solid #d4af3720;">
              <h1 style="margin: 0; font-size: 20px; font-weight: 600; color: #f0d48f; letter-spacing: 0.05em;">LDMA</h1>
              <p style="margin: 8px 0 0; font-size: 14px; color: #e8e0d5b3;">Payment receipt — ${escapeHtml(campName)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 24px;">
              <p style="margin: 0 0 16px; font-size: 16px; color: #e8e0d5; line-height: 1.5;">Thank you for your payment.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 16px;">
                ${linesHtml}
              </table>
              <p style="margin: 0 0 8px; font-size: 16px; color: #e8e0d5;"><strong>Total: $${totalDollars}</strong></p>
              <p style="margin: 0 0 4px; font-size: 14px; color: #e8e0d5b3;">Payment method: ${escapeHtml(methodLabel)}</p>
              <p style="margin: 0; font-size: 14px; color: #e8e0d5b3;">Date: ${escapeHtml(paymentDate)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 24px; background-color: #1a120b; border-top: 1px solid #d4af3720;">
              <p style="margin: 0; font-size: 12px; color: #e8e0d560;">Lost Dutchman's Mining Association &bull; 1976–2026</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

  try {
    await sgMail.send({
      to,
      cc: RECEIPT_CC_EMAIL,
      from: { email: SENDER_EMAIL, name: SENDER_NAME },
      subject: `Payment receipt — ${campName}`,
      text: textContent,
      html: htmlContent,
    });
    return true;
  } catch (e) {
    console.error("SendGrid payment receipt error:", e);
    return false;
  }
}

/**
 * Send email when a reservation is modified (dates changed).
 */
export async function sendReservationModifiedEmail(
  to: string,
  campName: string,
  siteName: string,
  checkInDate: string,
  checkOutDate: string,
  guestOrMemberName: string
): Promise<boolean> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.log(`[DEV] Reservation modified for ${to}: ${siteName}, ${checkInDate}–${checkOutDate}`);
      return true;
    }
    console.warn("SENDGRID_API_KEY not set; skipping reservation modified email");
    return false;
  }

  sgMail.setApiKey(apiKey);

  const name = guestOrMemberName?.trim() || "there";
  const textContent = `Your reservation at ${campName} has been updated.

Hi ${name},

Your reservation at ${siteName} has been modified. Updated dates:

Check-in:  ${checkInDate}
Check-out: ${checkOutDate}

If you have questions, please contact the camp caretaker.

Lost Dutchman's Mining Association`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #1a120b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #1a120b; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #2a1f14; border-radius: 8px; border: 1px solid #d4af3740; overflow: hidden;">
          <tr>
            <td style="padding: 32px 24px; text-align: center; border-bottom: 1px solid #d4af3720;">
              <h1 style="margin: 0; font-size: 20px; font-weight: 600; color: #f0d48f; letter-spacing: 0.05em;">LDMA</h1>
              <p style="margin: 8px 0 0; font-size: 14px; color: #e8e0d5b3;">Reservation updated — ${escapeHtml(campName)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 24px;">
              <p style="margin: 0 0 16px; font-size: 16px; color: #e8e0d5; line-height: 1.5;">Hi ${escapeHtml(name)},</p>
              <p style="margin: 0 0 24px; font-size: 16px; color: #e8e0d5; line-height: 1.5;">Your reservation at <strong>${escapeHtml(siteName)}</strong> has been updated. New dates:</p>
              <p style="margin: 0 0 8px; font-size: 16px; color: #e8e0d5;">Check-in: <strong>${escapeHtml(checkInDate)}</strong></p>
              <p style="margin: 0 0 24px; font-size: 16px; color: #e8e0d5;">Check-out: <strong>${escapeHtml(checkOutDate)}</strong></p>
              <p style="margin: 0; font-size: 14px; color: #e8e0d5b3;">If you have questions, please contact the camp caretaker.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 24px; background-color: #1a120b; border-top: 1px solid #d4af3720;">
              <p style="margin: 0; font-size: 12px; color: #e8e0d560;">Lost Dutchman's Mining Association &bull; 1976–2026</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

  try {
    await sgMail.send({
      to,
      from: { email: SENDER_EMAIL, name: SENDER_NAME },
      subject: `Reservation updated — ${siteName} at ${campName}`,
      text: textContent,
      html: htmlContent,
    });
    return true;
  } catch (e) {
    console.error("SendGrid reservation modified email error:", e);
    return false;
  }
}

/**
 * Send thank-you email at end of stay (reservation or check-in).
 * Used by cron job the day after check-out.
 */
export async function sendStayThankYouEmail(
  to: string,
  campName: string,
  recipientName: string,
  checkInDate: string,
  checkOutDate: string
): Promise<boolean> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.log(`[DEV] Stay thank-you for ${to}: ${campName}, ${checkInDate}–${checkOutDate}`);
      return true;
    }
    console.warn("SENDGRID_API_KEY not set; skipping stay thank-you email");
    return false;
  }

  sgMail.setApiKey(apiKey);

  const name = recipientName?.trim() || "there";
  const textContent = `Thank you for staying at ${campName}

Hi ${name},

Your stay from ${checkInDate} to ${checkOutDate} is complete. We hope you had a great time and we look forward to seeing you again.

Thank you for being part of the LDMA community.

Lost Dutchman's Mining Association`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #1a120b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #1a120b; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #2a1f14; border-radius: 8px; border: 1px solid #d4af3740; overflow: hidden;">
          <tr>
            <td style="padding: 32px 24px; text-align: center; border-bottom: 1px solid #d4af3720;">
              <h1 style="margin: 0; font-size: 20px; font-weight: 600; color: #f0d48f; letter-spacing: 0.05em;">LDMA</h1>
              <p style="margin: 8px 0 0; font-size: 14px; color: #e8e0d5b3;">Thank you for staying at ${escapeHtml(campName)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 24px;">
              <p style="margin: 0 0 16px; font-size: 16px; color: #e8e0d5; line-height: 1.5;">Hi ${escapeHtml(name)},</p>
              <p style="margin: 0 0 24px; font-size: 16px; color: #e8e0d5; line-height: 1.5;">Your stay from <strong>${escapeHtml(checkInDate)}</strong> to <strong>${escapeHtml(checkOutDate)}</strong> is complete. We hope you had a great time and we look forward to seeing you again.</p>
              <p style="margin: 0; font-size: 16px; color: #e8e0d5; line-height: 1.5;">Thank you for being part of the LDMA community.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 24px; background-color: #1a120b; border-top: 1px solid #d4af3720;">
              <p style="margin: 0; font-size: 12px; color: #e8e0d560;">Lost Dutchman's Mining Association &bull; 1976–2026</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

  try {
    await sgMail.send({
      to,
      from: { email: SENDER_EMAIL, name: SENDER_NAME },
      subject: `Thank you for staying at ${campName}`,
      text: textContent,
      html: htmlContent,
    });
    return true;
  } catch (e) {
    console.error("SendGrid stay thank-you email error:", e);
    return false;
  }
}

const EXCLUSIVE_OFFERS_COLLECTION_URL = "/collections/exclusive-offers-for-ldma-members";

export type ExclusiveOfferProduct = { id: string; title: string; handle: string };

export async function sendExclusiveOffersNotificationEmail(
  email: string,
  firstName: string | undefined,
  products: ExclusiveOfferProduct[],
  baseUrl: string
): Promise<boolean> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.log(`[DEV] Exclusive offers notification for ${email}:`, products.length, "products");
      return true;
    }
    console.warn("SENDGRID_API_KEY not set; skipping exclusive offers email");
    return false;
  }

  sgMail.setApiKey(apiKey);
  const name = firstName || "there";
  const collectionUrl = `${baseUrl}${EXCLUSIVE_OFFERS_COLLECTION_URL}`;

  const itemsHtml = products
    .map(
      (p) => `
    <tr>
      <td style="padding: 12px 24px; border-bottom: 1px solid #d4af3720;">
        <p style="margin: 0 0 4px; font-size: 16px; font-weight: 600; color: #f0d48f;">
          <a href="${baseUrl}/products/${encodeURIComponent(p.handle)}" style="color: #f0d48f; text-decoration: none;">${escapeHtml(p.title)}</a>
        </p>
        <p style="margin: 0;">
          <a href="${baseUrl}/products/${encodeURIComponent(p.handle)}" style="color: #d4af37; font-size: 14px; text-decoration: underline;">View offer →</a>
        </p>
      </td>
    </tr>
  `
    )
    .join("");

  const count = products.length;
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #1a120b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #1a120b; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #2a1f14; border-radius: 8px; border: 1px solid #d4af3740; overflow: hidden;">
          <tr>
            <td style="padding: 32px 24px; text-align: center; border-bottom: 1px solid #d4af3720;">
              <h1 style="margin: 0; font-size: 20px; font-weight: 600; color: #f0d48f;">LDMA</h1>
              <p style="margin: 8px 0 0; font-size: 14px; color: #e8e0d5b3;">New exclusive member offers</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px;">
              <p style="margin: 0 0 16px; font-size: 16px; color: #e8e0d5; line-height: 1.5;">Hi ${escapeHtml(name)},</p>
              <p style="margin: 0 0 24px; font-size: 16px; color: #e8e0d5; line-height: 1.5;">We've added <strong>${count}</strong> new ${count === 1 ? "offer" : "offers"} to Exclusive Offers for LDMA Members.</p>
            </td>
          </tr>
          ${itemsHtml}
          <tr>
            <td style="padding: 16px 24px;">
              <p style="margin: 0 0 8px;">
                <a href="${collectionUrl}" style="display: inline-block; padding: 14px 24px; background-color: #d4af37; color: #1a120b; font-weight: 600; text-decoration: none; border-radius: 8px;">View all exclusive offers</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 24px; background-color: #1a120b; border-top: 1px solid #d4af3720;">
              <p style="margin: 0; font-size: 12px; color: #e8e0d560;">You're receiving this because you opted in on the exclusive offers page. You can change this in your <a href="${baseUrl}/members/profile" style="color: #d4af37;">profile</a> or on the <a href="${baseUrl}${EXCLUSIVE_OFFERS_COLLECTION_URL}" style="color: #d4af37;">exclusive offers</a> page.</p>
              <p style="margin: 8px 0 0; font-size: 12px; color: #e8e0d560;">Lost Dutchman's Mining Association &bull; 1976–2026</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

  const textLines = products.map(
    (p) => `${p.title}\n${baseUrl}/products/${p.handle}`
  );
  const textContent = `Hi ${name},

We've added ${count} new ${count === 1 ? "offer" : "offers"} to Exclusive Offers for LDMA Members.

${textLines.join("\n\n")}

View all exclusive offers: ${collectionUrl}

You're receiving this because you opted in to exclusive offer notifications.`;

  try {
    await sgMail.send({
      to: email,
      from: { email: SENDER_EMAIL, name: SENDER_NAME },
      subject: count === 1
        ? `New LDMA exclusive offer: ${products[0].title}`
        : `${count} new LDMA exclusive member offers`,
      text: textContent,
      html: htmlContent,
    });
    return true;
  } catch (e) {
    console.error("SendGrid exclusive offers notification error:", e);
    return false;
  }
}

import type { LegacyOfferType } from "@/lib/legacy-offer";
import { getLegacyOfferConfig } from "@/lib/legacy-offer";

export type { LegacyOfferType };

export async function sendLegacyOfferEmail(
  email: string,
  firstName: string | undefined,
  offerType: LegacyOfferType,
  baseUrl: string
): Promise<boolean> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.log(`[DEV] Legacy offer email for ${email}, type: ${offerType}`);
      return true;
    }
    console.warn("SENDGRID_API_KEY not set; skipping legacy offer email");
    return false;
  }

  sgMail.setApiKey(apiKey);
  const name = firstName || "there";
  const config = getLegacyOfferConfig(offerType);
  const membersUrl = `${baseUrl}/members`;
  const phone = "(888) 465-3717";

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #1a120b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #1a120b; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #2a1f14; border-radius: 8px; border: 1px solid #d4af3740; overflow: hidden;">
          <tr>
            <td style="padding: 32px 24px; text-align: center; border-bottom: 1px solid #d4af3720;">
              <h1 style="margin: 0; font-size: 20px; font-weight: 600; color: #f0d48f;">LDMA</h1>
              <p style="margin: 8px 0 0; font-size: 14px; color: #e8e0d5b3;">Build Your Family Legacy</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 24px;">
              <p style="margin: 0 0 16px; font-size: 16px; color: #e8e0d5; line-height: 1.5;">Hi ${escapeHtml(name)},</p>
              <p style="margin: 0 0 20px; font-size: 16px; color: #e8e0d5; line-height: 1.5;">Thanks for requesting your personalized offer. Based on your membership, here's what we're offering:</p>
              <div style="padding: 20px; background: #1a120b; border-radius: 8px; border-left: 4px solid #d4af37; margin-bottom: 24px;">
                <p style="margin: 0 0 8px; font-size: 18px; font-weight: 600; color: #f0d48f;">${escapeHtml(config.headline)}</p>
                <p style="margin: 0 0 16px; font-size: 15px; color: #e8e0d5; line-height: 1.5;">${escapeHtml(config.body)}</p>
                <p style="margin: 0; font-size: 20px; font-weight: 700; color: #d4af37;">${config.price} <span style="font-size: 14px; font-weight: 400; color: #e8e0d5b3; text-decoration: line-through;">${config.regularPrice}</span></p>
              </div>
              <p style="margin: 0 0 20px; font-size: 15px; color: #e8e0d5; line-height: 1.5;">To take advantage of this offer, call us or log in to your member profile on our website.</p>
              <p style="margin: 0 0 8px;">
                <a href="tel:8884653717" style="display: inline-block; padding: 14px 24px; background-color: #d4af37; color: #1a120b; font-weight: 600; text-decoration: none; border-radius: 8px;">Call ${phone}</a>
              </p>
              <p style="margin: 0 0 8px; font-size: 14px; color: #e8e0d5b3;">or</p>
              <p style="margin: 0;">
                <a href="${membersUrl}" style="display: inline-block; padding: 14px 24px; border: 2px solid #d4af37; color: #d4af37; font-weight: 600; text-decoration: none; border-radius: 8px;">Log in to Member Profile</a>
              </p>
              <p style="margin: 24px 0 0; font-size: 13px; color: #e8e0d5b3;">Questions? Call us at ${phone} — we're happy to help.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 24px; background-color: #1a120b; border-top: 1px solid #d4af3720;">
              <p style="margin: 0; font-size: 12px; color: #e8e0d560;">Lost Dutchman's Mining Association &bull; 1976–2026</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

  const textContent = `Hi ${name},

Thanks for requesting your personalized offer. Based on your membership, here's what we're offering:

${config.headline}
${config.body}

Price: ${config.price} (regularly ${config.regularPrice})

To take advantage:
- Call ${phone}
- Or log in to your member profile: ${membersUrl}

Questions? Call us at ${phone}.`;

  try {
    await sgMail.send({
      to: email,
      from: { email: SENDER_EMAIL, name: SENDER_NAME },
      subject: `Your LDMA Family Legacy Offer — ${config.headline}`,
      text: textContent,
      html: htmlContent,
      trackingSettings: {
        clickTracking: { enable: false },
      },
    });
    return true;
  } catch (e) {
    console.error("SendGrid legacy offer error:", e);
    return false;
  }
}
