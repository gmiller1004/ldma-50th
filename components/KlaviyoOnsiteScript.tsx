import Script from "next/script";

/**
 * Klaviyo onsite tracking — enables campaign click attribution and onsite metrics.
 * Set NEXT_PUBLIC_KLAVIYO_COMPANY_ID (Settings → Account → API keys / public Company ID).
 */
export function KlaviyoOnsiteScript() {
  const companyId = process.env.NEXT_PUBLIC_KLAVIYO_COMPANY_ID?.trim();
  if (!companyId) return null;

  return (
    <Script
      src={`https://static.klaviyo.com/onsite/js/klaviyo.js?company_id=${encodeURIComponent(companyId)}`}
      strategy="afterInteractive"
    />
  );
}
