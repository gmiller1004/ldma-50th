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
              <p style="margin: 8px 0 0; font-size: 14px; color: #e8e0d5b3;">50 Years of Gold, Grit & Brotherhood</p>
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
