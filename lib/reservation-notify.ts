/**
 * Member Relations notification helpers for camp reservations.
 */

const DEFAULT_MRS_EMAIL = "info@lostdutchmans.com";

export function getReservationMrsNotifyEmail(): string {
  return process.env.RESERVATION_MRS_NOTIFY_EMAIL?.trim() || DEFAULT_MRS_EMAIL;
}

export function mrsNotifyBcc(): string[] {
  return [getReservationMrsNotifyEmail()];
}

export function reservationPayPageUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://ldma-50th.vercel.app";
  return `${base}/reservations/pay?token=${encodeURIComponent(token)}`;
}

export function caretakerAdminReservationsUrl(campSlug?: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://ldma-50th.vercel.app";
  const path = "/members/caretaker";
  if (!campSlug) return `${base}${path}`;
  return `${base}${path}?camp=${encodeURIComponent(campSlug)}`;
}
